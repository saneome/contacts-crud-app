var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var fs = require("fs");
var path = require("path");
var mongodb = require("mongodb");
var crypto = require("crypto");

var ObjectID = mongodb.ObjectId || mongodb.ObjectID;
var CONTACTS_COLLECTION = "contacts";

var app = express();
app.use(cors());
app.use(bodyParser.json());

// Раздача статического контента (веб-клиент приложения)
var distDir = path.join(__dirname, "public");
app.use(express.static(distDir));

// При запуске на Vercel база и маршруты поднимаются при первом API-запросе.
// Статические файлы отдаются Express выше без необходимости подключать БД.
app.use(function (req, res, next) {
  initialize().then(function () {
    next();
  }).catch(function (err) {
    console.error("Не удалось инициализировать приложение:", err.message);
    res.status(500).json({ error: "Не удалось подключиться к базе данных." });
  });
});

// Общий обработчик ошибок (Листинг 5.2)
function handleError(res, reason, message, code) {
  console.log("Ошибка: " + reason);
  res.status(code || 500).json({ "error": message });
}

// Абстракция хранилища (MongoDB либо локальное хранилище data/contacts.json)
var dbAdapter = null;

// Реализация локального хранилища, совместимого с методами коллекции MongoDB
class LocalFileDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.dir = path.dirname(filePath);
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      var initialData = [
        {
          _id: "67010f3c8a92b95b1f4e1001",
          name: "Иван Иванов",
          email: "ivanov@mirea.ru",
          phone: { mobile: "+7 (999) 111-22-33", work: "+7 (495) 123-45-67" }
        },
        {
          _id: "67010f3c8a92b95b1f4e1002",
          name: "Петр Петров",
          email: "petrov@mirea.ru",
          phone: { mobile: "+7 (999) 444-55-66", work: "+7 (495) 765-43-21" }
        }
      ];
      fs.writeFileSync(this.filePath, JSON.stringify(initialData, null, 2), "utf8");
    }
  }

  _read() {
    try {
      var data = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  _write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  find(query) {
    var items = this._read();
    return {
      toArray: async () => items
    };
  }

  async findOne(query) {
    var items = this._read();
    var qId = query._id ? query._id.toString() : null;
    return items.find(item => item._id.toString() === qId) || null;
  }

  async insertOne(doc) {
    var items = this._read();
    if (!doc._id) {
      doc._id = crypto.randomBytes(12).toString("hex");
    } else {
      doc._id = doc._id.toString();
    }
    items.push(doc);
    this._write(items);
    return { insertedId: doc._id };
  }

  async updateOne(query, update) {
    var items = this._read();
    var qId = query._id ? query._id.toString() : null;
    var index = items.findIndex(item => item._id.toString() === qId);
    if (index === -1) {
      return { matchedCount: 0, modifiedCount: 0 };
    }
    var current = items[index];
    var updated = Object.assign({}, current, update.$set || update);
    delete updated._id;
    updated._id = current._id;
    items[index] = updated;
    this._write(items);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(query) {
    var items = this._read();
    var qId = query._id ? query._id.toString() : null;
    var initialLen = items.length;
    items = items.filter(item => item._id.toString() !== qId);
    this._write(items);
    return { deletedCount: initialLen - items.length };
  }

  async deleteMany(query) {
    var items = this._read();
    var count = items.length;
    this._write([]);
    return { deletedCount: count };
  }
}

// Инициализация маршрутов API
function registerRoutes(app, collection) {
  /*
   * GET /v1/contact и /api/contacts - получить все контакты
   */
  var getAllContacts = async function (req, res) {
    try {
      var docs = await collection.find({}).toArray();
      res.status(200).json(docs);
    } catch (err) {
      handleError(res, err.message, "Не удалось получить список контактов.");
    }
  };
  app.get("/v1/contact", getAllContacts);
  app.get("/api/contacts", getAllContacts);

  /*
   * POST /v1/contact и /api/contacts - создать новый контакт
   */
  var createContact = async function (req, res) {
    var newContact = req.body;
    var contactName = newContact.name || newContact.username;

    if (!contactName) {
      handleError(res, "Некорректный ввод", "Необходимо указать имя контакта (name или username).", 400);
      return;
    }

    // Нормализация телефонных номеров
    if (!newContact.phone && newContact.telephone) {
      newContact.phone = newContact.telephone;
    }
    if (!newContact.phone) {
      newContact.phone = { mobile: "", work: "" };
    }

    try {
      var result = await collection.insertOne(newContact);
      newContact._id = result.insertedId;
      res.status(201).json(newContact);
    } catch (err) {
      handleError(res, err.message, "Не удалось создать контакт.");
    }
  };
  app.post("/v1/contact", createContact);
  app.post("/api/contacts", createContact);

  /*
   * DELETE /v1/contact и /api/contacts - удалить все контакты
   */
  var deleteAllContacts = async function (req, res) {
    try {
      var result = await collection.deleteMany({});
      res.status(200).json({ message: "Все контакты успешно удалены.", count: result.deletedCount });
    } catch (err) {
      handleError(res, err.message, "Не удалось удалить контакты.");
    }
  };
  app.delete("/v1/contact", deleteAllContacts);
  app.delete("/api/contacts", deleteAllContacts);

  /*
   * GET /v1/contact/:id и /api/contacts/:id - получить контакт по id
   */
  var getContactById = async function (req, res) {
    var id = req.params.id;
    var queryId = ObjectID.isValid(id) ? new ObjectID(id) : id;

    try {
      var doc = await collection.findOne({ _id: queryId });
      if (!doc) {
        handleError(res, "Контакт не найден", "Контакт с указанным ID не найден.", 404);
      } else {
        res.status(200).json(doc);
      }
    } catch (err) {
      handleError(res, err.message, "Не удалось найти контакт.");
    }
  };
  app.get("/v1/contact/:id", getContactById);
  app.get("/api/contacts/:id", getContactById);

  /*
   * PUT /v1/contact/:id и /api/contacts/:id - обновить контакт по id
   */
  var updateContactById = async function (req, res) {
    var id = req.params.id;
    var queryId = ObjectID.isValid(id) ? new ObjectID(id) : id;
    var updateDoc = req.body;
    delete updateDoc._id;

    try {
      var result = await collection.updateOne({ _id: queryId }, { $set: updateDoc });
      if (result.matchedCount === 0) {
        handleError(res, "Контакт не найден", "Контакт с указанным ID не найден для обновления.", 404);
      } else {
        updateDoc._id = id;
        res.status(200).json(updateDoc);
      }
    } catch (err) {
      handleError(res, err.message, "Не удалось обновить контакт.");
    }
  };
  app.put("/v1/contact/:id", updateContactById);
  app.put("/api/contacts/:id", updateContactById);

  /*
   * DELETE /v1/contact/:id и /api/contacts/:id - удалить контакт по id
   */
  var deleteContactById = async function (req, res) {
    var id = req.params.id;
    var queryId = ObjectID.isValid(id) ? new ObjectID(id) : id;

    try {
      var result = await collection.deleteOne({ _id: queryId });
      if (result.deletedCount === 0) {
        handleError(res, "Контакт не найден", "Контакт с указанным ID не найден для удаления.", 404);
      } else {
        res.status(200).json({ _id: id, message: "Контакт успешно удален." });
      }
    } catch (err) {
      handleError(res, err.message, "Не удалось удалить контакт.");
    }
  };
  app.delete("/v1/contact/:id", deleteContactById);
  app.delete("/api/contacts/:id", deleteContactById);
}

// Инициализация выполняется отдельно от listen, чтобы тот же Express app
// можно было запускать как обычный сервер или как Vercel Function.
var routesRegistered = false;
var mongoClient = null;
var initializationPromise = null;

async function initializeDatabase() {

  var mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    if (!mongoClient) {
      mongoClient = new mongodb.MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
      });
    }
    await mongoClient.connect();
    var collection = mongoClient.db().collection(CONTACTS_COLLECTION);
    registerRoutes(app, collection);
  } else {
    if (process.env.VERCEL) {
      throw new Error("Для Vercel необходимо задать переменную MONGODB_URI.");
    }
    var localDb = new LocalFileDatabase(path.join(__dirname, "data", "contacts.json"));
    registerRoutes(app, localDb);
  }
  routesRegistered = true;
}

function initialize() {
  if (routesRegistered) return Promise.resolve();
  if (!initializationPromise) {
    initializationPromise = initializeDatabase().catch(function (err) {
      initializationPromise = null;
      throw err;
    });
  }
  return initializationPromise;
}

if (require.main === module) {
  var PORT = process.env.PORT || 8080;
  initialize().then(function () {
    var server = app.listen(PORT, function () {
      var port = server.address().port;
      console.log("Приложение запущено на порту", port);
      console.log("API доступен по адресам: http://localhost:" + port + "/v1/contact и /api/contacts");
      console.log("Веб-интерфейс доступен по адресу: http://localhost:" + port + "/");
    });
  }).catch(function (err) {
    console.error("Не удалось запустить приложение:", err.message);
    process.exitCode = 1;
  });
}

app.initialize = initialize;
module.exports = app;
