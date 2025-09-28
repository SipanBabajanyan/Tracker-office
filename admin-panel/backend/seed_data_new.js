const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Подключение к базе данных
const db = new sqlite3.Database('./office_tracking.db');

// Функция для проверки рабочего дня
function isWorkingDay(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day >= 1 && day <= 5; // Понедельник-пятница
}

// Функция для генерации случайного времени в минутах
function getRandomMinutes(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Функция для генерации времени входа/выхода с учетом рабочего расписания
function getRandomTimeInOffice(workStart, workEnd, isWorkingDay) {
  if (!isWorkingDay) {
    // В выходные - случайное время
    const startHour = Math.floor(Math.random() * 12) + 8; // 8-20
    const startMinute = Math.floor(Math.random() * 60);
    const duration = getRandomMinutes(60, 300); // 1-5 часов
    
    const startTime = new Date();
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    return {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      minutes: duration
    };
  }

  // В рабочие дни - с учетом расписания
  const [startHour, startMinute] = workStart.split(':').map(Number);
  const [endHour, endMinute] = workEnd.split(':').map(Number);
  
  // Добавляем случайное опоздание (0-30 минут)
  const lateMinutes = Math.floor(Math.random() * 31);
  const actualStartHour = startHour;
  const actualStartMinute = Math.min(startMinute + lateMinutes, 59);
  
  // Добавляем случайное раннее увольнение (0-60 минут)
  const earlyLeaveMinutes = Math.floor(Math.random() * 61);
  const actualEndHour = endHour;
  const actualEndMinute = Math.max(endMinute - earlyLeaveMinutes, 0);
  
  const startTime = new Date();
  startTime.setHours(actualStartHour, actualStartMinute, 0, 0);
  
  const endTime = new Date();
  endTime.setHours(actualEndHour, actualEndMinute, 0, 0);
  
  const duration = Math.round((endTime - startTime) / 60000);
  
  return {
    start: startTime.toISOString(),
    end: endTime.toISOString(),
    minutes: Math.max(duration, 0)
  };
}

// Функция для генерации данных за день
function generateDayData(employeeId, date, workStart, workEnd) {
  const sessions = [];
  const isWorking = isWorkingDay(date);
  
  // В рабочие дни - 90% вероятность, в выходные - 30%
  const probability = isWorking ? 0.9 : 0.3;
  
  if (Math.random() < probability) {
    const timeInOffice = getRandomTimeInOffice(workStart, workEnd, isWorking);
    
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
      db.run('DELETE FROM work_days', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  
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
  
  // Добавляем сотрудников с разными рабочими расписаниями
  const employees = [
    { 
      name: 'Иван Иванович Петров', 
      device_id: 'device_001', 
      target_hours: 8,
      work_start: '09:00',
      work_end: '18:00'
    },
    { 
      name: 'Мария Александровна Сидорова', 
      device_id: 'device_002', 
      target_hours: 7,
      work_start: '10:00',
      work_end: '19:00'
    },
    { 
      name: 'Алексей Сергеевич Козлов', 
      device_id: 'device_003', 
      target_hours: 8,
      work_start: '08:30',
      work_end: '17:30'
    },
    { 
      name: 'Елена Владимировна Морозова', 
      device_id: 'device_004', 
      target_hours: 6,
      work_start: '11:00',
      work_end: '18:00'
    },
    { 
      name: 'Дмитрий Петрович Волков', 
      device_id: 'device_005', 
      target_hours: 8,
      work_start: '10:00',
      work_end: '19:00'
    }
  ];
  
  const employeeIds = [];
  
  for (const emp of employees) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO employees (name, device_id, target_hours_per_day, default_work_start, default_work_end) VALUES (?, ?, ?, ?, ?)',
        [emp.name, emp.device_id, emp.target_hours, emp.work_start, emp.work_end],
        function(err) {
          if (err) reject(err);
          else {
            employeeIds.push({
              id: this.lastID,
              ...emp
            });
            console.log(`✅ Добавлен сотрудник: ${emp.name} (ID: ${this.lastID}) - ${emp.work_start}-${emp.work_end}`);
            resolve();
          }
        }
      );
    });
  }
  
  // Генерируем данные за последние 2 месяца
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 2);
  
  const endDate = new Date();
  
  console.log('📅 Генерируем данные за последние 2 месяца...');
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const currentDate = new Date(d);
    const dateStr = currentDate.toISOString().split('T')[0];
    const isWorking = isWorkingDay(dateStr);
    
    for (let i = 0; i < employeeIds.length; i++) {
      const employee = employeeIds[i];
      const sessions = generateDayData(employee.id, dateStr, employee.work_start, employee.work_end);
      
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
          'INSERT INTO daily_stats (employee_id, date, total_minutes, sessions_count, is_in_office) VALUES (?, ?, ?, ?, ?)',
          [employee.id, dateStr, totalMinutes, sessions.length, sessions.length > 0 ? 1 : 0],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      // Создаем рабочий день для рабочих дней
      if (isWorking) {
        await new Promise((resolve, reject) => {
          const workStartDateTime = `${dateStr} ${employee.work_start}:00`;
          const workEndDateTime = `${dateStr} ${employee.work_end}:00`;
          
          db.run(
            'INSERT INTO work_days (employee_id, date, work_start_time, work_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
            [employee.id, dateStr, workStartDateTime, workEndDateTime],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }
  }
  
  console.log('✅ База данных успешно заполнена тестовыми данными!');
  console.log(`📊 Добавлено ${employeeIds.length} сотрудников`);
  console.log('📅 Данные за последние 2 месяца (включая выходные)');
  
  // Показываем статистику
  for (let i = 0; i < employeeIds.length; i++) {
    const employee = employeeIds[i];
    
    await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as days, SUM(total_minutes) as total_minutes FROM daily_stats WHERE employee_id = ?',
        [employee.id],
        (err, row) => {
          if (err) reject(err);
          else {
            const avgHours = (row.total_minutes / 60 / row.days).toFixed(1);
            console.log(`👤 ${employee.name}: ${row.days} дней, ${(row.total_minutes / 60).toFixed(1)}ч общее время, ${avgHours}ч в среднем`);
            resolve();
          }
        }
      );
    });
  }
  
  // Показываем статистику по рабочим дням
  console.log('\n📊 Статистика по рабочим дням:');
  for (let i = 0; i < employeeIds.length; i++) {
    const employee = employeeIds[i];
    
    await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as work_days FROM work_days WHERE employee_id = ?',
        [employee.id],
        (err, row) => {
          if (err) reject(err);
          else {
            console.log(`👤 ${employee.name}: ${row.work_days} рабочих дней`);
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
