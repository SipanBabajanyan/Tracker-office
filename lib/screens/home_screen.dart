import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/tracking_service.dart';
import '../services/wifi_service.dart';
import '../models/office_session.dart';

/// Главный экран приложения
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isTracking = false;
  OfficeSession? _currentSession;
  Map<String, dynamic> _todayStats = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  /// Загружает данные
  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    
    try {
      _isTracking = TrackingService.isTracking;
      _currentSession = await TrackingService.getCurrentSession();
      _todayStats = await TrackingService.getTodayStats();
    } catch (e) {
      print('Ошибка при загрузке данных: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Переключает отслеживание
  Future<void> _toggleTracking() async {
    try {
      if (_isTracking) {
        await TrackingService.stopTracking();
      } else {
        // Проверяем разрешения на местоположение (нужны для получения SSID)
        final hasPermissions = await WifiService.hasPermissions();
        if (!hasPermissions) {
          final granted = await WifiService.requestPermissions();
          if (!granted) {
            _showSnackBar('Необходимы разрешения на местоположение для определения WiFi сети');
            return;
          }
        }
        
        await TrackingService.startTracking();
      }
      
      await _loadData();
    } catch (e) {
      _showSnackBar('Ошибка: $e');
    }
  }

  /// Показывает уведомление
  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  /// Форматирует время
  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes % 60;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Office Tracker'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.black87),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Большой статус по центру
                Expanded(
                  flex: 2,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Статус В ОФИСЕ / ВНЕ ОФИСА
                        Text(
                          _currentSession?.isActive == true ? 'В ОФИСЕ' : 'ВНЕ ОФИСА',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: _currentSession?.isActive == true ? Colors.green[700] : Colors.red[700],
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 20),
                        
                        // Большая круглая кнопка ON/OFF
                        GestureDetector(
                          onTap: _toggleTracking,
                          child: Container(
                            width: 200,
                            height: 200,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _isTracking ? Colors.green[500] : Colors.red[500],
                              boxShadow: [
                                BoxShadow(
                                  color: (_isTracking ? Colors.green : Colors.red).withOpacity(0.3),
                                  blurRadius: 20,
                                  spreadRadius: 5,
                                ),
                              ],
                            ),
                            child: Center(
                              child: Text(
                                _isTracking ? 'ON' : 'OFF',
                                style: const TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  letterSpacing: 3,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                
                // Время в офисе внизу
                Expanded(
                  flex: 1,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(30),
                        topRight: Radius.circular(30),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, -5),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Время в офисе сегодня',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey[700],
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _formatDuration(_todayStats['totalTime'] ?? Duration.zero),
                          style: TextStyle(
                            fontSize: 48,
                            fontWeight: FontWeight.bold,
                            color: Colors.blue[700],
                          ),
                        ),
                        if (_currentSession?.isActive == true) ...[
                          const SizedBox(height: 10),
                          Text(
                            'Начало: ${DateFormat('HH:mm').format(_currentSession!.startTime)}',
                            style: TextStyle(
                              fontSize: 16,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
