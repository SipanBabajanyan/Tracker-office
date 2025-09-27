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
        // Проверяем разрешения
        final hasPermissions = await WifiService.hasPermissions();
        if (!hasPermissions) {
          final granted = await WifiService.requestPermissions();
          if (!granted) {
            _showSnackBar('Необходимы разрешения для работы приложения');
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
      appBar: AppBar(
        title: const Text('Office Tracker'),
        backgroundColor: Colors.blue[600],
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Статус отслеживания
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Отслеживание',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              Switch(
                                value: _isTracking,
                                onChanged: (_) => _toggleTracking(),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _isTracking ? 'Включено' : 'Выключено',
                            style: TextStyle(
                              color: _isTracking ? Colors.green : Colors.red,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Текущий статус
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Текущий статус',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(
                                _currentSession?.isActive == true
                                    ? Icons.location_on
                                    : Icons.location_off,
                                color: _currentSession?.isActive == true
                                    ? Colors.green
                                    : Colors.red,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _currentSession?.isActive == true
                                    ? 'В офисе'
                                    : 'Вне офиса',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: _currentSession?.isActive == true
                                      ? Colors.green
                                      : Colors.red,
                                ),
                              ),
                            ],
                          ),
                          if (_currentSession?.isActive == true) ...[
                            const SizedBox(height: 8),
                            Text(
                              'Начало: ${DateFormat('HH:mm').format(_currentSession!.startTime)}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            Text(
                              'Время в офисе: ${_formatDuration(_currentSession!.activeDuration)}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Статистика за день
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Сегодня (${DateFormat('dd.MM.yyyy').format(DateTime.now())})',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              Column(
                                children: [
                                  Text(
                                    _formatDuration(_todayStats['totalTime'] ?? Duration.zero),
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.blue,
                                    ),
                                  ),
                                  const Text('Общее время'),
                                ],
                              ),
                              Column(
                                children: [
                                  Text(
                                    '${_todayStats['sessionCount'] ?? 0}',
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green,
                                    ),
                                  ),
                                  const Text('Сессий'),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Информация о Wi-Fi
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Информация о Wi-Fi',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          FutureBuilder<String?>(
                            future: WifiService.getCurrentSSID(),
                            builder: (context, snapshot) {
                              if (snapshot.connectionState == ConnectionState.waiting) {
                                return const Text('Загрузка...');
                              }
                              
                              final ssid = snapshot.data;
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Текущий Wi-Fi: ${ssid ?? 'Не подключен'}'),
                                  Text('Офисные Wi-Fi: ${WifiService.getOfficeSSIDs().join(', ')}'),
                                  const SizedBox(height: 8),
                                  Builder(
                                    builder: (context) {
                                      final isInOffice = ssid != null && WifiService.getOfficeSSIDs().contains(ssid);
                                      return Row(
                                        children: [
                                          Icon(
                                            isInOffice ? Icons.check_circle : Icons.cancel,
                                            color: isInOffice ? Colors.green : Colors.red,
                                            size: 16,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            isInOffice ? 'Подключен к офису' : 'Не в офисе',
                                            style: TextStyle(
                                              color: isInOffice ? Colors.green : Colors.red,
                                            ),
                                          ),
                                        ],
                                      );
                                    },
                                  ),
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
