// Клиентский сервис для работы с REST API телефонной книги
var API_URL = "/v1/contact";

var contacts = [];
var selectedContactId = null;

var contactListEl = document.getElementById("contactList");
var contactCountEl = document.getElementById("contactCount");
var formTitleEl = document.getElementById("formTitle");
var saveBtnTextEl = document.getElementById("saveBtnText");
var btnDeleteContactEl = document.getElementById("btnDeleteContact");
var btnResetFormEl = document.getElementById("btnResetForm");
var btnNewContactEl = document.getElementById("btnNewContact");
var btnDeleteAllEl = document.getElementById("btnDeleteAll");
var btnSaveContactEl = document.getElementById("btnSaveContact");

var inputId = document.getElementById("contactId");
var inputName = document.getElementById("inputName");
var inputEmail = document.getElementById("inputEmail");
var inputPhoneMobile = document.getElementById("inputPhoneMobile");
var inputPhoneWork = document.getElementById("inputPhoneWork");
var alertPlaceholder = document.getElementById("alertPlaceholder");

function showAlert(message, type = "success") {
  alertPlaceholder.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  setTimeout(() => {
    alertPlaceholder.innerHTML = "";
  }, 4000);
}

// Загрузка всех контактов (GET /v1/contact)
async function loadContacts() {
  try {
    var res = await fetch(API_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    contacts = await res.json();
    renderContactsList();
  } catch (err) {
    showAlert("Ошибка при загрузке списка контактов: " + err.message, "danger");
    contactListEl.innerHTML = `<li class="list-group-item text-danger py-3 text-center">Не удалось загрузить контакты</li>`;
  }
}

// Отрисовка списка контактов
function renderContactsList() {
  contactCountEl.textContent = `Всего: ${contacts.length}`;
  if (contacts.length === 0) {
    contactListEl.innerHTML = `<li class="list-group-item text-center text-muted py-4">Список контактов пуст. Нажмите «Новый контакт»</li>`;
    return;
  }

  contactListEl.innerHTML = contacts.map(c => {
    var isActive = c._id === selectedContactId ? "active" : "";
    var name = c.name || c.username || "Без имени";
    var mobile = (c.phone && c.phone.mobile) || "";
    return `
      <li class="list-group-item d-flex justify-content-between align-items-center py-3 ${isActive}" onclick="selectContact('${c._id}')">
        <div>
          <div class="fw-medium">${escapeHtml(name)}</div>
          <div class="small text-muted">${escapeHtml(mobile || c.email || "Нет телефона")}</div>
        </div>
        <i class="bi bi-chevron-right text-muted small"></i>
      </li>
    `;
  }).join("");
}

function selectContact(id) {
  selectedContactId = id;
  var c = contacts.find(item => item._id === id);
  if (!c) return;

  inputId.value = c._id;
  inputName.value = c.name || c.username || "";
  inputEmail.value = c.email || "";
  inputPhoneMobile.value = (c.phone && c.phone.mobile) || "";
  inputPhoneWork.value = (c.phone && c.phone.work) || "";

  formTitleEl.innerHTML = `<i class="bi bi-person-gear me-1"></i> Редактирование контакта`;
  saveBtnTextEl.textContent = "Обновить контакт";
  btnDeleteContactEl.style.display = "inline-block";

  renderContactsList();
}

function resetForm() {
  selectedContactId = null;
  inputId.value = "";
  inputName.value = "";
  inputEmail.value = "";
  inputPhoneMobile.value = "";
  inputPhoneWork.value = "";

  formTitleEl.innerHTML = `<i class="bi bi-person-badge me-1"></i> Детали контакта (Новый)`;
  saveBtnTextEl.textContent = "Создать контакт";
  btnDeleteContactEl.style.display = "none";

  renderContactsList();
}

// Сохранение контакта (POST или PUT)
async function saveContact() {
  var name = inputName.value.trim();
  if (!name) {
    showAlert("Пожалуйста, заполните обязательное поле «Имя».", "warning");
    inputName.focus();
    return;
  }

  var payload = {
    name: name,
    email: inputEmail.value.trim(),
    phone: {
      mobile: inputPhoneMobile.value.trim(),
      work: inputPhoneWork.value.trim()
    }
  };

  var id = inputId.value;

  try {
    if (id) {
      // PUT /v1/contact/:id
      var res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var updated = await res.json();
      var idx = contacts.findIndex(item => item._id === id);
      if (idx !== -1) contacts[idx] = updated;
      showAlert("Контакт успешно обновлен!");
    } else {
      // POST /v1/contact
      var res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var created = await res.json();
      contacts.push(created);
      selectedContactId = created._id;
      showAlert("Новый контакт успешно создан!");
    }
    renderContactsList();
    if (!id) resetForm();
  } catch (err) {
    showAlert("Ошибка сохранения: " + err.message, "danger");
  }
}

// Удаление выбранного контакта (DELETE /v1/contact/:id)
async function deleteSelectedContact() {
  var id = inputId.value;
  if (!id) return;

  if (!confirm("Вы действительно хотите удалить этот контакт?")) return;

  try {
    var res = await fetch(`${API_URL}/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    contacts = contacts.filter(item => item._id !== id);
    resetForm();
    showAlert("Контакт успешно удален.");
  } catch (err) {
    showAlert("Ошибка при удалении: " + err.message, "danger");
  }
}

// Удаление всех контактов (DELETE /v1/contact)
async function deleteAllContacts() {
  if (contacts.length === 0) return;
  if (!confirm("Внимание! Вы собираетесь удалить ВСЕ контакты из базы данных. Продолжить?")) return;

  try {
    var res = await fetch(API_URL, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    contacts = [];
    resetForm();
    showAlert("Все контакты удалены.", "warning");
  } catch (err) {
    showAlert("Ошибка при удалении всех контактов: " + err.message, "danger");
  }
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}

// Event listeners
btnNewContactEl.addEventListener("click", resetForm);
btnResetFormEl.addEventListener("click", resetForm);
btnSaveContactEl.addEventListener("click", saveContact);
btnDeleteContactEl.addEventListener("click", deleteSelectedContact);
btnDeleteAllEl.addEventListener("click", deleteAllContacts);

// Инициализация при старте
window.addEventListener("DOMContentLoaded", () => {
  resetForm();
  loadContacts();
});
