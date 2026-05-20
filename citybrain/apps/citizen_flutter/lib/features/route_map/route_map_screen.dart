import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/providers.dart';
import '../../core/routing/osrm_route_service.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/models.dart';
import '../../core/config/app_config.dart';
import '../../shared/widgets/route_polyline_map.dart';

final routeProvider = FutureProvider.autoDispose.family<RouteResult, String>((ref, reportId) async {
  GeoLocation? gpsOrigin;
  try {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.whileInUse ||
        perm == LocationPermission.always) {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 10),
        ),
      );
      gpsOrigin = GeoLocation(lat: pos.latitude, lng: pos.longitude);
    }
  } catch (_) {}

  final route = await ref
      .read(apiClientProvider)
      .fetchReportRoute(reportId, origin: gpsOrigin);
  return OsrmRouteService.enrichIfNeeded(route);
});

class RouteMapScreen extends ConsumerWidget {
  const RouteMapScreen({super.key, required this.reportId});

  final String reportId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routeAsync = ref.watch(routeProvider(reportId));

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('SAFE ROUTE'),
        leading: Container(
          margin: const EdgeInsets.only(left: 10),
          decoration: BoxDecoration(
            color: AppColors.card.withValues(alpha: 0.9),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.border, width: 1.5),
          ),
          child: IconButton(
            icon: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.text, size: 16),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
      ),
      body: routeAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 3)),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 48),
              const SizedBox(height: 16),
              Text(
                'Failed to load route: $e',
                style: TextStyle(color: AppColors.textMuted, fontSize: 14),
              ),
            ],
          ),
        ),
        data: (route) {
          final hasGoogleKey = AppConfig.googleMapsApiKey.isNotEmpty;
          final showMap = route.polyline.isNotEmpty;

          if (!showMap) {
            return SafeArea(child: _routeSummary(route));
          }

          return Stack(
            children: [
              // Map taking full screen
              Positioned.fill(
                child: RoutePolylineMap(
                  polyline: route.polyline,
                  startLabel: route.origin?.label ?? 'Start',
                  endLabel: route.destinationName,
                ),
              ),

              // Floating Bottom details card
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.fromLTRB(20, 24, 20, MediaQuery.of(context).padding.bottom + 20),
                  decoration: BoxDecoration(
                    color: AppColors.card.withValues(alpha: 0.95),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(28),
                      topRight: Radius.circular(28),
                    ),
                    border: Border.all(color: AppColors.border, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 15,
                        offset: const Offset(0, -4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'RECOMMENDED EVACUATION PATH',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.accent,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        route.destinationName,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppColors.text,
                        ),
                      ),
                      if (route.destination?.category != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            'Destination: ${route.destination!.category!.replaceAll('_', ' ')} · ${route.destinationSource ?? route.source}',
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          _buildInfoBadge(Icons.straighten_rounded, '${(route.distanceMeters / 1000).toStringAsFixed(1)} km'),
                          const SizedBox(width: 8),
                          _buildInfoBadge(Icons.access_time_filled_rounded, '${(route.durationSeconds / 60).ceil()} min'),
                          const SizedBox(width: 8),
                          _buildInfoBadge(Icons.alt_route_rounded, route.source),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (!hasGoogleKey)
                        Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: Text(
                            'Tip: Set GOOGLE_MAPS_API_KEY to load standard map view.',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      Container(
                        width: double.infinity,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.25),
                              blurRadius: 15,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            minimumSize: const Size(double.infinity, 58),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: () {
                            final dest = route.destination ??
                                RouteWaypoint(
                                  lat: route.polyline.last.lat,
                                  lng: route.polyline.last.lng,
                                );
                            final origin = route.origin;
                            final destParam =
                                '${dest.lat},${dest.lng}';
                            final uri = origin != null &&
                                    origin.lat != 0 &&
                                    origin.lng != 0
                                ? Uri.parse(
                                    'https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=$destParam&travelmode=driving',
                                  )
                                : Uri.parse(
                                    'https://www.google.com/maps/dir/?api=1&destination=$destParam&travelmode=driving',
                                  );
                            launchUrl(uri, mode: LaunchMode.externalApplication);
                          },
                          icon: const Icon(Icons.navigation_rounded, color: Colors.white, size: 20),
                          label: const Text(
                            'LAUNCH GOOGLE MAPS NAVIGATION',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _routeSummary(RouteResult route) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.route_rounded, size: 64, color: AppColors.accent),
          const SizedBox(height: 20),
          Text(
            route.alternateRoute, 
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          Text(
            '${route.polyline.length} waypoints Â· ${route.source}',
            style: TextStyle(color: AppColors.textMuted, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.textMuted),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
