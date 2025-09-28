const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3001', 
    'http://localhost:3000',
    'http://192.168.15.20:3001',
    'http://192.168.15.20:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// База данных SQLite
const db = new sqlite3.Database('./office_tracking.db');

// Инициализация базы данных
db.serialize(() => {
    // Таблица сотрудников
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        device_id TEXT UNIQUE NOT NULL,
        target_hours_per_day INTEGER DEFAULT 8,
        is_in_office BOOLEAN DEFAULT 0,
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Добавляем поля если их нет (игнорируем ошибки если колонки уже существуют)
    db.run(`ALTER TABLE employees ADD COLUMN is_in_office BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Ошибка добавления колонки is_in_office:', err);
        }
    });
    db.run(`ALTER TABLE employees ADD COLUMN last_seen DATETIME`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Ошибка добавления колонки last_seen:', err);
        }
    });

    // Таблица сессий
    db.run(`CREATE TABLE IF NOT EXISTS office_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id)
    )`);

    // Таблица статистики (для быстрых запросов)
    db.run(`CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        date DATE NOT NULL,
        total_minutes INTEGER DEFAULT 0,
        sessions_count INTEGER DEFAULT 0,
        is_in_office BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        UNIQUE(employee_id, date)
    )`);
    
    // Таблица рабочих дней
    db.run(`CREATE TABLE IF NOT EXISTS work_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        date DATE NOT NULL,
        work_start_time DATETIME,
        work_end_time DATETIME,
        actual_start_time DATETIME,
        actual_end_time DATETIME,
        total_minutes INTEGER DEFAULT 0,
        is_present BOOLEAN DEFAULT 0,
        is_late BOOLEAN DEFAULT 0,
        is_early_leave BOOLEAN DEFAULT 0,
        late_minutes INTEGER DEFAULT 0,
        early_leave_minutes INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        UNIQUE(employee_id, date)
    )`);
    
    // Добавляем поле is_in_office если его нет (игнорируем ошибки если колонка уже существует)
    db.run(`ALTER TABLE daily_stats ADD COLUMN is_in_office BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Ошибка добавления колонки is_in_office в daily_stats:', err);
        }
    });
    
    // Уникальный индекс не нужен - используем программную логику для предотвращения дублирования
});

// API Routes

// Получить всех сотрудников
app.get('/api/employees', (req, res) => {
    // Простой запрос для начала - получаем всех сотрудников
    const query = 'SELECT * FROM employees ORDER BY name';
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения сотрудников:', err);
            return res.status(500).json({ error: 'Ошибка базы данных: ' + err.message });
        }

        const employees = rows.map(row => ({
            id: row.id,
            name: row.name || '',
            deviceId: row.device_id || 'Неизвестно',
            isInOffice: Boolean(row.is_in_office),
            startTime: null,
            totalTimeToday: '0ч 0м',
            lastSeen: row.last_seen ? new Date(row.last_seen).toLocaleString('ru-RU') : 'Никогда'
        }));

        res.json(employees);
    });
});

// Получить статистику
app.get('/api/stats', (req, res) => {
    const queries = {
        totalEmployees: 'SELECT COUNT(*) as count FROM employees',
        inOfficeNow: 'SELECT COUNT(*) as count FROM office_sessions WHERE is_active = 1',
        avgTimeToday: `
            SELECT AVG(total_minutes) as avg_minutes 
            FROM daily_stats 
            WHERE date = DATE('now')
        `,
        totalTimeToday: `
            SELECT SUM(total_minutes) as total_minutes 
            FROM daily_stats 
            WHERE date = DATE('now'
        )`
    };

    const stats = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], [], (err, row) => {
            if (err) {
                console.error(`Ошибка получения статистики ${key}:`, err);
                stats[key] = 0;
            } else {
                if (key === 'avgTimeToday' || key === 'totalTimeToday') {
                    stats[key] = row.avg_minutes || row.total_minutes || 0;
                } else {
                    stats[key] = row.count || 0;
                }
            }

            completed++;
            if (completed === total) {
                // Форматируем время
                stats.avgTimeToday = (stats.avgTimeToday / 60).toFixed(1);
                stats.totalTimeToday = (stats.totalTimeToday / 60).toFixed(1);
                res.json(stats);
            }
        });
    });
});

// Добавить сотрудника
app.post('/api/employees', (req, res) => {
    const { name, deviceId } = req.body;

    if (!name || !deviceId) {
        return res.status(400).json({ error: 'Имя и ID устройства обязательны' });
    }

    const query = 'INSERT INTO employees (name, device_id) VALUES (?, ?)';
    db.run(query, [name, deviceId], function(err) {
        if (err) {
            console.error('Ошибка добавления сотрудника:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        res.json({ 
            id: this.lastID, 
            message: 'Сотрудник добавлен успешно' 
        });
    });
});

// Обновить имя сотрудника
app.put('/api/employees/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Имя обязательно' });
    }

    const query = 'UPDATE employees SET name = ? WHERE id = ?';
    db.run(query, [name, id], function(err) {
        if (err) {
            console.error('Ошибка обновления сотрудника:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        res.json({ message: 'Имя сотрудника обновлено' });
    });
});

// Функция для управления сессиями в office_sessions
function manageOfficeSession(employeeId, isInOffice, totalMinutes) {
    // Проверяем, есть ли активная сессия для сотрудника
    const checkActiveSessionQuery = `
        SELECT id, start_time FROM office_sessions 
        WHERE employee_id = ? AND is_active = 1
        ORDER BY created_at DESC LIMIT 1
    `;
    
    db.get(checkActiveSessionQuery, [employeeId], (err, activeSession) => {
        if (err) {
            console.error('Ошибка проверки активной сессии:', err);
            return;
        }
        
        if (activeSession) {
            // Есть активная сессия
            if (isInOffice) {
                // Сотрудник все еще в офисе - не создаем новую сессию
                console.log(`Активная сессия уже существует для Employee ${employeeId}, не создаем новую`);
            } else {
                // Сотрудник ушел - закрываем активную сессию
                const closeSessionQuery = `
                    UPDATE office_sessions 
                    SET end_time = datetime('now'), is_active = 0
                    WHERE id = ?
                `;
                
                db.run(closeSessionQuery, [activeSession.id], function(err) {
                    if (err) {
                        console.error('Ошибка закрытия сессии:', err);
                    } else {
                        console.log(`Сессия закрыта: Employee ${employeeId}, Session ID: ${activeSession.id}`);
                    }
                });
            }
        } else {
            // Нет активной сессии
            if (isInOffice && totalMinutes > 0) {
                // Сотрудник в офисе - создаем новую сессию
                const now = new Date();
                const startTime = new Date(now.getTime() - totalMinutes * 60 * 1000);
                
                const createSessionQuery = `
                    INSERT INTO office_sessions (employee_id, start_time, end_time, is_active)
                    VALUES (?, ?, ?, ?)
                `;
                
                db.run(createSessionQuery, [
                    employeeId, 
                    startTime.toISOString(), 
                    null, // end_time = null для активной сессии
                    1 // is_active = 1
                ], function(err) {
                    if (err) {
                        console.error('Ошибка создания сессии:', err);
                    } else {
                        console.log(`Новая сессия создана: Employee ${employeeId}, Start: ${startTime.toISOString()}`);
                    }
                });
            }
        }
    });
}

// Отправить сессию сотрудника (вызывается мобильным приложением)
app.post('/api/employee/:id/session', async (req, res) => {
    const employeeId = req.params.id;
    const { date, totalMinutes, isInOffice } = req.body;

    if (!date || typeof totalMinutes !== 'number' || typeof isInOffice !== 'boolean') {
        return res.status(400).json({ error: 'Неверные данные' });
    }

    try {
        // Проверяем, является ли день рабочим
        if (isWorkingDay(date)) {
            // Создаем запись рабочего дня, если её нет
            await createWorkDay(employeeId, date);
            
            // Обновляем фактическое время прихода/ухода
            await updateWorkDayActualTime(employeeId, date, totalMinutes);
        }

        // Обновляем daily_stats (существующая логика)
        const updateQuery = `
            UPDATE daily_stats 
            SET total_minutes = ?, is_in_office = ?
            WHERE employee_id = ? AND date = ?
        `;
        
        db.run(updateQuery, [totalMinutes, isInOffice ? 1 : 0, employeeId, date], function(err) {
            if (err) {
                console.error('Ошибка обновления сессии:', err);
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }
            
            if (this.changes > 0) {
                // Запись обновлена
                console.log(`Сессия обновлена: Employee ${employeeId}, Date: ${date}, Minutes: ${totalMinutes}, InOffice: ${isInOffice}`);
                updateEmployeeStatus();
            } else {
                // Записи нет, создаем новую
                const insertQuery = `
                    INSERT INTO daily_stats (employee_id, date, total_minutes, is_in_office)
                    VALUES (?, ?, ?, ?)
                `;
                
                db.run(insertQuery, [employeeId, date, totalMinutes, isInOffice ? 1 : 0], function(err) {
                    if (err) {
                        console.error('Ошибка создания сессии:', err);
                        return res.status(500).json({ error: 'Ошибка базы данных' });
                    }
                    
                    console.log(`Сессия создана: Employee ${employeeId}, Date: ${date}, Minutes: ${totalMinutes}, InOffice: ${isInOffice}`);
                    updateEmployeeStatus();
                });
            }
        });

        // Управляем сессиями в office_sessions
        manageOfficeSession(employeeId, isInOffice, totalMinutes);

        function updateEmployeeStatus() {
            // Обновляем статус сотрудника
            const updateEmployeeQuery = `
                UPDATE employees 
                SET is_in_office = ?, last_seen = datetime('now')
                WHERE id = ?
            `;
            
            db.run(updateEmployeeQuery, [isInOffice ? 1 : 0, employeeId], function(err) {
                if (err) {
                    console.error('Ошибка обновления статуса сотрудника:', err);
                    return res.status(500).json({ error: 'Ошибка базы данных' });
                }

                res.json({ message: 'Сессия сохранена успешно' });
            });
        }
    } catch (error) {
        console.error('Ошибка обработки сессии:', error);
        res.status(500).json({ error: 'Ошибка обработки сессии' });
    }
});

// Обновить статус сотрудника (вызывается мобильным приложением)
app.post('/api/tracking/status', (req, res) => {
    const { deviceId, isInOffice } = req.body;

    if (!deviceId || typeof isInOffice !== 'boolean') {
        return res.status(400).json({ error: 'Неверные данные' });
    }

    // Находим сотрудника по device_id
    db.get('SELECT id FROM employees WHERE device_id = ?', [deviceId], (err, employee) => {
        if (err) {
            console.error('Ошибка поиска сотрудника:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (!employee) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        const employeeId = employee.id;

        if (isInOffice) {
            // Начинаем новую сессию
            const query = 'INSERT INTO office_sessions (employee_id, start_time, is_active) VALUES (?, ?, 1)';
            db.run(query, [employeeId, new Date().toISOString()], function(err) {
                if (err) {
                    console.error('Ошибка начала сессии:', err);
                    return res.status(500).json({ error: 'Ошибка базы данных' });
                }
                res.json({ message: 'Сессия начата' });
            });
        } else {
            // Завершаем активную сессию
            const query = `
                UPDATE office_sessions 
                SET end_time = ?, is_active = 0 
                WHERE employee_id = ? AND is_active = 1
            `;
            db.run(query, [new Date().toISOString(), employeeId], function(err) {
                if (err) {
                    console.error('Ошибка завершения сессии:', err);
                    return res.status(500).json({ error: 'Ошибка базы данных' });
                }
                res.json({ message: 'Сессия завершена' });
            });
        }
    });
});

// Экспорт данных в CSV
app.get('/api/export/csv', (req, res) => {
    const { startDate, endDate } = req.query;
    
    let query = `
        SELECT 
            e.name,
            e.device_id,
            os.start_time,
            os.end_time,
            os.is_active,
            os.created_at
        FROM employees e
        LEFT JOIN office_sessions os ON e.id = os.employee_id
        WHERE 1=1
    `;
    
    const params = [];
    if (startDate) {
        query += ' AND DATE(os.start_time) >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND DATE(os.start_time) <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY os.start_time DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Ошибка экспорта:', err);
            return res.status(500).json({ error: 'Ошибка экспорта' });
        }

        // Формируем CSV
        let csv = 'Имя,ID устройства,Начало,Конец,Активна,Создано\n';
        rows.forEach(row => {
            csv += `"${row.name}","${row.device_id}","${row.start_time || ''}","${row.end_time || ''}","${row.is_active ? 'Да' : 'Нет'}","${row.created_at}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="office_tracking.csv"');
        res.send(csv);
    });
});

// Обновить статистику (вызывается периодически)
app.post('/api/stats/update', (req, res) => {
    const query = `
        INSERT OR REPLACE INTO daily_stats (employee_id, date, total_minutes, sessions_count)
        SELECT 
            e.id,
            DATE('now'),
            COALESCE(SUM(
                CASE 
                    WHEN os.end_time IS NOT NULL 
                    THEN (julianday(os.end_time) - julianday(os.start_time)) * 24 * 60
                    ELSE (julianday('now') - julianday(os.start_time)) * 24 * 60
                END
            ), 0) as total_minutes,
            COUNT(os.id) as sessions_count
        FROM employees e
        LEFT JOIN office_sessions os ON e.id = os.employee_id 
            AND DATE(os.start_time) = DATE('now')
        GROUP BY e.id
    `;

    db.run(query, [], function(err) {
        if (err) {
            console.error('Ошибка обновления статистики:', err);
            return res.status(500).json({ error: 'Ошибка обновления статистики' });
        }
        res.json({ message: 'Статистика обновлена' });
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Вспомогательная функция для форматирования времени
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
}

// Функция для определения рабочих дней (понедельник-пятница)
function isWorkingDay(dateStr) {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Понедельник-пятница
}

// Функция для создания записи рабочего дня
function createWorkDay(employeeId, dateStr, workStartTime = null, workEndTime = null) {
    return new Promise((resolve, reject) => {
        // Если время не указано, получаем индивидуальное время сотрудника
        if (!workStartTime || !workEndTime) {
            const query = 'SELECT default_work_start, default_work_end FROM employees WHERE id = ?';
            db.get(query, [employeeId], (err, employee) => {
                if (err) {
                    console.error('Ошибка получения рабочего времени сотрудника:', err);
                    reject(err);
                    return;
                }
                
                const startTime = workStartTime || employee?.default_work_start || '10:00';
                const endTime = workEndTime || employee?.default_work_end || '19:00';
                createWorkDayRecord(employeeId, dateStr, startTime, endTime, resolve, reject);
            });
        } else {
            createWorkDayRecord(employeeId, dateStr, workStartTime, workEndTime, resolve, reject);
        }
    });
}

// Вспомогательная функция для создания записи рабочего дня
function createWorkDayRecord(employeeId, dateStr, workStartTime, workEndTime, resolve, reject) {
    const workStartDateTime = `${dateStr} ${workStartTime}:00`;
    const workEndDateTime = `${dateStr} ${workEndTime}:00`;
    
    const query = `
        INSERT OR IGNORE INTO work_days 
        (employee_id, date, work_start_time, work_end_time, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    
    db.run(query, [employeeId, dateStr, workStartDateTime, workEndDateTime], function(err) {
        if (err) {
            console.error('Ошибка создания рабочего дня:', err);
            reject(err);
        } else {
            console.log(`Рабочий день создан: Employee ${employeeId}, Date: ${dateStr}, Time: ${workStartTime}-${workEndTime}`);
            resolve(this.lastID);
        }
    });
}

// Функция для обновления фактического времени прихода/ухода
function updateWorkDayActualTime(employeeId, dateStr, totalMinutes = 0) {
    return new Promise((resolve, reject) => {
        // Получаем данные рабочего дня
        const getQuery = 'SELECT * FROM work_days WHERE employee_id = ? AND date = ?';
        db.get(getQuery, [employeeId, dateStr], (err, workDay) => {
            if (err) {
                console.error('Ошибка получения рабочего дня:', err);
                reject(err);
                return;
            }
            
            if (!workDay) {
                console.log(`Рабочий день не найден для Employee ${employeeId}, Date: ${dateStr}`);
                resolve(null);
                return;
            }
            
            // Получаем все сессии за день для определения первого входа и последнего выхода
            const sessionsQuery = `
                SELECT start_time, end_time, is_active
                FROM office_sessions 
                WHERE employee_id = ? AND DATE(start_time) = ?
                ORDER BY start_time ASC
            `;
            
            db.all(sessionsQuery, [employeeId, dateStr], (err, sessions) => {
                if (err) {
                    console.error('Ошибка получения сессий:', err);
                    // Если нет таблицы office_sessions, используем текущее время как приблизительное
                    console.log('Используем текущее время как приблизительное время входа');
                    const now = new Date().toISOString();
                    updateWorkDayRecord(workDay, now, now, totalMinutes, employeeId, dateStr, resolve, reject);
                    return;
                }
                
                // Определяем первый вход и последний выход
                let actualStartTime = null;
                let actualEndTime = null;
                
                if (sessions.length > 0) {
                    // Первый вход - время первой сессии
                    actualStartTime = sessions[0].start_time;
                    
                    // Последний выход - время последней завершенной сессии или текущее время если сессия активна
                    const lastSession = sessions[sessions.length - 1];
                    if (lastSession.end_time) {
                        actualEndTime = lastSession.end_time;
                    } else if (lastSession.is_active) {
                        actualEndTime = new Date().toISOString();
                    }
                } else {
                    // Если нет сессий, но есть время в офисе, используем приблизительное время
                    if (totalMinutes > 0) {
                        const now = new Date();
                        const startTime = new Date(now.getTime() - totalMinutes * 60000);
                        actualStartTime = startTime.toISOString();
                        actualEndTime = now.toISOString();
                    }
                }
                
                updateWorkDayRecord(workDay, actualStartTime, actualEndTime, totalMinutes, employeeId, dateStr, resolve, reject);
            });
        });
    });
}

// Вспомогательная функция для обновления записи рабочего дня
function updateWorkDayRecord(workDay, actualStartTime, actualEndTime, totalMinutes, employeeId, dateStr, resolve, reject) {
    // Рассчитываем опоздания и ранние уходы
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
    
    // Обновляем запись
    const updateQuery = `
        UPDATE work_days SET 
            actual_start_time = ?,
            actual_end_time = ?,
            total_minutes = ?,
            is_present = ?,
            is_late = ?,
            is_early_leave = ?,
            late_minutes = ?,
            early_leave_minutes = ?,
            updated_at = datetime('now')
        WHERE employee_id = ? AND date = ?
    `;
    
    db.run(updateQuery, [
        actualStartTime,
        actualEndTime,
        totalMinutes,
        isPresent ? 1 : 0,
        isLate ? 1 : 0,
        isEarlyLeave ? 1 : 0,
        lateMinutes,
        earlyLeaveMinutes,
        employeeId,
        dateStr
    ], function(err) {
        if (err) {
            console.error('Ошибка обновления рабочего дня:', err);
            reject(err);
        } else {
            console.log(`Рабочий день обновлен: Employee ${employeeId}, Date: ${dateStr}`);
            resolve(this.changes);
        }
    });
}

// Функция расчета коэффициента с учетом рабочих дней
function calculateCoefficient(totalMinutes, targetHoursPerDay, dateStr) {
    const targetMinutes = targetHoursPerDay * 60;
    
    if (isWorkingDay(dateStr)) {
        // Рабочие дни: обычный расчет
        return targetMinutes > 0 ? (totalMinutes / targetMinutes * 100) : 0;
    } else {
        // Нерабочие дни: 100% базовая ставка + процент от целевых часов
        if (targetMinutes > 0 && totalMinutes > 0) {
            return 100 + (totalMinutes / targetMinutes * 100);
        } else if (totalMinutes > 0) {
            // Если есть работа, но нет целевых часов - базовая ставка 100%
            return 100;
        } else {
            // Если нет работы - 0%
            return 0;
        }
    }
}

        // Получить историю сотрудника
        app.get('/api/employee/:id/history', (req, res) => {
            const employeeId = req.params.id;
            const period = req.query.period || 'today';
            
            let dateFilter = '';
            switch(period) {
                case 'today':
                    dateFilter = 'AND date = DATE("now")';
                    break;
                case 'week':
                    dateFilter = 'AND date >= DATE("now", "-7 days")';
                    break;
                case 'month':
                    dateFilter = 'AND date >= DATE("now", "-30 days")';
                    break;
                case 'quarter':
                    dateFilter = 'AND date >= DATE("now", "-90 days")';
                    break;
                case '6months':
                    dateFilter = 'AND date >= DATE("now", "-180 days")';
                    break;
                case 'year':
                    dateFilter = 'AND date >= DATE("now", "-365 days")';
                    break;
                case 'alltime':
                    // Все время - без фильтра по дате
                    dateFilter = '';
                    break;
            }

    const query = `
        SELECT 
            ds.date,
            ds.total_minutes,
            e.target_hours_per_day,
            CASE 
                WHEN ds.total_minutes > 0 THEN 'В офисе'
                ELSE 'Вне офиса'
            END as status
        FROM daily_stats ds
        JOIN employees e ON ds.employee_id = e.id
        WHERE ds.employee_id = ? ${dateFilter}
        ORDER BY ds.date DESC
    `;

    db.all(query, [employeeId], (err, rows) => {
        if (err) {
            console.error('Ошибка получения истории сотрудника:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        const history = rows.map(row => {
            const targetMinutes = isWorkingDay(row.date) ? row.target_hours_per_day * 60 : 0;
            const coefficient = calculateCoefficient(row.total_minutes, row.target_hours_per_day, row.date);
            const timeDiff = row.total_minutes - targetMinutes;
            
            return {
                date: row.date,
                time: formatTime(row.total_minutes),
                status: row.status,
                targetTime: formatTime(targetMinutes),
                coefficient: Math.round(coefficient),
                timeDiff: timeDiff > 0 ? `+${formatTime(timeDiff)}` : formatTime(timeDiff),
                timeDiffMinutes: timeDiff
            };
        });

        res.json(history);
    });
});

// Получить сессии сотрудника
app.get('/api/employee/:id/sessions', (req, res) => {
    const employeeId = req.params.id;
    const period = req.query.period || 'today';
    
    let dateFilter = '';
    switch(period) {
        case 'today':
            dateFilter = 'AND DATE(created_at) = DATE("now")';
            break;
        case 'week':
            dateFilter = 'AND DATE(created_at) >= DATE("now", "-7 days")';
            break;
        case 'month':
            dateFilter = 'AND DATE(created_at) >= DATE("now", "-30 days")';
            break;
        case 'quarter':
            dateFilter = 'AND DATE(created_at) >= DATE("now", "-90 days")';
            break;
        case '6months':
            dateFilter = 'AND DATE(created_at) >= DATE("now", "-180 days")';
            break;
        case 'year':
            dateFilter = 'AND DATE(created_at) >= DATE("now", "-365 days")';
            break;
        case 'alltime':
            // Все время - без фильтра по дате
            dateFilter = '';
            break;
    }

    const query = `
        SELECT 
            id,
            employee_id,
            start_time,
            end_time,
            is_active,
            created_at,
            CASE 
                WHEN end_time IS NOT NULL THEN 
                    ROUND((julianday(end_time) - julianday(start_time)) * 24 * 60)
                WHEN is_active = 1 THEN 
                    ROUND((julianday('now') - julianday(start_time)) * 24 * 60)
                ELSE 0
            END as total_minutes
        FROM office_sessions 
        WHERE employee_id = ? ${dateFilter}
        ORDER BY created_at DESC
    `;
    
    db.all(query, [employeeId], (err, rows) => {
        if (err) {
            console.error('Ошибка получения сессий:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        const sessions = rows.map(row => ({
            id: row.id,
            employeeId: row.employee_id,
            startTime: row.start_time,
            endTime: row.end_time,
            totalMinutes: row.total_minutes,
            createdAt: row.created_at,
            duration: formatTime(row.total_minutes)
        }));

        res.json(sessions);
    });
});

        // Получить коэффициенты сотрудника
        app.get('/api/employee/:id/coefficients', (req, res) => {
            const employeeId = req.params.id;
            const period = req.query.period || 'today';
            
            let dateFilter = '';
            switch(period) {
                case 'today':
                    dateFilter = 'AND date = DATE("now")';
                    break;
                case 'week':
                    dateFilter = 'AND date >= DATE("now", "-7 days")';
                    break;
                case 'month':
                    dateFilter = 'AND date >= DATE("now", "-30 days")';
                    break;
                case 'quarter':
                    dateFilter = 'AND date >= DATE("now", "-90 days")';
                    break;
                case '6months':
                    dateFilter = 'AND date >= DATE("now", "-180 days")';
                    break;
                case 'year':
                    dateFilter = 'AND date >= DATE("now", "-365 days")';
                    break;
                case 'alltime':
                    // Все время - без фильтра по дате
                    dateFilter = '';
                    break;
            }

    const query = `
        SELECT 
            e.target_hours_per_day,
            ds.date,
            ds.total_minutes
        FROM employees e
        LEFT JOIN daily_stats ds ON e.id = ds.employee_id ${dateFilter}
        WHERE e.id = ?
        ORDER BY ds.date
    `;

    db.all(query, [employeeId], (err, rows) => {
        if (err) {
            console.error('Ошибка получения коэффициентов:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        const targetHoursPerDay = rows[0].target_hours_per_day;
        const targetMinutes = targetHoursPerDay * 60;
        
        // Рассчитываем коэффициенты с учетом рабочих дней
        let totalMinutes = 0;
        let totalTargetMinutes = 0;
        let totalCoefficient = 0;
        let workingDaysCount = 0;
        let weekendDaysCount = 0;
        
        rows.forEach(row => {
            if (row.date && row.total_minutes !== null && row.total_minutes !== undefined) {
                totalMinutes += parseFloat(row.total_minutes) || 0;
                
                if (isWorkingDay(row.date)) {
                    // Рабочие дни: добавляем к целевому времени
                    totalTargetMinutes += targetMinutes;
                    workingDaysCount++;
                } else {
                    // Нерабочие дни: не добавляем к целевому времени
                    weekendDaysCount++;
                }
                
                // Добавляем коэффициент дня
                const dayCoefficient = calculateCoefficient(parseFloat(row.total_minutes) || 0, targetHoursPerDay, row.date);
                totalCoefficient += dayCoefficient;
            }
        });
        
        const avgMinutes = rows.length > 0 ? totalMinutes / rows.length : 0;
        const avgCoefficient = rows.length > 0 ? totalCoefficient / rows.length : 0;
        const totalTimeDiff = Math.round(totalMinutes - totalTargetMinutes);
        
        res.json({
            targetHours: targetHoursPerDay,
            targetMinutes: targetMinutes,
            totalTargetMinutes: totalTargetMinutes, // Общее целевое время за период (только рабочие дни)
            avgMinutes: Math.round(avgMinutes),
            totalMinutes: Math.round(totalMinutes),
            daysCount: rows.length,
            workingDaysCount: workingDaysCount,
            weekendDaysCount: weekendDaysCount,
            avgCoefficient: Math.round(avgCoefficient),
            totalCoefficient: Math.round(totalCoefficient),
            avgTimeDiff: Math.round(avgMinutes - targetMinutes),
            totalTimeDiff: totalTimeDiff // Разница времени за весь период
        });
    });
});

// Получить детальную историю дня сотрудника
app.get('/api/employee/:id/day/:date', (req, res) => {
    const employeeId = req.params.id;
    const date = req.params.date;
    
    // Получаем все сессии за день из office_sessions
    const sessionsQuery = `
        SELECT 
            id,
            start_time,
            end_time,
            is_active,
            created_at
        FROM office_sessions 
        WHERE employee_id = ? 
        AND DATE(start_time) = ?
        ORDER BY start_time ASC
    `;
    
    db.all(sessionsQuery, [employeeId, date], (err, sessions) => {
        if (err) {
            console.error('Ошибка получения сессий дня:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        // Получаем общую статистику за день
        const statsQuery = `
            SELECT 
                total_minutes,
                is_in_office
            FROM daily_stats 
            WHERE employee_id = ? AND date = ?
        `;
        
        db.get(statsQuery, [employeeId, date], (err, stats) => {
            if (err) {
                console.error('Ошибка получения статистики дня:', err);
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }
            
            // Обрабатываем сессии
            const processedSessions = sessions.map(session => {
                const startTime = new Date(session.start_time);
                const endTime = session.end_time ? new Date(session.end_time) : null;
                const duration = endTime ? Math.round((endTime - startTime) / 1000 / 60) : 0; // в минутах
                
                return {
                    id: session.id,
                    startTime: session.start_time,
                    endTime: session.end_time,
                    startTimeFormatted: startTime.toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }),
                    endTimeFormatted: endTime ? endTime.toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }) : 'Активна',
                    duration: duration,
                    durationFormatted: formatTime(duration),
                    isActive: session.is_active === 1
                };
            });
            
            // Рассчитываем общее время
            const totalMinutes = stats ? stats.total_minutes : 0;
            const isInOffice = stats ? stats.is_in_office === 1 : false;
            
            res.json({
                date: date,
                sessions: processedSessions,
                totalMinutes: totalMinutes,
                totalTimeFormatted: formatTime(totalMinutes),
                isInOffice: isInOffice,
                sessionsCount: sessions.length
            });
        });
    });
});

// Обновить целевые часы сотрудника
app.put('/api/employee/:id/target-hours', (req, res) => {
    const { id } = req.params;
    const { targetHours } = req.body;

    if (!targetHours || targetHours < 0 || targetHours > 24) {
        return res.status(400).json({ error: 'Целевые часы должны быть от 0 до 24' });
    }

    const query = 'UPDATE employees SET target_hours_per_day = ? WHERE id = ?';
    db.run(query, [targetHours, id], function(err) {
        if (err) {
            console.error('Ошибка обновления целевых часов:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        res.json({ message: 'Целевые часы обновлены', targetHours });
    });
});

// Получить рабочие дни сотрудника
app.get('/api/employee/:id/work-days', (req, res) => {
    const employeeId = req.params.id;
    const { startDate, endDate } = req.query;
    
    let query = `
        SELECT 
            wd.*,
            e.name as employee_name
        FROM work_days wd
        JOIN employees e ON wd.employee_id = e.id
        WHERE wd.employee_id = ?
    `;
    
    const params = [employeeId];
    
    if (startDate) {
        query += ' AND wd.date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND wd.date <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY wd.date DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Ошибка получения рабочих дней:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        const workDays = rows.map(row => ({
            id: row.id,
            date: row.date,
            workStartTime: row.work_start_time,
            workEndTime: row.work_end_time,
            actualStartTime: row.actual_start_time,
            actualEndTime: row.actual_end_time,
            totalMinutes: row.total_minutes,
            isPresent: Boolean(row.is_present),
            isLate: Boolean(row.is_late),
            isEarlyLeave: Boolean(row.is_early_leave),
            lateMinutes: row.late_minutes,
            earlyLeaveMinutes: row.early_leave_minutes,
            notes: row.notes,
            status: getWorkDayStatus(row),
            employeeName: row.employee_name
        }));
        
        res.json(workDays);
    });
});

// Получить рабочий день по дате
app.get('/api/employee/:id/work-day/:date', (req, res) => {
    const employeeId = req.params.id;
    const date = req.params.date;
    
    const query = `
        SELECT 
            wd.*,
            e.name as employee_name
        FROM work_days wd
        JOIN employees e ON wd.employee_id = e.id
        WHERE wd.employee_id = ? AND wd.date = ?
    `;
    
    db.get(query, [employeeId, date], (err, row) => {
        if (err) {
            console.error('Ошибка получения рабочего дня:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Рабочий день не найден' });
        }
        
        const workDay = {
            id: row.id,
            date: row.date,
            workStartTime: row.work_start_time,
            workEndTime: row.work_end_time,
            actualStartTime: row.actual_start_time,
            actualEndTime: row.actual_end_time,
            totalMinutes: row.total_minutes,
            isPresent: Boolean(row.is_present),
            isLate: Boolean(row.is_late),
            isEarlyLeave: Boolean(row.is_early_leave),
            lateMinutes: row.late_minutes,
            earlyLeaveMinutes: row.early_leave_minutes,
            notes: row.notes,
            status: getWorkDayStatus(row),
            employeeName: row.employee_name
        };
        
        res.json(workDay);
    });
});

// Обновить рабочее время для дня
app.put('/api/employee/:id/work-day/:date', (req, res) => {
    const employeeId = req.params.id;
    const date = req.params.date;
    const { workStartTime, workEndTime, notes } = req.body;
    
    const workStartDateTime = workStartTime ? `${date} ${workStartTime}:00` : null;
    const workEndDateTime = workEndTime ? `${date} ${workEndTime}:00` : null;
    
    const query = `
        UPDATE work_days SET 
            work_start_time = ?,
            work_end_time = ?,
            notes = ?,
            updated_at = datetime('now')
        WHERE employee_id = ? AND date = ?
    `;
    
    db.run(query, [workStartDateTime, workEndDateTime, notes, employeeId, date], function(err) {
        if (err) {
            console.error('Ошибка обновления рабочего дня:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Рабочий день не найден' });
        }
        
        res.json({ message: 'Рабочий день обновлен' });
    });
});

// Получить рабочее расписание сотрудника
app.get('/api/employee/:id/work-schedule', (req, res) => {
    const employeeId = req.params.id;
    
    const query = 'SELECT default_work_start, default_work_end FROM employees WHERE id = ?';
    
    db.get(query, [employeeId], (err, row) => {
        if (err) {
            console.error('Ошибка получения рабочего расписания:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }
        
        res.json({
            defaultWorkStart: row.default_work_start || '10:00',
            defaultWorkEnd: row.default_work_end || '19:00'
        });
    });
});

// Обновить рабочее расписание сотрудника
app.put('/api/employee/:id/work-schedule', (req, res) => {
    const employeeId = req.params.id;
    const { defaultWorkStart, defaultWorkEnd } = req.body;
    
    const query = `
        UPDATE employees SET 
            default_work_start = ?,
            default_work_end = ?
        WHERE id = ?
    `;
    
    db.run(query, [defaultWorkStart, defaultWorkEnd, employeeId], function(err) {
        if (err) {
            console.error('Ошибка обновления рабочего расписания:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }
        
        res.json({ message: 'Рабочее расписание обновлено' });
    });
});

// Функция для определения статуса рабочего дня
function getWorkDayStatus(workDay) {
    if (!workDay.is_present) return 'Отсутствовал';
    if (workDay.is_late && workDay.is_early_leave) return 'Опоздал и ушел раньше';
    if (workDay.is_late) return 'Опоздал';
    if (workDay.is_early_leave) return 'Ушел раньше';
    return 'Время соблюдено';
}

// Функция для автоматического создания рабочих дней
function createWorkDaysForAllEmployees() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Проверяем, является ли сегодня рабочим днем
    if (!isWorkingDay(todayStr)) {
        console.log(`📅 ${todayStr} - выходной день, рабочие дни не создаются`);
        return;
    }
    
    console.log(`🕐 Создание рабочих дней для ${todayStr}...`);
    
    // Получаем всех сотрудников
    db.all('SELECT id, default_work_start, default_work_end FROM employees', (err, employees) => {
        if (err) {
            console.error('Ошибка получения списка сотрудников:', err);
            return;
        }
        
        let createdCount = 0;
        let existingCount = 0;
        
        employees.forEach((employee, index) => {
            const workStartTime = employee.default_work_start || '10:00';
            const workEndTime = employee.default_work_end || '19:00';
            
            // Проверяем, существует ли уже запись для этого сотрудника на сегодня
            db.get(
                'SELECT id FROM work_days WHERE employee_id = ? AND date = ?',
                [employee.id, todayStr],
                (err, existing) => {
                    if (err) {
                        console.error(`Ошибка проверки существующей записи для сотрудника ${employee.id}:`, err);
                        return;
                    }
                    
                    if (existing) {
                        existingCount++;
                        console.log(`👤 Сотрудник ${employee.id}: запись уже существует`);
                    } else {
                        // Создаем новую запись рабочего дня
                        const workStartDateTime = `${todayStr} ${workStartTime}:00`;
                        const workEndDateTime = `${todayStr} ${workEndTime}:00`;
                        
                        db.run(
                            'INSERT INTO work_days (employee_id, date, work_start_time, work_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
                            [employee.id, todayStr, workStartDateTime, workEndDateTime],
                            function(err) {
                                if (err) {
                                    console.error(`Ошибка создания рабочего дня для сотрудника ${employee.id}:`, err);
                                } else {
                                    createdCount++;
                                    console.log(`✅ Создан рабочий день: Сотрудник ${employee.id}, ${todayStr}, ${workStartTime}-${workEndTime}`);
                                }
                                
                                // Проверяем, обработаны ли все сотрудники
                                if (index === employees.length - 1) {
                                    console.log(`📊 Итого: создано ${createdCount} новых записей, ${existingCount} уже существовало`);
                                }
                            }
                        );
                    }
                }
            );
        });
    });
}

// Настройка cron job - каждый день в 00:00
cron.schedule('0 0 * * *', () => {
    console.log('⏰ Cron job: Создание рабочих дней на сегодня');
    createWorkDaysForAllEmployees();
}, {
    timezone: "Europe/Moscow"
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Админ-панель: http://localhost:${PORT}`);
    console.log(`📱 API: http://localhost:${PORT}/api`);
    console.log(`⏰ Cron job настроен: создание рабочих дней каждый день в 00:00`);
    
    // Создаем рабочие дни на сегодня при запуске (если это рабочий день)
    createWorkDaysForAllEmployees();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Завершение работы сервера...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка закрытия базы данных:', err);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});
