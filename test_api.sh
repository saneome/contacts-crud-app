#!/usr/bin/env bash

PORT=${PORT:-8080}
BASE_URL="http://localhost:${PORT}"

echo "========================================================="
echo " Тестирование CRUD REST API телефонной книги (Практика 5)"
echo " Сервер: ${BASE_URL}"
echo "========================================================="

echo -e "\n1. GET /v1/contact — Получение начального списка контактов"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/v1/contact"

echo -e "\n2. GET /v1/contact/67010f3c8a92b95b1f4e1001 — Получение контакта по ID"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/v1/contact/67010f3c8a92b95b1f4e1001"

echo -e "\n3. POST /v1/contact — Создание нового контакта"
CREATE_RESP=$(curl -s -X POST "${BASE_URL}/v1/contact" \
  -H "Content-Type: application/json" \
  -d '{"name": "Алексей Смирнов", "email": "smirnov@mirea.ru", "phone": {"mobile": "+7 (999) 777-11-22", "work": "+7 (495) 888-33-44"}}')
echo "$CREATE_RESP"
NEW_ID=$(node -e "console.log(JSON.parse(process.argv[1])._id)" "$CREATE_RESP")
echo "Создан контакт с ID: $NEW_ID"

echo -e "\n4. GET /v1/contact/${NEW_ID} — Проверка созданного контакта"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/v1/contact/${NEW_ID}"

echo -e "\n5. PUT /v1/contact/${NEW_ID} — Обновление данных контакта (PUT)"
curl -s -X PUT "${BASE_URL}/v1/contact/${NEW_ID}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Алексей Смирнов (Руководитель IT)", "email": "smirnov.lead@mirea.ru", "phone": {"mobile": "+7 (999) 777-99-00", "work": "+7 (495) 888-00-00"}}' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n6. GET /api/contacts — Проверка альтернативного маршрута (/api/contacts)"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/api/contacts"

echo -e "\n7. DELETE /v1/contact/${NEW_ID} — Удаление контакта по ID"
curl -s -X DELETE "${BASE_URL}/v1/contact/${NEW_ID}" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n8. GET /v1/contact/${NEW_ID} — Проверка отсутствия удаленного контакта (ожидается 404)"
curl -s -w "\nHTTP Status: %{http_code}\n" "${BASE_URL}/v1/contact/${NEW_ID}"
