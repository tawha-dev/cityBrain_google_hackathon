import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../config/app_config.dart';
import '../../shared/models/models.dart';

enum WsConnectionStatus { connecting, connected, disconnected }

class CitizenWsClient {
  CitizenWsClient();

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  bool _cancelled = false;

  String? _reportId;
  String? _crisisId;

  final _statusController = StreamController<WsConnectionStatus>.broadcast();
  final _eventsController = StreamController<WsEvent>.broadcast();

  Stream<WsConnectionStatus> get statusStream => _statusController.stream;
  Stream<WsEvent> get eventsStream => _eventsController.stream;

  void connect({required String reportId, String? crisisId}) {
    _reportId = reportId;
    _crisisId = crisisId;
    _cancelled = false;
    _connect();
  }

  void _connect() {
    if (_cancelled || _reportId == null) return;

    _statusController.add(WsConnectionStatus.connecting);
    _subscription?.cancel();
    _channel?.sink.close();

    try {
      _channel = WebSocketChannel.connect(Uri.parse(AppConfig.wsUrl));
    } catch (e) {
      _scheduleReconnect();
      return;
    }

    _subscription = _channel!.stream.listen(
      (raw) {
        try {
          final json = jsonDecode(raw as String) as Map<String, dynamic>;
          final event = WsEvent.fromJson(json);
          _eventsController.add(event);
        } catch (_) {}
      },
      onDone: () {
        _statusController.add(WsConnectionStatus.disconnected);
        _scheduleReconnect();
      },
      onError: (_) {
        _statusController.add(WsConnectionStatus.disconnected);
        _scheduleReconnect();
      },
    );

    _channel!.sink.done.then((_) {
      if (!_cancelled) {
        _statusController.add(WsConnectionStatus.disconnected);
        _scheduleReconnect();
      }
    });

    _statusController.add(WsConnectionStatus.connected);
    _channel!.sink.add(
      jsonEncode({
        'subscribe': {
          'role': 'citizen',
          'reportId': _reportId,
          if (_crisisId != null) 'crisisId': _crisisId,
        },
      }),
    );
  }

  void _scheduleReconnect() {
    if (_cancelled) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _connect);
  }

  void disconnect() {
    _cancelled = true;
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _statusController.add(WsConnectionStatus.disconnected);
  }

  void dispose() {
    disconnect();
    _statusController.close();
    _eventsController.close();
  }
}
