/// Модель для хранения сессии работы в офисе
class OfficeSession {
  final int? id;
  final DateTime startTime;
  final DateTime? endTime;
  final bool isActive;
  final String? notes;

  OfficeSession({
    this.id,
    required this.startTime,
    this.endTime,
    this.isActive = false,
    this.notes,
  });

  /// Создает сессию из Map (для базы данных)
  factory OfficeSession.fromMap(Map<String, dynamic> map) {
    return OfficeSession(
      id: map['id'],
      startTime: DateTime.parse(map['start_time']),
      endTime: map['end_time'] != null ? DateTime.parse(map['end_time']) : null,
      isActive: map['is_active'] == 1,
      notes: map['notes'],
    );
  }

  /// Преобразует сессию в Map (для базы данных)
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'start_time': startTime.toIso8601String(),
      'end_time': endTime?.toIso8601String(),
      'is_active': isActive ? 1 : 0,
      'notes': notes,
    };
  }

  /// Вычисляет продолжительность сессии
  Duration? get duration {
    if (endTime == null) return null;
    return endTime!.difference(startTime);
  }

  /// Вычисляет продолжительность активной сессии
  Duration get activeDuration {
    final end = endTime ?? DateTime.now();
    return end.difference(startTime);
  }

  /// Копирует сессию с новыми значениями
  OfficeSession copyWith({
    int? id,
    DateTime? startTime,
    DateTime? endTime,
    bool? isActive,
    String? notes,
  }) {
    return OfficeSession(
      id: id ?? this.id,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      isActive: isActive ?? this.isActive,
      notes: notes ?? this.notes,
    );
  }
}
