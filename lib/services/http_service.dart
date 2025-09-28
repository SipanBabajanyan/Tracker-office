import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';

/// HTTP сервис для отправки данных на сервер
class HttpService {
  static const String _baseUrl = 'http://192.168.15.20:3000/api';
  static const String _deviceIdKey = 'device_id';
  static const String _employeeIdKey = 'employee_id';
  
  /// Получить уникальный ID устройства
  static Future<String> getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    String? deviceId = prefs.getString(_deviceIdKey);
    
    if (deviceId == null) {
      // Генерируем новый ID устройства
      final deviceInfo = DeviceInfoPlugin();
      String baseId;
      
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        baseId = androidInfo.id;
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        baseId = iosInfo.identifierForVendor ?? 'unknown';
      } else {
        baseId = 'unknown_${DateTime.now().millisecondsSinceEpoch}';
      }
      
      // Создаем уникальный ID с timestamp
      deviceId = '${baseId}_${DateTime.now().millisecondsSinceEpoch}';
      
      // Сохраняем ID
      await prefs.setString(_deviceIdKey, deviceId);
      print('HTTP: Сгенерирован новый ID устройства: $deviceId');
    }
    
    return deviceId;
  }
  
  /// Получить ID сотрудника
  static Future<int?> getEmployeeId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_employeeIdKey);
  }
  
  /// Сохранить ID сотрудника
  static Future<void> setEmployeeId(int employeeId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_employeeIdKey, employeeId);
    print('HTTP: Сохранен ID сотрудника: $employeeId');
  }
  
  /// Создать или обновить сотрудника
  static Future<int?> createOrUpdateEmployee(String name) async {
    try {
      final deviceId = await getDeviceId();
      
      final response = await http.post(
        Uri.parse('$_baseUrl/employees'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'deviceId': deviceId,
          'name': name,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final employeeId = data['id'] as int;
        await setEmployeeId(employeeId);
        print('HTTP: Сотрудник создан/обновлен: ID=$employeeId, Name=$name');
        return employeeId;
      } else {
        print('HTTP: Ошибка создания сотрудника: ${response.statusCode} - ${response.body}');
        return null;
      }
    } catch (e) {
      print('HTTP: Ошибка при создании сотрудника: $e');
      return null;
    }
  }
  
  /// Отправить сессию сотрудника
  static Future<bool> sendSession({
    required int employeeId,
    required String date,
    required int totalMinutes,
    required bool isInOffice,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/employee/$employeeId/session'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'date': date,
          'totalMinutes': totalMinutes,
          'isInOffice': isInOffice,
        }),
      );
      
      if (response.statusCode == 200) {
        print('HTTP: Сессия отправлена успешно: Employee=$employeeId, Date=$date, Minutes=$totalMinutes');
        return true;
      } else {
        print('HTTP: Ошибка отправки сессии: ${response.statusCode} - ${response.body}');
        return false;
      }
    } catch (e) {
      print('HTTP: Ошибка при отправке сессии: $e');
      return false;
    }
  }
  
  /// Проверить подключение к серверу
  static Future<bool> checkConnection() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/employees'),
        headers: {
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 5));
      
      return response.statusCode == 200;
    } catch (e) {
      print('HTTP: Ошибка подключения к серверу: $e');
      return false;
    }
  }
  
  /// Получить информацию о сотруднике
  static Future<Map<String, dynamic>?> getEmployeeInfo(int employeeId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/employee/$employeeId'),
        headers: {
          'Content-Type': 'application/json',
        },
      );
      
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('HTTP: Ошибка получения информации о сотруднике: ${response.statusCode}');
        return null;
      }
    } catch (e) {
      print('HTTP: Ошибка при получении информации о сотруднике: $e');
      return null;
    }
  }
}
