import 'package:flutter/material.dart';

import '../../core/network/ws_client.dart';
import '../../core/theme/app_theme.dart';

class ConnectionBadge extends StatelessWidget {
  const ConnectionBadge({super.key, required this.status});

  final WsConnectionStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      WsConnectionStatus.connected => ('Live', AppColors.success),
      WsConnectionStatus.connecting => ('Connecting', AppColors.warn),
      WsConnectionStatus.disconnected => ('Offline', AppColors.textMuted),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
