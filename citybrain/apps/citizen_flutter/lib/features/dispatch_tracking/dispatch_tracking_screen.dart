import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/providers.dart';
import '../../core/routing/osrm_route_service.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/dispatch_tracking_map.dart';

Future<DispatchTrackingSnapshot> _loadEnrichedTracking(
  Ref ref,
  String reportId,
) async {
  final snapshot =
      await ref.read(apiClientProvider).fetchDispatchTracking(reportId);
  final incident = snapshot.incident;
  if (incident == null || snapshot.units.isEmpty) return snapshot;

  final enrichedUnits = await Future.wait(
    snapshot.units.map((unit) async {
      final fromLat = unit.facilityLat ?? unit.routePolyline.firstOrNull?.lat;
      final fromLng = unit.facilityLng ?? unit.routePolyline.firstOrNull?.lng;
      if (fromLat == null || fromLng == null) return unit;

      final polyline = await OsrmRouteService.enrichDispatchPolyline(
        from: GeoLocation(lat: fromLat, lng: fromLng),
        to: incident,
        existing: unit.routePolyline,
      );
      return unit.copyWith(routePolyline: polyline);
    }),
  );

  return DispatchTrackingSnapshot(
    reportId: snapshot.reportId,
    crisisId: snapshot.crisisId,
    incident: snapshot.incident,
    units: enrichedUnits,
    trackingActive: snapshot.trackingActive,
  );
}

final dispatchTrackingProvider =
    FutureProvider.autoDispose.family<DispatchTrackingSnapshot, String>(
  (ref, reportId) => _loadEnrichedTracking(ref, reportId),
);

class DispatchTrackingScreen extends ConsumerStatefulWidget {
  const DispatchTrackingScreen({super.key, required this.reportId});

  final String reportId;

  @override
  ConsumerState<DispatchTrackingScreen> createState() =>
      _DispatchTrackingScreenState();
}

class _DispatchTrackingScreenState extends ConsumerState<DispatchTrackingScreen> {
  List<DispatchUnitTrack> _liveUnits = [];
  GeoLocation? _incident;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      ref.invalidate(dispatchTrackingProvider(widget.reportId));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final trackingAsync = ref.watch(dispatchTrackingProvider(widget.reportId));

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('LIVE DISPATCH TRACKING'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: trackingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Unable to load tracking: $e', textAlign: TextAlign.center),
          ),
        ),
        data: (snapshot) {
          if (_liveUnits.isEmpty && snapshot.units.isNotEmpty) {
            _liveUnits = snapshot.units;
          } else if (snapshot.units.isNotEmpty) {
            _liveUnits = snapshot.units;
          }
          _incident ??= snapshot.incident;

          final incident = _incident ?? snapshot.incident;
          if (incident == null) {
            return const Center(
              child: Text('No incident location — tracking unavailable'),
            );
          }

          if (!snapshot.trackingActive && _liveUnits.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.local_shipping_outlined,
                        size: 48, color: AppColors.textMuted),
                    const SizedBox(height: 16),
                    Text(
                      'No units dispatched yet',
                      style: TextStyle(
                        color: AppColors.text,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'When authority dispatches emergency resources, you will see live ETA and position here.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                    ),
                  ],
                ),
              ),
            );
          }

          return Stack(
            children: [
              Positioned.fill(
                child: DispatchTrackingMap(
                  incident: incident,
                  units: _liveUnits,
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _UnitEtaPanel(units: _liveUnits),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _UnitEtaPanel extends StatelessWidget {
  const _UnitEtaPanel({required this.units});

  final List<DispatchUnitTrack> units;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.fromLTRB(
        16,
        0,
        16,
        MediaQuery.of(context).padding.bottom + 16,
      ),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DISPATCHED UNITS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
              color: AppColors.accent,
            ),
          ),
          const SizedBox(height: 10),
          ...units.map((u) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    Icon(
                      u.arrived
                          ? Icons.check_circle_rounded
                          : Icons.local_shipping_rounded,
                      color: u.arrived ? AppColors.accent : AppColors.primary,
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${u.unit}${u.facility != null ? ' · ${u.facility}' : ''}',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.text,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            u.arrived
                                ? 'Arrived on scene'
                                : u.distanceRemainingMeters != null
                                    ? '${(u.distanceRemainingMeters! / 1000).toStringAsFixed(1)} km away · ETA ${u.etaMinutes ?? "?"} min'
                                    : 'ETA ${u.etaMinutes ?? "?"} min',
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          if (u.rerouteCount > 0)
                            Text(
                              'Rerouted ${u.rerouteCount}× due to traffic',
                              style: TextStyle(
                                color: AppColors.warn,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (!u.arrived && u.progress > 0)
                      Text(
                        '${(u.progress * 100).round()}%',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: AppColors.primary,
                        ),
                      ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}
