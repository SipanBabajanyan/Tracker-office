const sqlite3 = require('sqlite3').verbose();

// Подключение к базе данных
const db = new sqlite3.Database('./office_tracking.db');

// Функция для проверки рабочего дня
function isWorkingDay(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day >= 1 && day <= 5; // Понедельник-пятница
}

// Функция для обновления рабочего дня
function updateWorkDayActualTime(employeeId, dateStr, totalMinutes = 0) {
  return new Promise((resolve, reject) => {
    const getQuery = 'SELECT * FROM work_days WHERE employee_id = ? AND date = ?';
    db.get(getQuery, [employeeId, dateStr], (err, workDay) => {
      if (err) {
        console.error('Ошибка получения рабочего дня:', err);
        reject(err);
        return;
      }
      
      if (!workDay) {
        console.log(`Рабочий день не найден: Employee ${employeeId}, Date: ${dateStr}`);
        resolve(0);
        return;
      }

      const sessionsQuery = `
        SELECT start_time, end_time, is_active
        FROM office_sessions 
        WHERE employee_id = ? AND DATE(start_time) = ?
        ORDER BY start_time ASC
      `;
      
      db.all(sessionsQuery, [employeeId, dateStr], (err, sessions) => {
        if (err) {
          console.error('Ошибка получения сессий:', err);
          // Используем текущее время как fallback
          const now = new Date();
          const startTime = new Date(now.getTime() - totalMinutes * 60000);
          updateWorkDayRecord(workDay, startTime.toISOString(), now.toISOString(), totalMinutes, employeeId, dateStr, resolve, reject);
          return;
        }

        let actualStartTime = null;
        let actualEndTime = null;
        
        if (sessions.length > 0) {
          actualStartTime = sessions[0].start_time;
          const lastSession = sessions[sessions.length - 1];
          if (lastSession.end_time) {
            actualEndTime = lastSession.end_time;
          } else if (lastSession.is_active) {
            actualEndTime = new Date().toISOString();
          }
        } else if (totalMinutes > 0) {
          const now = new Date();
          const startTime = new Date(now.getTime() - totalMinutes * 60000);
          actualStartTime = startTime.toISOString();
          actualEndTime = now.toISOString();
        }
        
        updateWorkDayRecord(workDay, actualStartTime, actualEndTime, totalMinutes, employeeId, dateStr, resolve, reject);
      });
    });
  });
}

// Функция для обновления записи рабочего дня
function updateWorkDayRecord(workDay, actualStartTime, actualEndTime, totalMinutes, employeeId, dateStr, resolve, reject) {
  let isLate = false;
  let isEarlyLeave = false;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let isPresent = totalMinutes > 0;
  
  if (actualStartTime && workDay.work_start_time) {
    const workStart = new Date(workDay.work_start_time);
    const actualStart = new Date(actualStartTime);
    if (actualStart > workStart) {
      isLate = true;
      lateMinutes = Math.round((actualStart - workStart) / 1000 / 60);
    }
  }
  
  if (actualEndTime && workDay.work_end_time) {
    const workEnd = new Date(workDay.work_end_time);
    const actualEnd = new Date(actualEndTime);
    if (actualEnd < workEnd) {
      isEarlyLeave = true;
      earlyLeaveMinutes = Math.round((workEnd - actualEnd) / 1000 / 60);
    }
  }
  
  const updateQuery = `
    UPDATE work_days SET 
      actual_start_time = ?, actual_end_time = ?, total_minutes = ?, is_present = ?,
      is_late = ?, is_early_leave = ?, late_minutes = ?, early_leave_minutes = ?,
      updated_at = datetime('now')
    WHERE employee_id = ? AND date = ?
  `;
  
  db.run(updateQuery, [
    actualStartTime, actualEndTime, totalMinutes, isPresent ? 1 : 0,
    isLate ? 1 : 0, isEarlyLeave ? 1 : 0, lateMinutes, earlyLeaveMinutes,
    employeeId, dateStr
  ], function(err) {
    if (err) {
      console.error('Ошибка обновления рабочего дня:', err);
      reject(err);
    } else {
      console.log(`Рабочий день обновлен: Employee ${employeeId}, Date: ${dateStr}, Present: ${isPresent}, Late: ${isLate}, Early: ${isEarlyLeave}`);
      resolve(this.changes);
    }
  });
}

// Основная функция обновления
async function updateAllWorkDays() {
  console.log('🔄 Начинаем обновление рабочих дней...');
  
  // Получаем всех сотрудников
  const employees = await new Promise((resolve, reject) => {
    db.all('SELECT id FROM employees', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  // Получаем все рабочие дни
  const workDays = await new Promise((resolve, reject) => {
    db.all('SELECT employee_id, date FROM work_days', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log(`📊 Найдено ${workDays.length} рабочих дней для обновления`);
  
  // Обновляем каждый рабочий день
  for (const workDay of workDays) {
    // Получаем статистику за день
    const stats = await new Promise((resolve, reject) => {
      db.get(
        'SELECT total_minutes FROM daily_stats WHERE employee_id = ? AND date = ?',
        [workDay.employee_id, workDay.date],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    const totalMinutes = stats ? stats.total_minutes : 0;
    await updateWorkDayActualTime(workDay.employee_id, workDay.date, totalMinutes);
  }
  
  console.log('✅ Все рабочие дни обновлены!');
  
  // Показываем статистику
  for (const employee of employees) {
    const stats = await new Promise((resolve, reject) => {
      db.all(
        'SELECT COUNT(*) as total, SUM(CASE WHEN is_present = 1 THEN 1 ELSE 0 END) as present, SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as late, SUM(CASE WHEN is_early_leave = 1 THEN 1 ELSE 0 END) as early FROM work_days WHERE employee_id = ?',
        [employee.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
    
    console.log(`👤 Employee ${employee.id}: ${stats.present}/${stats.total} присутствовал, ${stats.late} опозданий, ${stats.early} ранних уходов`);
  }
  
  db.close();
}

// Запускаем обновление
updateAllWorkDays().catch(console.error);
