import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/models.dart';

class ReportDraft {
  const ReportDraft({
    this.category = 'flood',
    this.rawText = '',
    this.language = 'en',
    this.location,
  });

  final String category;
  final String rawText;
  final String language;
  final GeoLocation? location;

  ReportDraft copyWith({
    String? category,
    String? rawText,
    String? language,
    GeoLocation? location,
  }) {
    return ReportDraft(
      category: category ?? this.category,
      rawText: rawText ?? this.rawText,
      language: language ?? this.language,
      location: location ?? this.location,
    );
  }
}

class ReportDraftNotifier extends Notifier<ReportDraft> {
  @override
  ReportDraft build() => const ReportDraft(
        rawText: 'Pani ghar tak aa gaya — need help urgently',
        language: 'roman_ur',
      );

  void update(ReportDraft draft) => state = draft;

  void reset() => state = const ReportDraft(
        rawText: 'Pani ghar tak aa gaya — need help urgently',
        language: 'roman_ur',
      );
}

final reportDraftProvider =
    NotifierProvider<ReportDraftNotifier, ReportDraft>(ReportDraftNotifier.new);
