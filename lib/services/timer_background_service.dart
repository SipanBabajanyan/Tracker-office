import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import 'wifi_service.dart';
import 'database_service.dart';
import 'http_service.dart';
import '../models/office_session.dart';

/// Простой фоновый сервис на основе таймера
class TimerBackgroundService {
  static const String _lastCheckKey = 'last_check';
  static Timer? _backgroundTimer;
  static bool _isRunning = false;
  
  /// Запускает фоновый сервис
  static Future<void> start() async {
    if (_isRunning) {
      print('Таймер фонового сервиса уже запущен');
      return;
    }
    
    try {
      _isRunning = true;
      
      // Сразу проверяем текущее состояние
      await _checkOfficeStatus();
      
      // Запускаем периодическую проверку каждые 2 минуты
      _backgroundTimer = Timer.periodic(const Duration(minutes: 2), (timer) async {
        await _checkOfficeStatus();
      });
      
      print('Таймер фонового сервиса запущен');
    } catch (e) {
      print('Ошибка при запуске таймера фонового сервиса: $e');
      _isRunning = false;
    }
  }

  /// Останавливает фоновый сервис
  static Future<void> stop() async {
    try {
      _backgroundTimer?.cancel();
      _backgroundTimer = null;
      _isRunning = false;
      print('Таймер фонового сервиса остановлен');
    } catch (e) {
      print('Ошибка при остановке таймера фонового сервиса: $e');
    }
  }

  /// Проверяет, запущен ли сервис
  static bool get isRunning => _isRunning;

  /// Проверяет статус офиса
  static Future<void> _checkOfficeStatus() async {
    try {
      print('Таймер фоновая проверка статуса офиса...');
      final isInOffice = await WifiService.isConnectedToOffice();
      final prefs = await SharedPreferences.getInstance();
      final lastCheck = prefs.getString(_lastCheckKey);
      
      print('Таймер фоновый статус: $isInOffice, предыдущий: $lastCheck');
      
      // Всегда обновляем статус при проверке
      if (isInOffice) {
        await _startOfficeSession();
      } else {
        await _endOfficeSession();
      }
      
      // Отправляем данные на сервер
      await _syncWithServer();
      
      // Сохраняем текущий статус
      await prefs.setString(_lastCheckKey, isInOffice.toString());
      print('Таймер фоновый статус обновлен: $isInOffice');
      
    } catch (e) {
      print('Ошибка при таймер фоновой проверке статуса офиса: $e');
    }
  }

  /// Начинает сессию в офисе
  static Future<void> _startOfficeSession() async {
    try {
      final db = DatabaseService();
      
      // Проверяем, есть ли уже активная сессия
      final activeSession = await db.getActiveSession();
      if (activeSession != null) {
        print('Таймер фоновая сессия уже активна, не создаем новую');
        return;
      }

      // Создаем новую сессию
      final session = OfficeSession(
        startTime: DateTime.now(),
        isActive: true,
      );

      await db.insertSession(session);
      print('Таймер фоновая сессия в офисе начата: ${session.startTime}');
    } catch (e) {
      print('Ошибка при создании таймер фоновой сессии: $e');
    }
  }

  /// Завершает сессию в офисе
  static Future<void> _endOfficeSession() async {
    try {
      final db = DatabaseService();
      final activeSession = await db.getActiveSession();
      
      if (activeSession != null) {
        final updatedSession = activeSession.copyWith(
          endTime: DateTime.now(),
          isActive: false,
        );
        
        await db.updateSession(updatedSession);
        print('Таймер фоновая сессия в офисе завершена: ${updatedSession.endTime}');
      } else {
        print('Нет активной таймер фоновой сессии для завершения');
      }
    } catch (e) {
      print('Ошибка при завершении таймер фоновой сессии: $e');
    }
  }
  
  /// Синхронизирует данные с сервером
  static Future<void> _syncWithServer() async {
    try {
      // Проверяем подключение к серверу
      final isConnected = await HttpService.checkConnection();
      if (!isConnected) {
        print('HTTP: Нет подключения к серверу, пропускаем синхронизацию');
        return;
      }
      
      // Получаем или создаем сотрудника
      int? employeeId = await HttpService.getEmployeeId();
      if (employeeId == null) {
        // Создаем нового сотрудника с именем по умолчанию
        employeeId = await HttpService.createOrUpdateEmployee('Сотрудник ${DateTime.now().millisecondsSinceEpoch}');
        if (employeeId == null) {
          print('HTTP: Не удалось создать сотрудника');
          return;
        }
      }
      
      // Получаем статистику за сегодня
      final db = DatabaseService();
      final today = DateTime.now();
      final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
      
      final totalMinutes = await db.getTotalMinutesForDate(todayStr);
      final isInOffice = await WifiService.isConnectedToOffice();
      
      // Отправляем сессию на сервер
      final success = await HttpService.sendSession(
        employeeId: employeeId,
        date: todayStr,
        totalMinutes: totalMinutes,
        isInOffice: isInOffice,
      );
      
      if (success) {
        print('HTTP: Данные успешно синхронизированы с сервером');
      } else {
        print('HTTP: Ошибка синхронизации с сервером');
      }
      
    } catch (e) {
      print('HTTP: Ошибка при синхронизации с сервером: $e');
    }
  }
}
