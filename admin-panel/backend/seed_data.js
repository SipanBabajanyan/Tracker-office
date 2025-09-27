const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Подключение к базе данных
const db = new sqlite3.Database('./office_tracking.db');

// Функция для генерации случайного времени в минутах
function getRandomMinutes(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Функция для генерации случайного времени входа/выхода
function getRandomTimeInOffice() {
  const startHour = Math.floor(Math.random() * 3) + 8; // 8-10 утра
  const startMinute = Math.floor(Math.random() * 60);
  const duration = getRandomMinutes(240, 600); // 4-10 часов
  
  const startTime = new Date();
  startTime.setHours(startHour, startMinute, 0, 0);
  
  const endTime = new Date(startTime.getTime() + duration * 60000);
  
  return {
    start: startTime.toISOString(),
    end: endTime.toISOString(),
    minutes: duration
  };
}

// Функция для генерации данных за день
function generateDayData(employeeId, date) {
  const sessions = [];
  const timeInOffice = getRandomTimeInOffice();
  
  // 80% вероятность что сотрудник был в офисе
  if (Math.random() < 0.8) {
    sessions.push({
      employee_id: employeeId,
      start_time: timeInOffice.start,
      end_time: timeInOffice.end,
      is_active: 0,
      total_minutes: timeInOffice.minutes
    });
  }
  
  return sessions;
}

// Основная функция заполнения данных
async function seedDatabase() {
  console.log('🌱 Начинаем заполнение базы данных тестовыми данными...');
  
  // Очищаем существующие данные
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM daily_stats', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM office_sessions', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM employees', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  
  // Добавляем сотрудников
  const employees = [
    { name: 'Иван Иванович Петров', device_id: 'device_001', target_hours: 8 },
    { name: 'Мария Александровна Сидорова', device_id: 'device_002', target_hours: 7 }
  ];
  
  const employeeIds = [];
  
  for (const emp of employees) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO employees (name, device_id, target_hours_per_day) VALUES (?, ?, ?)',
        [emp.name, emp.device_id, emp.target_hours],
        function(err) {
          if (err) reject(err);
          else {
            employeeIds.push(this.lastID);
            console.log(`✅ Добавлен сотрудник: ${emp.name} (ID: ${this.lastID})`);
            resolve();
          }
        }
      );
    });
  }
  
  // Генерируем данные за последние 3 месяца
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  
  const endDate = new Date();
  
  console.log('📅 Генерируем данные за последние 3 месяца...');
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const currentDate = new Date(d);
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Пропускаем выходные (суббота и воскресенье)
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      continue;
    }
    
    for (let i = 0; i < employeeIds.length; i++) {
      const employeeId = employeeIds[i];
      const sessions = generateDayData(employeeId, currentDate);
      
      // Добавляем сессии
      for (const session of sessions) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO office_sessions (employee_id, start_time, end_time, is_active) VALUES (?, ?, ?, ?)',
            [session.employee_id, session.start_time, session.end_time, session.is_active],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      // Добавляем статистику за день
      const totalMinutes = sessions.reduce((sum, s) => sum + s.total_minutes, 0);
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO daily_stats (employee_id, date, total_minutes, sessions_count) VALUES (?, ?, ?, ?)',
          [employeeId, dateStr, totalMinutes, sessions.length],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }
  
  console.log('✅ База данных успешно заполнена тестовыми данными!');
  console.log(`📊 Добавлено ${employeeIds.length} сотрудников`);
  console.log('📅 Данные за последние 3 месяца (рабочие дни)');
  
  // Показываем статистику
  for (let i = 0; i < employeeIds.length; i++) {
    const employeeId = employeeIds[i];
    const emp = employees[i];
    
    await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as days, SUM(total_minutes) as total_minutes FROM daily_stats WHERE employee_id = ?',
        [employeeId],
        (err, row) => {
          if (err) reject(err);
          else {
            const avgHours = (row.total_minutes / 60 / row.days).toFixed(1);
            console.log(`👤 ${emp.name}: ${row.days} дней, ${(row.total_minutes / 60).toFixed(1)}ч общее время, ${avgHours}ч в среднем`);
            resolve();
          }
        }
      );
    });
  }
  
  db.close();
}

// Запускаем заполнение
seedDatabase().catch(console.error);
