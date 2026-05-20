import 'package:dio/dio.dart';

import '../../shared/models/models.dart';

/// Road-following route from public OSRM when API returns a straight-line fallback.
class OsrmRouteService {
  OsrmRouteService._();

  static final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 12),
    ),
  );

  static bool needsRoadRouting(RouteResult route) {
    if (route.polyline.length < 2) return false;
    if (route.source == 'google' || route.source == 'osrm') {
      return route.polyline.length <= 3;
    }
    return route.source == 'simulated' || route.polyline.length <= 3;
  }

  static Future<RouteResult?> fetchDrivingRoute({
    required GeoLocation origin,
    required GeoLocation destination,
  }) async {
    final coords =
        '${origin.lng},${origin.lat};${destination.lng},${destination.lat}';
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        'https://router.project-osrm.org/route/v1/driving/$coords',
        queryParameters: {
          'overview': 'full',
          'geometries': 'geojson',
          'steps': 'false',
        },
      );

      final data = res.data;
      if (data == null || data['code'] != 'Ok') return null;

      final routes = data['routes'] as List<dynamic>?;
      final route = routes?.isNotEmpty == true
          ? routes!.first as Map<String, dynamic>
          : null;
      final geometry = route?['geometry'] as Map<String, dynamic>?;
      final coordinates = geometry?['coordinates'] as List<dynamic>?;
      if (coordinates == null || coordinates.length < 2) return null;

      final polyline = coordinates
          .map((c) {
            final pair = c as List<dynamic>;
            return GeoLocation(
              lat: (pair[1] as num).toDouble(),
              lng: (pair[0] as num).toDouble(),
            );
          })
          .toList();

      return RouteResult(
        alternateRoute: 'Road route via OpenStreetMap',
        distanceMeters: ((route?['distance'] as num?) ?? 0).round(),
        durationSeconds: ((route?['duration'] as num?) ?? 0).round(),
        polyline: polyline,
        source: 'osrm',
      );
    } catch (_) {
      return null;
    }
  }

  static Future<RouteResult> enrichIfNeeded(RouteResult route) async {
    if (!needsRoadRouting(route)) return route;

    final origin = route.polyline.first;
    final dest = route.polyline.last;
    final road = await fetchDrivingRoute(origin: origin, destination: dest);
    if (road == null) return route;

    return route.copyWith(
      alternateRoute: road.alternateRoute,
      distanceMeters: road.distanceMeters,
      durationSeconds: road.durationSeconds,
      polyline: road.polyline,
      source: road.source,
    );
  }

  static bool needsRoadPolyline(List<GeoLocation> polyline) => polyline.length < 8;

  /// Road geometry for dispatch legs when API stored a 2-point straight line.
  static Future<List<GeoLocation>> enrichDispatchPolyline({
    required GeoLocation from,
    required GeoLocation to,
    List<GeoLocation> existing = const [],
  }) async {
    if (!needsRoadPolyline(existing)) return existing;
    final road = await fetchDrivingRoute(origin: from, destination: to);
    if (road != null && road.polyline.length >= 2) return road.polyline;
    if (existing.length >= 2) return existing;
    return [from, to];
  }
}
