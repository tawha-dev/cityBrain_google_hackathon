import 'dart:convert';

import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/device_id.dart';
import '../../shared/models/models.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.statusCode]);

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this._dio, this._deviceId);

  final Dio _dio;
  final DeviceIdService _deviceId;

  Future<Map<String, String>> _headers() async {
    final id = await _deviceId.getDeviceId();
    return {
      'Content-Type': 'application/json',
      'X-Device-Id': id,
    };
  }

  Future<T> _get<T>(
    String path,
    T Function(Map<String, dynamic> json) parse, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${AppConfig.apiV1}$path',
        queryParameters: queryParameters,
        options: Options(headers: await _headers()),
      );
      return parse(res.data ?? {});
    } on DioException catch (e) {
      throw ApiException(
        e.response?.data?.toString() ?? e.message ?? 'Request failed',
        e.response?.statusCode,
      );
    }
  }

  Future<T> _post<T>(
    String path,
    Object? body,
    T Function(Map<String, dynamic> json) parse,
  ) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiV1}$path',
        data: body,
        options: Options(headers: await _headers()),
      );
      return parse(res.data ?? {});
    } on DioException catch (e) {
      throw ApiException(
        e.response?.data?.toString() ?? e.message ?? 'Request failed',
        e.response?.statusCode,
      );
    }
  }

  Future<Map<String, dynamic>> fetchHealth() async {
    return _get('/health', (j) => j);
  }

  Future<List<CitizenReport>> fetchMyReports() async {
    final data = await _get('/citizen/reports', (j) => j);
    final list = data['reports'] as List<dynamic>? ?? [];
    return list
        .map((e) => CitizenReport.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<CitizenReport> fetchReport(String id) async {
    final data = await _get('/citizen/reports/$id', (j) => j);
    return CitizenReport.fromJson(data['report'] as Map<String, dynamic>);
  }

  Future<SubmitReportResponse> submitReport({
    required String rawText,
    required String category,
    String? language,
    GeoLocation? location,
  }) async {
    return _post(
      '/citizen/reports',
      {
        'rawText': rawText,
        'category': category,
        if (language != null) 'language': language,
        if (location != null) 'location': location.toJson(),
      },
      SubmitReportResponse.fromJson,
    );
  }

  Future<CrisisDossier> fetchDossier(String crisisId) async {
    return _get('/crises/$crisisId/dossier', CrisisDossier.fromJson);
  }

  Future<RouteResult> fetchReportRoute(
    String reportId, {
    GeoLocation? origin,
  }) async {
    final query = <String, dynamic>{};
    if (origin != null) {
      query['originLat'] = origin.lat;
      query['originLng'] = origin.lng;
    }
    final data = await _get(
      '/citizen/reports/$reportId/route',
      (j) => j,
      queryParameters: query.isEmpty ? null : query,
    );
    return RouteResult.fromJson(data['route'] as Map<String, dynamic>);
  }

  Future<DispatchTrackingSnapshot> fetchDispatchTracking(String reportId) async {
    return _get(
      '/citizen/reports/$reportId/tracking',
      DispatchTrackingSnapshot.fromJson,
    );
  }

  Future<ChatResponse> sendChatMessage(List<ChatMessage> messages) async {
    return _post(
      '/citizen/chat',
      {
        'messages': messages.map((m) => m.toJson()).toList(),
      },
      ChatResponse.fromJson,
    );
  }

  Future<List<DemoScenario>> fetchDemoScenarios() async {
    final data = await _get('/citizen/demo/scenarios', (j) => j);
    final list = data['scenarios'] as List<dynamic>? ?? [];
    return list
        .map((e) => DemoScenario.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SubmitReportResponse> runDemoScenario(String key) async {
    return _post(
      '/citizen/demo/scenarios/$key/run',
      const {},
      SubmitReportResponse.fromJson,
    );
  }

  Future<SafetyChatResponse> sendSafetyChatMessage(
    List<SafetyChatTurn> messages,
  ) async {
    return _post(
      '/citizen/chat/safety',
      {
        'messages': messages.map((m) => m.toJson()).toList(),
      },
      SafetyChatResponse.fromJson,
    );
  }

  /// Streams safety advisor reply tokens via SSE for a conversational feel.
  Future<void> streamSafetyChatMessage({
    required List<SafetyChatTurn> messages,
    required void Function(String reply) onDelta,
    required void Function(SafetyChatResponse response) onDone,
  }) async {
    try {
      final response = await _dio.post<ResponseBody>(
        '${AppConfig.apiV1}/citizen/chat/safety/stream',
        data: {
          'messages': messages.map((m) => m.toJson()).toList(),
        },
        options: Options(
          headers: await _headers(),
          responseType: ResponseType.stream,
          receiveTimeout: const Duration(seconds: 90),
        ),
      );

      final body = response.data;
      if (body == null) {
        throw ApiException('Empty stream response');
      }

      var buffer = '';
      await for (final chunk in utf8.decoder.bind(body.stream)) {
        buffer += chunk;
        while (buffer.contains('\n\n')) {
          final sep = buffer.indexOf('\n\n');
          final block = buffer.substring(0, sep);
          buffer = buffer.substring(sep + 2);
          _parseSafetyChatSse(block, onDelta: onDelta, onDone: onDone);
        }
      }
    } on DioException catch (e) {
      throw ApiException(
        e.response?.data?.toString() ?? e.message ?? 'Stream request failed',
        e.response?.statusCode,
      );
    }
  }

  void _parseSafetyChatSse(
    String block, {
    required void Function(String reply) onDelta,
    required void Function(SafetyChatResponse response) onDone,
  }) {
    String? event;
    String? dataLine;
    for (final line in block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLine = line.substring(5).trim();
      }
    }
    if (dataLine == null || dataLine.isEmpty) return;

    final json = jsonDecode(dataLine) as Map<String, dynamic>;
    if (event == 'delta') {
      final reply = json['reply'] as String? ?? '';
      if (reply.isNotEmpty) onDelta(reply);
    } else if (event == 'done') {
      onDone(SafetyChatResponse.fromJson(json));
    } else if (event == 'error') {
      throw ApiException(json['message'] as String? ?? 'Stream error');
    }
  }
}
