const { app, initialize } = require("../server");

module.exports = async function handler(req, res) {
  try {
    await initialize();
    return app(req, res);
  } catch (error) {
    console.error("Vercel function initialization failed:", error.message);
    return res.status(500).json({ error: "Не удалось подключиться к базе данных." });
  }
};
