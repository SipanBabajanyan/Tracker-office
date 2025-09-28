import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import 'database_service.dart';
import 'wifi_service.dart';
import 'http_service.dart';
import '../models/office_session.dart';

/// Сервис для отслеживания времени в офисе
class TrackingService {
  static const String _taskName = 'officeTrackingTask';
  static const String _isTrackingKey = 'is_tracking';
  static const String _lastCheckKey = 'last_check';
  
  static bool _isTracking = false;
  static Timer? _checkTimer;

  /// Инициализирует сервис отслеживания
  static Future<void> initialize() async {
    // Загружаем состояние отслеживания
    final prefs = await SharedPreferences.getInstance();
    _isTracking = prefs.getBool(_isTrackingKey) ?? false;

    if (_isTracking) {
      await startTracking();
    }
  }

  /// Начинает отслеживание
  static Future<void> startTracking() async {
    // Останавливаем предыдущий таймер, если есть
    _checkTimer?.cancel();
    _checkTimer = null;

    _isTracking = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isTrackingKey, true);

    // Сразу проверяем текущее состояние
    await _checkOfficeStatus();
    
    // Запускаем периодическую проверку каждые 2 минуты
    _checkTimer = Timer.periodic(const Duration(minutes: 2), (timer) {
      _checkOfficeStatus();
    });
    
    print('Отслеживание запущено, таймер активен');
  }

  /// Останавливает отслеживание
  static Future<void> stopTracking() async {
    if (!_isTracking) return;

    print('Останавливаем отслеживание...');
    _isTracking = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isTrackingKey, false);

    // Останавливаем таймер
    _checkTimer?.cancel();
    _checkTimer = null;
    print('Таймер остановлен');

    // Завершаем активную сессию, если есть
    await _endActiveSession();
  }

  /// Проверяет статус офиса
  static Future<void> _checkOfficeStatus() async {
    try {
      print('Проверяем статус офиса...');
      final isInOffice = await WifiService.isConnectedToOffice();
      final prefs = await SharedPreferences.getInstance();
      final lastCheck = prefs.getString(_lastCheckKey);
      
      print('Текущий статус: $isInOffice, предыдущий: $lastCheck');
      
      // Отправляем статус на сервер (НОВЫЙ API)
      await _sendStatusToServer(isInOffice);
      
      // Локальная логика для отображения в приложении
      if (isInOffice) {
        await _startOfficeSession();
      } else {
        await _endOfficeSession();
      }
      
      // Сохраняем текущий статус
      await prefs.setString(_lastCheckKey, isInOffice.toString());
      print('Статус обновлен: $isInOffice');
      
    } catch (e) {
      print('Ошибка при проверке статуса офиса: $e');
    }
  }

  /// Отправляет статус на сервер (НОВЫЙ API)
  static Future<void> _sendStatusToServer(bool isInOffice) async {
    try {
      final employeeId = await HttpService.getEmployeeId();
      if (employeeId == null) {
        print('HTTP: ID сотрудника не найден, пропускаем отправку статуса');
        return;
      }

      final timestamp = DateTime.now().toIso8601String();
      final success = await HttpService.sendStatus(
        employeeId: employeeId,
        isInOffice: isInOffice,
        timestamp: timestamp,
      );

      if (success) {
        print('HTTP: Статус отправлен на сервер: InOffice=$isInOffice, Time=$timestamp');
      } else {
        print('HTTP: Ошибка отправки статуса на сервер');
      }
    } catch (e) {
      print('HTTP: Ошибка при отправке статуса: $e');
    }
  }

  /// Начинает сессию в офисе
  static Future<void> _startOfficeSession() async {
    final db = DatabaseService();
    
    // Проверяем, есть ли уже активная сессия
    final activeSession = await db.getActiveSession();
    if (activeSession != null) {
      print('Сессия уже активна, не создаем новую');
      return;
    }

    // Создаем новую сессию
    final session = OfficeSession(
      startTime: DateTime.now(),
      isActive: true,
    );

    await db.insertSession(session);
    print('Начата сессия в офисе: ${session.startTime}');
  }

  /// Завершает сессию в офисе
  static Future<void> _endOfficeSession() async {
    final db = DatabaseService();
    final activeSession = await db.getActiveSession();
    
    if (activeSession != null) {
      final updatedSession = activeSession.copyWith(
        endTime: DateTime.now(),
        isActive: false,
      );
      
      await db.updateSession(updatedSession);
      print('Завершена сессия в офисе: ${updatedSession.endTime}');
    } else {
      print('Нет активной сессии для завершения');
    }
  }

  /// Завершает активную сессию (при остановке отслеживания)
  static Future<void> _endActiveSession() async {
    final db = DatabaseService();
    final activeSession = await db.getActiveSession();
    
    if (activeSession != null) {
      final updatedSession = activeSession.copyWith(
        endTime: DateTime.now(),
        isActive: false,
      );
      
      await db.updateSession(updatedSession);
      print('Принудительно завершена сессия: ${updatedSession.endTime}');
    }
  }

  /// Принудительно проверяет статус (для ручной проверки)
  static Future<void> forceCheck() async {
    print('Принудительная проверка статуса...');
    await _checkOfficeStatus();
  }

  /// Получает текущий статус отслеживания
  static bool get isTracking => _isTracking;

  /// Получает информацию о текущей сессии
  static Future<OfficeSession?> getCurrentSession() async {
    final db = DatabaseService();
    return await db.getActiveSession();
  }

  /// Получает статистику за день
  static Future<Map<String, dynamic>> getTodayStats() async {
    final db = DatabaseService();
    final today = DateTime.now();
    final sessions = await db.getSessionsForDay(today);
    final totalTime = await db.getTotalTimeForDay(today);
    
    return {
      'sessions': sessions,
      'totalTime': totalTime,
      'sessionCount': sessions.length,
      'isCurrentlyInOffice': sessions.isNotEmpty && sessions.last.isActive,
    };
  }
}

