import 'dart:async';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'wifi_service.dart';
import 'database_service.dart';
import '../models/office_session.dart';

/// Фоновый сервис для отслеживания офиса
class BackgroundService {
  static const String _isTrackingKey = 'is_tracking';
  static const String _lastCheckKey = 'last_check';
  
  /// Инициализирует фоновый сервис
  static Future<void> initialize() async {
    try {
      final service = FlutterBackgroundService();
      
      await service.configure(
        androidConfiguration: AndroidConfiguration(
          onStart: onStart,
          autoStart: false, // Отключаем автозапуск для стабильности
          isForegroundMode: true,
          notificationChannelId: 'office_tracker_channel',
          initialNotificationTitle: 'In Office',
          initialNotificationContent: 'Отслеживание офиса активно',
          foregroundServiceNotificationId: 888,
        ),
        iosConfiguration: IosConfiguration(
          autoStart: false, // Отключаем автозапуск для стабильности
          onForeground: onStart,
          onBackground: onIosBackground,
        ),
      );
      print('Фоновый сервис инициализирован');
    } catch (e) {
      print('Ошибка при инициализации фонового сервиса: $e');
    }
  }

  /// Запускает фоновый сервис
  static Future<void> start() async {
    try {
      final service = FlutterBackgroundService();
      final isRunning = await service.isRunning();
      
      if (!isRunning) {
        await service.startService();
        print('Фоновый сервис запущен');
      } else {
        print('Фоновый сервис уже запущен');
      }
    } catch (e) {
      print('Ошибка при запуске фонового сервиса: $e');
    }
  }

  /// Останавливает фоновый сервис
  static Future<void> stop() async {
    final service = FlutterBackgroundService();
    service.invoke('stop');
  }

  /// Проверяет, запущен ли сервис
  static Future<bool> isRunning() async {
    final service = FlutterBackgroundService();
    return await service.isRunning();
  }
}

/// Обработчик запуска фонового сервиса
@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  print('Фоновый сервис запущен');
  
  try {
    // Устанавливаем уведомление (если поддерживается)
    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: "In Office",
        content: "Отслеживание офиса активно",
      );
    }

    // Запускаем периодическую проверку
    Timer.periodic(const Duration(minutes: 2), (timer) async {
      try {
        print('Фоновая проверка запущена');
        await _checkOfficeStatus();
        
        // Обновляем уведомление
        final isInOffice = await _getCurrentOfficeStatus();
        if (service is AndroidServiceInstance) {
          service.setForegroundNotificationInfo(
            title: "In Office",
            content: isInOffice ? "В офисе" : "Вне офиса",
          );
        }
        print('Фоновая проверка завершена: $isInOffice');
      } catch (e) {
        print('Ошибка в фоновой проверке: $e');
      }
    });
  } catch (e) {
    print('Ошибка при запуске фонового сервиса: $e');
  }
}

/// Проверяет статус офиса
Future<void> _checkOfficeStatus() async {
  try {
    const lastCheckKey = 'last_check';
    print('Фоновая проверка статуса офиса...');
    final isInOffice = await WifiService.isConnectedToOffice();
    final prefs = await SharedPreferences.getInstance();
    final lastCheck = prefs.getString(lastCheckKey);
    
    print('Фоновый статус: $isInOffice, предыдущий: $lastCheck');
    
    // Всегда обновляем статус при проверке
    if (isInOffice) {
      await _startOfficeSession();
    } else {
      await _endOfficeSession();
    }
    
    // Сохраняем текущий статус
    await prefs.setString(lastCheckKey, isInOffice.toString());
    print('Фоновый статус обновлен: $isInOffice');
    
  } catch (e) {
    print('Ошибка при фоновой проверке статуса офиса: $e');
  }
}

/// Получает текущий статус офиса
Future<bool> _getCurrentOfficeStatus() async {
  try {
    return await WifiService.isConnectedToOffice();
  } catch (e) {
    print('Ошибка при получении статуса: $e');
    return false;
  }
}

/// Начинает сессию в офисе
Future<void> _startOfficeSession() async {
  final db = DatabaseService();
  
  // Проверяем, есть ли уже активная сессия
  final activeSession = await db.getActiveSession();
  if (activeSession != null) {
    print('Фоновая сессия уже активна, не создаем новую');
    return;
  }

  // Создаем новую сессию
  final session = OfficeSession(
    startTime: DateTime.now(),
    isActive: true,
  );

  await db.insertSession(session);
  print('Фоновая сессия в офисе начата: ${session.startTime}');
}

/// Завершает сессию в офисе
Future<void> _endOfficeSession() async {
  final db = DatabaseService();
  final activeSession = await db.getActiveSession();
  
  if (activeSession != null) {
    final updatedSession = activeSession.copyWith(
      endTime: DateTime.now(),
      isActive: false,
    );
    
    await db.updateSession(updatedSession);
    print('Фоновая сессия в офисе завершена: ${updatedSession.endTime}');
  } else {
    print('Нет активной фоновой сессии для завершения');
  }
}

/// Обработчик для iOS
@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  print('iOS фоновый режим');
  return true;
}
