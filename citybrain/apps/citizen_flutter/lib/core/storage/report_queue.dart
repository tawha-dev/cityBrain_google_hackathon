import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const _queueKey = 'citybrain_report_queue';

class QueuedReport {
  QueuedReport({
    required this.rawText,
    required this.category,
    this.language,
    this.lat,
    this.lng,
    required this.queuedAt,
  });

  final String rawText;
  final String category;
  final String? language;
  final double? lat;
  final double? lng;
  final String queuedAt;

  Map<String, dynamic> toJson() => {
        'rawText': rawText,
        'category': category,
        if (language != null) 'language': language,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
        'queuedAt': queuedAt,
      };

  factory QueuedReport.fromJson(Map<String, dynamic> json) {
    return QueuedReport(
      rawText: json['rawText'] as String,
      category: json['category'] as String,
      language: json['language'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      queuedAt: json['queuedAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }
}

class ReportQueueService {
  ReportQueueService(this._prefs);

  final SharedPreferences _prefs;

  Future<List<QueuedReport>> load() async {
    final raw = _prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => QueuedReport.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> enqueue(QueuedReport report) async {
    final queue = await load();
    queue.add(report);
    await _save(queue);
  }

  Future<void> removeAt(int index) async {
    final queue = await load();
    if (index >= 0 && index < queue.length) {
      queue.removeAt(index);
      await _save(queue);
    }
  }

  Future<void> clearAll() async {
    await _prefs.remove(_queueKey);
  }

  Future<void> _save(List<QueuedReport> queue) async {
    await _prefs.setString(
      _queueKey,
      jsonEncode(queue.map((e) => e.toJson()).toList()),
    );
  }
}
