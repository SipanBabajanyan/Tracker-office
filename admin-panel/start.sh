#!/bin/bash

echo "🚀 Запуск In Office - Админ панель"
echo "=================================="

# Проверяем, установлен ли Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js: https://nodejs.org/"
    exit 1
fi

# Проверяем, установлен ли npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен!"
    echo "Установите npm вместе с Node.js"
    exit 1
fi

# Переходим в директорию backend
cd "$(dirname "$0")/backend"

# Проверяем, установлены ли зависимости
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка установки зависимостей!"
        exit 1
    fi
fi

# Запускаем сервер
echo "🌐 Запуск сервера..."
echo "Админ-панель будет доступна по адресу: http://localhost:3000"
echo "Для остановки нажмите Ctrl+C"
echo ""

npm start
