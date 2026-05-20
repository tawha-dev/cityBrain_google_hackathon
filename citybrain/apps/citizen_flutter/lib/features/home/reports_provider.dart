import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/providers.dart';
import '../../shared/models/models.dart';

final myReportsProvider = FutureProvider.autoDispose<List<CitizenReport>>((ref) {
  return ref.watch(apiClientProvider).fetchMyReports();
});
