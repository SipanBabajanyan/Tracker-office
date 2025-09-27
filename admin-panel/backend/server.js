const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id)
    )`);
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
            isInOffice: false, // Пока не интегрированы с мобильным приложением
            startTime: null,
            totalTimeToday: '0ч 0м',
            lastSeen: 'Никогда'
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
        case 'year':
            dateFilter = 'AND date >= DATE("now", "-365 days")';
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
            const targetMinutes = row.target_hours_per_day * 60;
            const coefficient = targetMinutes > 0 ? (row.total_minutes / targetMinutes * 100) : 0;
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
        case 'year':
            dateFilter = 'AND date >= DATE("now", "-365 days")';
            break;
    }

    const query = `
        SELECT 
            e.target_hours_per_day,
            COALESCE(AVG(ds.total_minutes), 0) as avg_minutes,
            COALESCE(SUM(ds.total_minutes), 0) as total_minutes,
            COUNT(ds.date) as days_count
        FROM employees e
        LEFT JOIN daily_stats ds ON e.id = ds.employee_id ${dateFilter}
        WHERE e.id = ?
        GROUP BY e.id, e.target_hours_per_day
    `;

    db.get(query, [employeeId], (err, row) => {
        if (err) {
            console.error('Ошибка получения коэффициентов:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        const targetMinutes = row.target_hours_per_day * 60;
        const avgCoefficient = targetMinutes > 0 ? (row.avg_minutes / targetMinutes * 100) : 0;
        const totalCoefficient = targetMinutes > 0 ? (row.total_minutes / (targetMinutes * row.days_count) * 100) : 0;
        
        res.json({
            targetHours: row.target_hours_per_day,
            targetMinutes: targetMinutes,
            avgMinutes: Math.round(row.avg_minutes),
            totalMinutes: Math.round(row.total_minutes),
            daysCount: row.days_count,
            avgCoefficient: Math.round(avgCoefficient),
            totalCoefficient: Math.round(totalCoefficient),
            avgTimeDiff: Math.round(row.avg_minutes - targetMinutes),
            totalTimeDiff: Math.round(row.total_minutes - (targetMinutes * row.days_count))
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

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Админ-панель: http://localhost:${PORT}`);
    console.log(`📱 API: http://localhost:${PORT}/api`);
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
