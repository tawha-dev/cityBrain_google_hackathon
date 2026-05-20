import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/providers/providers.dart';
import '../../core/storage/report_queue.dart';
import '../../shared/models/models.dart';
import 'reports_provider.dart';

/// Flushes offline-queued reports when connectivity returns.
final reportQueueSyncProvider = FutureProvider.autoDispose<void>((ref) async {
  final prefs = await ref.watch(sharedPreferencesProvider.future);
  final queue = ReportQueueService(prefs);
  final pending = await queue.load();
  if (pending.isEmpty) return;

  final api = ref.read(apiClientProvider);
  for (var i = 0; i < pending.length; i++) {
    final item = pending[i];
    try {
      await api.submitReport(
        rawText: item.rawText,
        category: item.category,
        language: item.language,
        location: item.lat != null && item.lng != null
            ? GeoLocation(lat: item.lat!, lng: item.lng!)
            : null,
      );
      await queue.removeAt(0);
    } on ApiException {
      break;
    } on DioException {
      break;
    } catch (_) {
      break;
    }
  }
  ref.invalidate(myReportsProvider);
});
