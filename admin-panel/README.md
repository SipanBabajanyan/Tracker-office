# In Office - Админ панель

Веб-интерфейс для отслеживания присутствия сотрудников в офисе.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
cd admin-panel/backend
npm install
```

### 2. Запуск сервера
```bash
npm start
```

### 3. Открыть админ-панель
Перейдите по адресу: http://localhost:3000

## 📊 Возможности

- **Просмотр сотрудников** - список всех зарегистрированных сотрудников
- **Статистика в реальном времени** - кто в офисе сейчас
- **Аналитика времени** - сколько часов каждый сотрудник в офисе
- **Экспорт данных** - выгрузка в CSV формате
- **API для мобильного приложения** - интеграция с трекером

## 🔧 API Endpoints

### Получить всех сотрудников
```
GET /api/employees
```

### Получить статистику
```
GET /api/stats
```

### Обновить статус сотрудника (для мобильного приложения)
```
POST /api/tracking/status
{
  "deviceId": "device_001",
  "isInOffice": true
}
```

### Экспорт данных
```
GET /api/export/csv?startDate=2024-12-01&endDate=2024-12-31
```

## 🗄️ База данных

Используется SQLite с тремя таблицами:
- `employees` - информация о сотрудниках
- `office_sessions` - сессии работы в офисе
- `daily_stats` - ежедневная статистика

## 🌐 Развертывание на VPS

### 1. Подготовка сервера
```bash
# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2 для управления процессами
sudo npm install -g pm2
```

### 2. Загрузка проекта
```bash
# Клонирование репозитория
git clone https://github.com/SipanBabajanyan/Tracker-office.git
cd Tracker-office/admin-panel/backend

# Установка зависимостей
npm install
```

### 3. Запуск с PM2
```bash
# Запуск приложения
pm2 start server.js --name "in-office-admin"

# Сохранение конфигурации
pm2 save
pm2 startup
```

### 4. Настройка Nginx (опционально)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📱 Интеграция с мобильным приложением

Мобильное приложение должно отправлять данные на сервер:

```dart
// Пример интеграции в Flutter
Future<void> updateServerStatus(bool isInOffice) async {
  try {
    final response = await http.post(
      Uri.parse('https://your-domain.com/api/tracking/status'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'deviceId': 'device_001', // Уникальный ID устройства
        'isInOffice': isInOffice,
      }),
    );
    
    if (response.statusCode == 200) {
      print('Статус обновлен на сервере');
    }
  } catch (e) {
    print('Ошибка отправки статуса: $e');
  }
}
```

## 🔒 Безопасность

- Добавьте аутентификацию для админ-панели
- Используйте HTTPS в продакшене
- Настройте CORS для вашего домена
- Регулярно обновляйте зависимости

## 📈 Мониторинг

```bash
# Просмотр логов
pm2 logs in-office-admin

# Мониторинг ресурсов
pm2 monit

# Перезапуск приложения
pm2 restart in-office-admin
```

## 🛠️ Разработка

```bash
# Запуск в режиме разработки
npm run dev

# Просмотр логов
npm start
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs in-office-admin`
2. Убедитесь, что порт 3000 свободен
3. Проверьте права доступа к файлам базы данных
