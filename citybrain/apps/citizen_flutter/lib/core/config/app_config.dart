import 'dart:convert';

import 'package:flutter/services.dart';

/// API settings — loaded at startup from [assets/config/api_config.json].
///
/// Edit that JSON with your PC LAN IP when using a **physical phone**.
/// Use `http://10.0.2.2:4000` only on the **Android emulator**.
///
/// Optional override: `flutter run --dart-define-from-file=env/dev.json`
class AppConfig {
  AppConfig._();

  static const _assetPath = 'assets/config/api_config.json';

  static late String apiBaseUrl;
  static late String wsUrl;
  static late String googleMapsApiKey;
  static bool _loaded = false;

  static String get apiV1 => '$apiBaseUrl/api/v1';

  static Future<void> ensureLoaded() async {
    if (_loaded) return;

    const envApi = String.fromEnvironment('API_BASE_URL');
    if (envApi.isNotEmpty) {
      apiBaseUrl = envApi;
      const envWs = String.fromEnvironment('WS_URL');
      if (envWs.isNotEmpty) {
        wsUrl = envWs;
      } else {
        final base = envApi
            .replaceFirst('https://', 'wss://')
            .replaceFirst('http://', 'ws://')
            .replaceAll(RegExp(r'/+$'), '');
        wsUrl = base.endsWith('/ws') ? base : '$base/ws';
      }
      googleMapsApiKey = const String.fromEnvironment('GOOGLE_MAPS_API_KEY');
      _loaded = true;
      return;
    }

    try {
      final raw = await rootBundle.loadString(_assetPath);
      final map = jsonDecode(raw) as Map<String, dynamic>;
      apiBaseUrl = map['API_BASE_URL'] as String? ?? 'http://192.168.18.6:4000';
      wsUrl = map['WS_URL'] as String? ?? 'ws://192.168.18.6:4000/ws';
      googleMapsApiKey = map['GOOGLE_MAPS_API_KEY'] as String? ?? '';
    } catch (e) {
      apiBaseUrl = 'http://192.168.18.6:4000';
      wsUrl = 'ws://192.168.18.6:4000/ws';
      googleMapsApiKey = '';
    }

    _loaded = true;
  }

  /// True when URL is emulator-only (wrong for a physical device on Wi‑Fi).
  static bool get isEmulatorLoopbackHost =>
      apiBaseUrl.contains('10.0.2.2') || apiBaseUrl.contains('127.0.0.1');
}
