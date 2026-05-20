class GeoLocation {
  const GeoLocation({required this.lat, required this.lng});

  final double lat;
  final double lng;

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng};
}

class TimelineStep {
  const TimelineStep({
    required this.step,
    required this.label,
    this.at,
  });

  final String step;
  final String label;
  final String? at;

  factory TimelineStep.fromJson(Map<String, dynamic> json) {
    return TimelineStep(
      step: json['step'] as String? ?? '',
      label: json['label'] as String? ?? '',
      at: json['at'] as String?,
    );
  }
}

class ValidationBreakdown {
  const ValidationBreakdown({
    required this.geolocation,
    required this.weather,
    required this.news,
    required this.social,
    required this.agentConfidence,
    required this.total,
  });

  final int geolocation;
  final int weather;
  final int news;
  final int social;
  final int agentConfidence;
  final int total;

  factory ValidationBreakdown.fromJson(Map<String, dynamic> json) {
    return ValidationBreakdown(
      geolocation: (json['geolocation'] as num?)?.toInt() ?? 0,
      weather: (json['weather'] as num?)?.toInt() ?? 0,
      news: (json['news'] as num?)?.toInt() ?? 0,
      social: (json['social'] as num?)?.toInt() ?? 0,
      agentConfidence: (json['agentConfidence'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class CitizenReport {
  const CitizenReport({
    required this.id,
    required this.rawText,
    required this.status,
    this.crisisId,
    this.category,
    this.areaLabel,
    this.language,
    this.lat,
    this.lng,
    this.validationScore,
    this.validation,
    this.timeline = const [],
    this.verified = false,
    this.ingestedAt,
  });

  final String id;
  final String? crisisId;
  final String? category;
  final String rawText;
  final String? areaLabel;
  final String? language;
  final double? lat;
  final double? lng;
  final String status;
  final bool verified;
  final int? validationScore;
  final ValidationBreakdown? validation;
  final List<TimelineStep> timeline;
  final String? ingestedAt;

  factory CitizenReport.fromJson(Map<String, dynamic> json) {
    final validationJson = json['validation'];
    return CitizenReport(
      id: json['id'] as String,
      crisisId: json['crisisId'] as String?,
      category: json['category'] as String?,
      rawText: json['rawText'] as String? ?? '',
      areaLabel: json['areaLabel'] as String?,
      language: json['language'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      status: json['status'] as String? ?? 'unknown',
      verified: json['verified'] as bool? ?? false,
      validationScore: (json['validationScore'] as num?)?.toInt(),
      validation: validationJson is Map<String, dynamic>
          ? ValidationBreakdown.fromJson(validationJson)
          : null,
      timeline: (json['timeline'] as List<dynamic>?)
              ?.map((e) => TimelineStep.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      ingestedAt: json['ingestedAt'] as String?,
    );
  }
}

class SubmitReportResponse {
  const SubmitReportResponse({
    required this.reportId,
    required this.crisisId,
    required this.status,
    this.correlationId,
    this.expectedConfidence,
    this.scenario,
  });

  final String reportId;
  final String crisisId;
  final String status;
  final String? correlationId;
  final int? expectedConfidence;
  final String? scenario;

  factory SubmitReportResponse.fromJson(Map<String, dynamic> json) {
    return SubmitReportResponse(
      reportId: json['reportId'] as String,
      crisisId: json['crisisId'] as String,
      status: json['status'] as String? ?? 'validating',
      correlationId: json['correlationId'] as String?,
      expectedConfidence: (json['expectedConfidence'] as num?)?.toInt(),
      scenario: json['scenario'] as String?,
    );
  }
}

class DemoScenario {
  const DemoScenario({
    required this.key,
    required this.title,
    required this.areaLabel,
    required this.category,
    required this.expectedConfidence,
    required this.signalCount,
    required this.description,
    this.featured = false,
  });

  final String key;
  final String title;
  final String areaLabel;
  final String category;
  final int expectedConfidence;
  final int signalCount;
  final String description;
  final bool featured;

  factory DemoScenario.fromJson(Map<String, dynamic> json) {
    return DemoScenario(
      key: json['key'] as String,
      title: json['title'] as String? ?? '',
      areaLabel: json['areaLabel'] as String? ?? '',
      category: json['category'] as String? ?? 'other',
      expectedConfidence: (json['expectedConfidence'] as num?)?.toInt() ?? 0,
      signalCount: (json['signalCount'] as num?)?.toInt() ?? 0,
      description: json['description'] as String? ?? '',
      featured: json['featured'] as bool? ?? false,
    );
  }
}

class SocialVerification {
  const SocialVerification({required this.summary, this.socialScore});

  final String summary;
  final double? socialScore;

  factory SocialVerification.fromJson(Map<String, dynamic> json) {
    return SocialVerification(
      summary: json['summary'] as String? ?? '',
      socialScore: (json['socialScore'] as num?)?.toDouble(),
    );
  }
}

class CrisisDossier {
  const CrisisDossier({
    required this.crisis,
    this.citizenReport,
    this.validation,
    this.social,
    this.timeline = const [],
    this.signalCount = 0,
    this.agentRunCount = 0,
    this.signals = const [],
  });

  final Map<String, dynamic> crisis;
  final CitizenReport? citizenReport;
  final ValidationBreakdown? validation;
  final SocialVerification? social;
  final List<TimelineStep> timeline;
  final int signalCount;
  final int agentRunCount;
  final List<Map<String, dynamic>> signals;

  factory CrisisDossier.fromJson(Map<String, dynamic> json) {
    final validationJson = json['validation'];
    final socialJson = json['social'];
    return CrisisDossier(
      crisis: json['crisis'] as Map<String, dynamic>? ?? {},
      citizenReport: json['citizenReport'] != null
          ? CitizenReport.fromJson(
              json['citizenReport'] as Map<String, dynamic>,
            )
          : null,
      validation: validationJson is Map<String, dynamic>
          ? ValidationBreakdown.fromJson(validationJson)
          : null,
      social: socialJson is Map<String, dynamic>
          ? SocialVerification.fromJson(socialJson)
          : null,
      timeline: (json['timeline'] as List<dynamic>?)
              ?.map((e) => TimelineStep.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      signalCount: (json['signalCount'] as num?)?.toInt() ?? 0,
      agentRunCount: (json['agentRunCount'] as num?)?.toInt() ?? 0,
      signals: (json['signals'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          const [],
    );
  }

  String? get crisisTitle => crisis['title'] as String?;
  String? get crisisStatus => crisis['status'] as String?;
}

class DispatchUnitTrack {
  const DispatchUnitTrack({
    required this.actionId,
    required this.unit,
    this.facility,
    this.etaMinutes,
    required this.lat,
    required this.lng,
    this.facilityLat,
    this.facilityLng,
    this.progress = 0,
    this.distanceRemainingMeters,
    this.arrived = false,
    this.routePolyline = const [],
    this.rerouteCount = 0,
  });

  final String actionId;
  final String unit;
  final String? facility;
  final int? etaMinutes;
  final double lat;
  final double lng;
  final double? facilityLat;
  final double? facilityLng;
  final double progress;
  final int? distanceRemainingMeters;
  final bool arrived;
  final List<GeoLocation> routePolyline;
  final int rerouteCount;

  factory DispatchUnitTrack.fromJson(Map<String, dynamic> json) {
    return DispatchUnitTrack(
      actionId: json['actionId'] as String? ?? '',
      unit: json['unit'] as String? ?? 'unit',
      facility: json['facility'] as String?,
      etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      facilityLat: (json['facilityLat'] as num?)?.toDouble(),
      facilityLng: (json['facilityLng'] as num?)?.toDouble(),
      progress: (json['progress'] as num?)?.toDouble() ?? 0,
      distanceRemainingMeters: (json['distanceRemainingMeters'] as num?)?.toInt(),
      arrived: json['arrived'] as bool? ?? false,
      routePolyline: (json['routePolyline'] as List<dynamic>?)
              ?.map(
                (p) => GeoLocation(
                  lat: (p['lat'] as num).toDouble(),
                  lng: (p['lng'] as num).toDouble(),
                ),
              )
              .toList() ??
          const [],
      rerouteCount: (json['rerouteCount'] as num?)?.toInt() ?? 0,
    );
  }

  DispatchUnitTrack copyWith({
    double? lat,
    double? lng,
    double? facilityLat,
    double? facilityLng,
    double? progress,
    int? etaMinutes,
    int? distanceRemainingMeters,
    bool? arrived,
    List<GeoLocation>? routePolyline,
    int? rerouteCount,
  }) {
    return DispatchUnitTrack(
      actionId: actionId,
      unit: unit,
      facility: facility,
      etaMinutes: etaMinutes ?? this.etaMinutes,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      facilityLat: facilityLat ?? this.facilityLat,
      facilityLng: facilityLng ?? this.facilityLng,
      progress: progress ?? this.progress,
      distanceRemainingMeters:
          distanceRemainingMeters ?? this.distanceRemainingMeters,
      arrived: arrived ?? this.arrived,
      routePolyline: routePolyline ?? this.routePolyline,
      rerouteCount: rerouteCount ?? this.rerouteCount,
    );
  }
}

class DispatchTrackingSnapshot {
  const DispatchTrackingSnapshot({
    required this.reportId,
    this.crisisId,
    this.incident,
    this.units = const [],
    this.trackingActive = false,
  });

  final String reportId;
  final String? crisisId;
  final GeoLocation? incident;
  final List<DispatchUnitTrack> units;
  final bool trackingActive;

  factory DispatchTrackingSnapshot.fromJson(Map<String, dynamic> json) {
    final incidentJson = json['incident'];
    return DispatchTrackingSnapshot(
      reportId: json['reportId'] as String? ?? '',
      crisisId: json['crisisId'] as String?,
      incident: incidentJson is Map<String, dynamic>
          ? GeoLocation(
              lat: (incidentJson['lat'] as num).toDouble(),
              lng: (incidentJson['lng'] as num).toDouble(),
            )
          : null,
      units: (json['units'] as List<dynamic>?)
              ?.map((e) => DispatchUnitTrack.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      trackingActive: json['trackingActive'] as bool? ?? false,
    );
  }
}

class RouteWaypoint {
  const RouteWaypoint({
    required this.lat,
    required this.lng,
    this.name,
    this.label,
    this.category,
  });

  final double lat;
  final double lng;
  final String? name;
  final String? label;
  final String? category;

  factory RouteWaypoint.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const RouteWaypoint(lat: 0, lng: 0);
    }
    return RouteWaypoint(
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      name: json['name'] as String?,
      label: json['label'] as String?,
      category: json['category'] as String?,
    );
  }
}

class RouteResult {
  const RouteResult({
    required this.alternateRoute,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.polyline,
    required this.source,
    this.origin,
    this.destination,
    this.incident,
    this.incidentKind,
    this.destinationSource,
  });

  final String alternateRoute;
  final int distanceMeters;
  final int durationSeconds;
  final List<GeoLocation> polyline;
  final String source;
  final RouteWaypoint? origin;
  final RouteWaypoint? destination;
  final RouteWaypoint? incident;
  final String? incidentKind;
  final String? destinationSource;

  String get destinationName =>
      destination?.name ?? alternateRoute;

  factory RouteResult.fromJson(Map<String, dynamic> json) {
    return RouteResult(
      alternateRoute: json['alternateRoute'] as String? ?? 'Safe route',
      distanceMeters: (json['distanceMeters'] as num?)?.toInt() ?? 0,
      durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
      polyline: (json['polyline'] as List<dynamic>?)
              ?.map(
                (p) => GeoLocation(
                  lat: (p['lat'] as num).toDouble(),
                  lng: (p['lng'] as num).toDouble(),
                ),
              )
              .toList() ??
          const [],
      source: json['source'] as String? ?? 'simulated',
      origin: RouteWaypoint.fromJson(json['origin'] as Map<String, dynamic>?),
      destination:
          RouteWaypoint.fromJson(json['destination'] as Map<String, dynamic>?),
      incident: RouteWaypoint.fromJson(json['incident'] as Map<String, dynamic>?),
      incidentKind: json['incidentKind'] as String?,
      destinationSource: json['destinationSource'] as String?,
    );
  }

  RouteResult copyWith({
    List<GeoLocation>? polyline,
    int? distanceMeters,
    int? durationSeconds,
    String? source,
    String? alternateRoute,
  }) {
    return RouteResult(
      alternateRoute: alternateRoute ?? this.alternateRoute,
      distanceMeters: distanceMeters ?? this.distanceMeters,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      polyline: polyline ?? this.polyline,
      source: source ?? this.source,
      origin: origin,
      destination: destination,
      incident: incident,
      incidentKind: incidentKind,
      destinationSource: destinationSource,
    );
  }
}

class WsEvent {
  const WsEvent({
    required this.type,
    this.reportId,
    this.crisisId,
    this.payload,
  });

  final String type;
  final String? reportId;
  final String? crisisId;
  final Map<String, dynamic>? payload;

  factory WsEvent.fromJson(Map<String, dynamic> json) {
    return WsEvent(
      type: json['type'] as String? ?? '',
      reportId: json['reportId'] as String?,
      crisisId: json['crisisId'] as String?,
      payload: json['payload'] as Map<String, dynamic>?,
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.role,
    required this.content,
    this.at,
  });

  final String role;
  final String content;
  final DateTime? at;

  Map<String, dynamic> toJson() => {
        'role': role,
        'content': content,
      };

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      role: json['role'] as String? ?? 'user',
      content: json['content'] as String? ?? '',
    );
  }
}

class ChatSuggestion {
  const ChatSuggestion({
    required this.ready,
    this.category,
    this.rawText,
    this.language,
  });

  final bool ready;
  final String? category;
  final String? rawText;
  final String? language;

  factory ChatSuggestion.fromJson(Map<String, dynamic> json) {
    return ChatSuggestion(
      ready: json['ready'] as bool? ?? false,
      category: json['category'] as String?,
      rawText: json['rawText'] as String?,
      language: json['language'] as String?,
    );
  }
}

class ChatResponse {
  const ChatResponse({
    required this.reply,
    this.suggestion,
    this.model,
  });

  final String reply;
  final ChatSuggestion? suggestion;
  final String? model;

  factory ChatResponse.fromJson(Map<String, dynamic> json) {
    final suggestionJson = json['suggestion'];
    return ChatResponse(
      reply: json['reply'] as String? ?? '',
      suggestion: suggestionJson is Map<String, dynamic>
          ? ChatSuggestion.fromJson(suggestionJson)
          : null,
      model: json['model'] as String?,
    );
  }
}

class SafetyChatTurn {
  const SafetyChatTurn({
    required this.role,
    required this.content,
    this.tips = const [],
    this.replyUr,
    this.tipsUr = const [],
    this.voiceLanguage = 'english',
    this.at,
    this.isStreaming = false,
  });

  final String role;
  final String content;
  final List<String> tips;
  final String? replyUr;
  final List<String> tipsUr;
  /// `english` or `urdu` — which TTS engine to use for assistant replies.
  final String voiceLanguage;
  final DateTime? at;
  final bool isStreaming;

  SafetyChatTurn copyWith({
    String? role,
    String? content,
    List<String>? tips,
    String? replyUr,
    List<String>? tipsUr,
    String? voiceLanguage,
    DateTime? at,
    bool? isStreaming,
  }) {
    return SafetyChatTurn(
      role: role ?? this.role,
      content: content ?? this.content,
      tips: tips ?? this.tips,
      replyUr: replyUr ?? this.replyUr,
      tipsUr: tipsUr ?? this.tipsUr,
      voiceLanguage: voiceLanguage ?? this.voiceLanguage,
      at: at ?? this.at,
      isStreaming: isStreaming ?? this.isStreaming,
    );
  }

  Map<String, dynamic> toJson() => {
        'role': role,
        'content': content,
      };
}

class SafetyChatResponse {
  const SafetyChatResponse({
    required this.reply,
    this.tips = const [],
    this.replyUr,
    this.tipsUr = const [],
    this.model,
  });

  final String reply;
  final List<String> tips;
  final String? replyUr;
  final List<String> tipsUr;
  final String? model;

  factory SafetyChatResponse.fromJson(Map<String, dynamic> json) {
    return SafetyChatResponse(
      reply: json['reply'] as String? ?? '',
      tips: (json['tips'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      replyUr: json['replyUr'] as String?,
      tipsUr: (json['tipsUr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      model: json['model'] as String?,
    );
  }
}
