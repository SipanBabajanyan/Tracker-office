import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/tracking_service.dart';
import '../services/wifi_service.dart';
import '../services/timer_background_service.dart';
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
  Timer? _updateTimer;

  @override
  void initState() {
    super.initState();
    _initializeApp();
    
    // Обновляем UI каждые 5 секунд
    _updateTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (mounted) {
        _loadData();
      }
    });
  }

  /// Инициализирует приложение
  Future<void> _initializeApp() async {
    try {
      // Запускаем таймер фоновый сервис
      await TimerBackgroundService.start();
      
      // Автоматически запускаем отслеживание при старте
      if (!TrackingService.isTracking) {
        await TrackingService.startTracking();
      }
      await _loadData();
      
      print('Приложение инициализировано успешно с таймер фоновым сервисом');
    } catch (e) {
      print('Ошибка при инициализации: $e');
      // Продолжаем работу даже если что-то не работает
      if (!TrackingService.isTracking) {
        await TrackingService.startTracking();
      }
      await _loadData();
    }
  }

  @override
  void dispose() {
    _updateTimer?.cancel();
    super.dispose();
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

  /// Проверяет статус подключения (ручная проверка)
  Future<void> _checkConnection() async {
    try {
      print('Ручная проверка статуса...');
      
      // Проверяем разрешения на местоположение (нужны для получения SSID)
      final hasPermissions = await WifiService.hasPermissions();
      if (!hasPermissions) {
        final granted = await WifiService.requestPermissions();
        if (!granted) {
          _showSnackBar('Необходимы разрешения на местоположение для определения WiFi сети');
          return;
        }
      }
      
      // Запускаем отслеживание (если еще не запущено)
      if (!_isTracking) {
        await TrackingService.startTracking();
      }
      
      // Принудительно проверяем статус
      await TrackingService.forceCheck();
      
      // Обновляем данные
      await _loadData();
      print('Статус проверен и обновлен');
    } catch (e) {
      print('Ошибка при проверке: $e');
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
        title: const Text('In Office'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
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
                        
                        // Большая круглая кнопка CHECK
                        GestureDetector(
                          onTap: _checkConnection,
                          child: Container(
                            width: 200,
                            height: 200,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.blue[500],
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.blue.withOpacity(0.3),
                                  blurRadius: 20,
                                  spreadRadius: 5,
                                ),
                              ],
                            ),
                            child: Center(
                              child: Text(
                                'CHECK',
                                style: const TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  letterSpacing: 2,
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
