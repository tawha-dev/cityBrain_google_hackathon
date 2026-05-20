import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/ws_client.dart';
import '../../core/providers/providers.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/timeline_steps.dart' show defaultPipelineSteps;

class RouteAlert {
  const RouteAlert({required this.message, this.route});

  final String message;
  final RouteResult? route;
}

class DashboardState {
  const DashboardState({
    this.report,
    this.dossier,
    this.liveTimeline = const [],
    this.wsStatus = WsConnectionStatus.disconnected,
    this.routeAlert,
    this.agentTraces = const [],
    this.dispatchUnits = const [],
    this.hasActiveDispatch = false,
    this.isLoading = true,
    this.error,
    this.pipelineMessage,
  });

  final CitizenReport? report;
  final CrisisDossier? dossier;
  final List<TimelineStep> liveTimeline;
  final WsConnectionStatus wsStatus;
  final RouteAlert? routeAlert;
  final List<String> agentTraces;
  final List<DispatchUnitTrack> dispatchUnits;
  final bool hasActiveDispatch;
  final bool isLoading;
  final String? error;
  final String? pipelineMessage;

  /// Merges REST timeline with live WebSocket steps (live wins on conflicts).
  List<TimelineStep> get mergedTimeline {
    final byStep = <String, TimelineStep>{};
    for (final t in report?.timeline ?? []) {
      byStep[t.step] = t;
    }
    for (final t in liveTimeline) {
      byStep[t.step] = t;
    }
    final ordered = <TimelineStep>[];
    for (final (key, _) in defaultPipelineSteps) {
      final step = byStep.remove(key);
      if (step != null) ordered.add(step);
    }
    ordered.addAll(byStep.values);
    return ordered;
  }

  ValidationBreakdown? get validation =>
      report?.validation ?? dossier?.validation;

  int? get validationScore =>
      report?.validationScore ?? validation?.total;

  /// Pipeline finished — report terminal, `complete` timeline step, or crisis resolved on dossier.
  bool get authorityComplete {
    if (report?.status == 'authority_notified' || report?.status == 'failed') {
      return true;
    }
    if (report?.verified == true) return true;
    if (mergedTimeline.any((t) => t.step == 'complete')) return true;
    final crisisStatus = dossier?.crisisStatus;
    if (dossier != null &&
        dossier!.agentRunCount > 0 &&
        crisisStatus != null &&
        (crisisStatus == 'resolved' || crisisStatus == 'monitoring')) {
      return true;
    }
    return false;
  }

  /// Shown in the status chip — matches timeline when the pipeline finished.
  String? get displayStatus {
    final status = report?.status;
    if (status == null) return null;
    if (status == 'authority_notified' || status == 'failed') return status;
    if (authorityComplete) return 'authority_notified';
    return status;
  }

  /// Stop polling only when the report row has a terminal status.
  bool get isTerminal =>
      report?.status == 'authority_notified' || report?.status == 'failed';

  /// True while the citizen pipeline is still running (show step spinners).
  bool get isActivePipeline {
    if (isTerminal || authorityComplete) return false;
    final status = report?.status;
    return status == 'validating' ||
        status == 'enriching' ||
        status == 'analyzing';
  }

  DashboardState copyWith({
    CitizenReport? report,
    CrisisDossier? dossier,
    List<TimelineStep>? liveTimeline,
    WsConnectionStatus? wsStatus,
    RouteAlert? routeAlert,
    bool clearRouteAlert = false,
    List<String>? agentTraces,
    List<DispatchUnitTrack>? dispatchUnits,
    bool? hasActiveDispatch,
    bool? isLoading,
    String? error,
    String? pipelineMessage,
  }) {
    return DashboardState(
      report: report ?? this.report,
      dossier: dossier ?? this.dossier,
      liveTimeline: liveTimeline ?? this.liveTimeline,
      wsStatus: wsStatus ?? this.wsStatus,
      routeAlert: clearRouteAlert ? null : (routeAlert ?? this.routeAlert),
      agentTraces: agentTraces ?? this.agentTraces,
      dispatchUnits: dispatchUnits ?? this.dispatchUnits,
      hasActiveDispatch: hasActiveDispatch ?? this.hasActiveDispatch,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      pipelineMessage: pipelineMessage ?? this.pipelineMessage,
    );
  }
}

class DashboardArgs {
  const DashboardArgs({required this.reportId, this.crisisId});

  final String reportId;
  final String? crisisId;

  DashboardArgs copyWith({String? crisisId}) {
    return DashboardArgs(reportId: reportId, crisisId: crisisId ?? this.crisisId);
  }

  @override
  bool operator ==(Object other) =>
      other is DashboardArgs &&
      other.reportId == reportId &&
      other.crisisId == crisisId;

  @override
  int get hashCode => Object.hash(reportId, crisisId);
}

class DashboardController
    extends AutoDisposeFamilyNotifier<DashboardState, DashboardArgs> {
  CitizenWsClient? _ws;
  Timer? _pollTimer;
  late DashboardArgs _args;

  @override
  DashboardState build(DashboardArgs args) {
    _args = args;
    ref.onDispose(() {
      _pollTimer?.cancel();
      _ws?.dispose();
    });

    Future.microtask(() => _init(args));
    return const DashboardState(isLoading: true);
  }

  Future<void> _init(DashboardArgs args) async {
    await _refresh(args);
    final crisisId = args.crisisId ?? state.report?.crisisId;
    _connectWs(args.copyWith(crisisId: crisisId));
    _startPolling(args.copyWith(crisisId: crisisId));
  }

  Future<void> _refresh(DashboardArgs args) async {
    final api = ref.read(apiClientProvider);
    try {
      final report = await api.fetchReport(args.reportId);
      CrisisDossier? dossier;
      final cid = args.crisisId ?? report.crisisId;
      if (cid != null && cid.isNotEmpty) {
        try {
          dossier = await api.fetchDossier(cid);
        } catch (_) {}
      }
      DispatchTrackingSnapshot? tracking;
      try {
        tracking = await api.fetchDispatchTracking(args.reportId);
      } catch (_) {}
      final hydrated = _hydrateHistoricalSteps(report, dossier);
      final liveTimeline = [
        ...state.liveTimeline.where(
          (t) => !hydrated.any((h) => h.step == t.step),
        ),
        ...hydrated,
      ];
      state = state.copyWith(
        report: report,
        dossier: dossier,
        liveTimeline: liveTimeline,
        dispatchUnits: tracking?.units ?? state.dispatchUnits,
        hasActiveDispatch:
            tracking?.trackingActive ?? state.hasActiveDispatch,
        isLoading: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void _upsertDispatchUnit(DispatchUnitTrack unit) {
    final list = [...state.dispatchUnits];
    final idx = list.indexWhere((u) => u.actionId == unit.actionId);
    if (idx >= 0) {
      list[idx] = unit;
    } else {
      list.add(unit);
    }
    state = state.copyWith(dispatchUnits: list, hasActiveDispatch: true);
  }

  DispatchUnitTrack? _unitFromPayload(Map<String, dynamic> payload) {
    final actionId = payload['actionId'] as String?;
    if (actionId == null || actionId.isEmpty) return null;
    final lat = (payload['lat'] as num?)?.toDouble();
    final lng = (payload['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return null;
    final polyJson = payload['routePolyline'] as List<dynamic>?;
    return DispatchUnitTrack(
      actionId: actionId,
      unit: payload['unit'] as String? ?? 'unit',
      facility: payload['facility'] as String?,
      etaMinutes: (payload['etaMinutes'] as num?)?.toInt(),
      lat: lat,
      lng: lng,
      progress: (payload['progress'] as num?)?.toDouble() ?? 0,
      distanceRemainingMeters:
          (payload['distanceRemainingMeters'] as num?)?.toInt(),
      arrived: payload['arrived'] as bool? ?? false,
      routePolyline: polyJson != null
          ? polyJson
              .map(
                (p) => GeoLocation(
                  lat: (p['lat'] as num).toDouble(),
                  lng: (p['lng'] as num).toDouble(),
                ),
              )
              .toList()
          : const [],
      rerouteCount: (payload['rerouteCount'] as num?)?.toInt() ?? 0,
    );
  }

  /// Older reports may lack `agents` / `complete` in stored metadata — infer from status/dossier.
  List<TimelineStep> _hydrateHistoricalSteps(
    CitizenReport report,
    CrisisDossier? dossier,
  ) {
    final existing = report.timeline.map((t) => t.step).toSet();
    final steps = <TimelineStep>[];
    final terminal =
        report.status == 'authority_notified' || report.status == 'failed';
    final aiRan = (dossier?.agentRunCount ?? 0) > 0;
    final crisisDone = dossier?.crisisStatus == 'resolved' ||
        dossier?.crisisStatus == 'monitoring';
    final hasComplete = existing.contains('complete');

    if (!existing.contains('agents') &&
        (terminal ||
            aiRan ||
            report.status == 'analyzing' ||
            crisisDone ||
            hasComplete)) {
      steps.add(
        const TimelineStep(step: 'agents', label: 'AI analysis complete'),
      );
    }
    if (!existing.contains('complete') &&
        (terminal || hasComplete || crisisDone || aiRan)) {
      steps.add(
        const TimelineStep(
          step: 'complete',
          label: 'Authority notified',
        ),
      );
    }
    return steps;
  }

  bool _eventMatchesReport(Map<String, dynamic> payload) {
    final rid = payload['reportId'] as String?;
    return rid == null || rid == _args.reportId;
  }

  void _startPolling(DashboardArgs args) {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (state.isTerminal) return;
      _refresh(args.copyWith(crisisId: args.crisisId ?? state.report?.crisisId));
    });
  }

  void _connectWs(DashboardArgs args) {
    _ws?.dispose();
    _ws = CitizenWsClient();
    _ws!.statusStream.listen((status) {
      state = state.copyWith(wsStatus: status);
    });
    _ws!.eventsStream.listen(_onWsEvent);
    _ws!.connect(
      reportId: args.reportId,
      crisisId: args.crisisId ?? state.report?.crisisId,
    );
  }

  void _addLiveStep(String step, String label) {
    final updated = [
      ...state.liveTimeline.where((t) => t.step != step),
      TimelineStep(step: step, label: label),
    ];
    state = state.copyWith(liveTimeline: updated);
  }

  void _onWsEvent(WsEvent event) {
    final payload = event.payload ?? {};
    if (!_eventMatchesReport(payload) &&
        event.reportId != null &&
        event.reportId != _args.reportId) {
      return;
    }

    switch (event.type) {
      case 'citizen.progress':
        if (!_eventMatchesReport(payload)) return;
        final label = payload['label'] as String?;
        if (label != null) {
          final step = payload['step'] as String? ?? 'progress';
          _addLiveStep(step, label);
        }
        break;
      case 'citizen.report.updated':
        final status = payload['status'] as String?;
        if (status == 'authority_notified' || status == 'failed') {
          _addLiveStep('complete', 'Authority notified — report validated');
        }
        _refresh(_args.copyWith(crisisId: _args.crisisId ?? state.report?.crisisId));
        break;
      case 'crisis.updated':
        final crisisStatus = payload['status'] as String?;
        if (crisisStatus == 'resolved' || crisisStatus == 'monitoring') {
          _addLiveStep('agents', 'AI analysis complete');
          _addLiveStep('complete', 'Authority notified — crisis processed');
        }
        _refresh(_args.copyWith(crisisId: event.crisisId ?? state.report?.crisisId));
        break;
      case 'pipeline.complete':
        _addLiveStep('agents', 'AI analysis complete');
        _addLiveStep('complete', 'Authority notified — analysis finished');
        state = state.copyWith(pipelineMessage: 'Pipeline complete');
        _refresh(_args.copyWith(crisisId: event.crisisId ?? state.report?.crisisId));
        break;
      case 'pipeline.failed':
        final err = payload['error'] as String? ?? 'AI pipeline failed';
        state = state.copyWith(pipelineMessage: err);
        _addLiveStep('agents', 'AI analysis failed');
        _refresh(_args);
        break;
      case 'citizen.alert':
        final routeJson = payload['route'];
        RouteResult? route;
        if (routeJson is Map<String, dynamic>) {
          route = RouteResult.fromJson(routeJson);
        }
        state = state.copyWith(
          routeAlert: RouteAlert(
            message: payload['message'] as String? ?? 'Official reroute available',
            route: route,
          ),
        );
        break;
      case 'dispatch.updated':
        _addLiveStep('dispatched', 'Emergency units dispatched');
        final units = payload['units'] as List<dynamic>?;
        if (units != null) {
          for (final u in units) {
            if (u is Map<String, dynamic>) {
              final track = DispatchUnitTrack.fromJson({
                ...u,
                'lat': u['lat'],
                'lng': u['lng'],
              });
              _upsertDispatchUnit(track);
            }
          }
        }
        state = state.copyWith(hasActiveDispatch: true);
        break;
      case 'dispatch.rerouted':
        final unit = _unitFromPayload(payload);
        if (unit != null) {
          _upsertDispatchUnit(
            unit.copyWith(rerouteCount: (unit.rerouteCount) + 1),
          );
        }
        _addLiveStep(
          'dispatched',
          'Traffic reroute: ${payload['unit'] ?? 'unit'} — ETA ${payload['etaMinutes'] ?? '?'} min',
        );
        state = state.copyWith(
          routeAlert: RouteAlert(
            message: payload['reason'] as String? ??
                'Unit rerouted due to traffic',
          ),
        );
        break;
      case 'dispatch.position':
      case 'dispatch.eta_update':
        final unit = _unitFromPayload(payload);
        if (unit != null) _upsertDispatchUnit(unit);
        break;
      case 'agent.step':
        if (!state.isActivePipeline) return;
        final agent = payload['agent'] as String? ?? 'agent';
        final thought =
            payload['thought'] as String? ?? payload['status'] as String? ?? '';
        _addLiveStep('agents', 'AI analysis: $agent…');
        final traces = [...state.agentTraces, '$agent — $thought'];
        if (traces.length > 12) traces.removeAt(0);
        state = state.copyWith(agentTraces: traces);
        break;
      default:
        break;
    }
  }

  Future<void> refresh() async {
    await _refresh(_args.copyWith(crisisId: _args.crisisId ?? state.report?.crisisId));
  }
}

final dashboardControllerProvider = AutoDisposeNotifierProviderFamily<
    DashboardController, DashboardState, DashboardArgs>(DashboardController.new);
