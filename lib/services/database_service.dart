import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/office_session.dart';

/// Сервис для работы с базой данных
class DatabaseService {
  static Database? _database;
  static const String _tableName = 'office_sessions';

  /// Получает экземпляр базы данных
  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  /// Инициализирует базу данных
  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'office_tracker.db');
    
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  /// Создает таблицы при первом запуске
  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE $_tableName (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        is_active INTEGER NOT NULL DEFAULT 0,
        notes TEXT
      )
    ''');
  }

  /// Добавляет новую сессию
  Future<int> insertSession(OfficeSession session) async {
    final db = await database;
    return await db.insert(_tableName, session.toMap());
  }

  /// Обновляет существующую сессию
  Future<int> updateSession(OfficeSession session) async {
    final db = await database;
    return await db.update(
      _tableName,
      session.toMap(),
      where: 'id = ?',
      whereArgs: [session.id],
    );
  }

  /// Получает все сессии
  Future<List<OfficeSession>> getAllSessions() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      _tableName,
      orderBy: 'start_time DESC',
    );
    return List.generate(maps.length, (i) => OfficeSession.fromMap(maps[i]));
  }

  /// Получает активную сессию
  Future<OfficeSession?> getActiveSession() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      _tableName,
      where: 'is_active = ?',
      whereArgs: [1],
      limit: 1,
    );
    
    if (maps.isEmpty) return null;
    return OfficeSession.fromMap(maps.first);
  }

  /// Получает сессии за определенный день
  Future<List<OfficeSession>> getSessionsForDay(DateTime date) async {
    final db = await database;
    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));
    
    final List<Map<String, dynamic>> maps = await db.query(
      _tableName,
      where: 'start_time >= ? AND start_time < ?',
      whereArgs: [startOfDay.toIso8601String(), endOfDay.toIso8601String()],
      orderBy: 'start_time ASC',
    );
    
    return List.generate(maps.length, (i) => OfficeSession.fromMap(maps[i]));
  }

  /// Получает общее время работы за день
  Future<Duration> getTotalTimeForDay(DateTime date) async {
    final sessions = await getSessionsForDay(date);
    Duration total = Duration.zero;
    
    for (final session in sessions) {
      if (session.isActive) {
        total += session.activeDuration;
      } else if (session.duration != null) {
        total += session.duration!;
      }
    }
    
    return total;
  }

  /// Получает общее количество минут за день (для API)
  Future<int> getTotalMinutesForDate(String dateStr) async {
    final date = DateTime.parse(dateStr);
    final totalTime = await getTotalTimeForDay(date);
    return totalTime.inMinutes;
  }

  /// Закрывает базу данных
  Future<void> close() async {
    final db = await database;
    await db.close();
  }
}
