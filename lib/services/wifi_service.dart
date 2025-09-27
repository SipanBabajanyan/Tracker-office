import 'package:network_info_plus/network_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

/// Сервис для работы с Wi-Fi
class WifiService {
  // SSID офиса - оба варианта (2.4GHz и 5GHz)
  static const List<String> _officeSSIDs = ['Neetrino_5', 'Neetrino'];
  
  /// Проверяет, подключен ли к Wi-Fi офиса
  static Future<bool> isConnectedToOffice() async {
    try {
      // Запрашиваем разрешение на доступ к Wi-Fi
      final status = await Permission.locationWhenInUse.request();
      if (status != PermissionStatus.granted) {
        print('Нет разрешения на доступ к местоположению');
        return false;
      }

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
      final status = await Permission.locationWhenInUse.request();
      if (status != PermissionStatus.granted) {
        return null;
      }

      final networkInfo = NetworkInfo();
      final wifiInfo = await networkInfo.getWifiName();
      return wifiInfo?.replaceAll('"', '');
    } catch (e) {
      print('Ошибка при получении SSID: $e');
      return null;
    }
  }

  /// Проверяет, есть ли разрешения
  static Future<bool> hasPermissions() async {
    final locationStatus = await Permission.locationWhenInUse.status;
    return locationStatus == PermissionStatus.granted;
  }

  /// Запрашивает необходимые разрешения
  static Future<bool> requestPermissions() async {
    final locationStatus = await Permission.locationWhenInUse.request();
    return locationStatus == PermissionStatus.granted;
  }

  /// Получает список офисных Wi-Fi сетей
  static List<String> getOfficeSSIDs() {
    return _officeSSIDs;
  }
}
