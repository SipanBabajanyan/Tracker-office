import 'package:network_info_plus/network_info_plus.dart';

/// Сервис для работы с Wi-Fi
class WifiService {
  // SSID офиса - оба варианта (2.4GHz и 5GHz)
  static const List<String> _officeSSIDs = ['Neetrino_5', 'Neetrino'];
  
  /// Проверяет, подключен ли к Wi-Fi офиса
  static Future<bool> isConnectedToOffice() async {
    try {
      // Получаем информацию о текущем Wi-Fi
      final networkInfo = NetworkInfo();
      final wifiInfo = await networkInfo.getWifiName();
      
      if (wifiInfo == null) {
        print('Не удалось получить информацию о Wi-Fi');
        return false;
      }

      // Убираем кавычки из SSID (иногда они добавляются)
      final cleanSSID = wifiInfo.replaceAll('"', '');
      
      print('Текущий Wi-Fi: $cleanSSID');
      print('Офисные Wi-Fi: $_officeSSIDs');
      
      // Проверяем, совпадает ли с любым из офисных SSID
      return _officeSSIDs.contains(cleanSSID);
    } catch (e) {
      print('Ошибка при проверке Wi-Fi: $e');
      return false;
    }
  }

  /// Получает текущий SSID
  static Future<String?> getCurrentSSID() async {
    try {
      final networkInfo = NetworkInfo();
      final wifiInfo = await networkInfo.getWifiName();
      return wifiInfo?.replaceAll('"', '');
    } catch (e) {
      print('Ошибка при получении SSID: $e');
      return null;
    }
  }

  /// Проверяет, есть ли разрешения (теперь не нужны для WiFi)
  static Future<bool> hasPermissions() async {
    return true; // WiFi не требует специальных разрешений
  }

  /// Запрашивает необходимые разрешения (теперь не нужны)
  static Future<bool> requestPermissions() async {
    return true; // WiFi не требует специальных разрешений
  }

  /// Получает список офисных Wi-Fi сетей
  static List<String> getOfficeSSIDs() {
    return _officeSSIDs;
  }
}
