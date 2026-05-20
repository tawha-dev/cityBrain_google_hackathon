import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme/app_theme.dart';
import '../models/models.dart';

/// Route polyline on OpenStreetMap tiles (works without Google Maps SDK).
class OsmRouteMap extends StatelessWidget {
  const OsmRouteMap({
    super.key,
    required this.polyline,
    this.initialZoom = 14,
  });

  final List<GeoLocation> polyline;
  final double initialZoom;

  @override
  Widget build(BuildContext context) {
    final points = polyline.map((p) => LatLng(p.lat, p.lng)).toList();
    if (points.isEmpty) {
      return const Center(child: Text('No route points'));
    }

    final bounds = LatLngBounds.fromPoints(points);

    return FlutterMap(
      options: MapOptions(
        initialCameraFit: CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.all(48),
        ),
        initialZoom: initialZoom,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.citybrain.citybrain_citizen',
        ),
        if (points.length >= 2)
          PolylineLayer(
            polylines: [
              Polyline(
                points: points,
                color: AppColors.accent,
                strokeWidth: 5,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            Marker(
              point: points.first,
              width: 36,
              height: 36,
              child: const Icon(Icons.trip_origin, color: Colors.green, size: 28),
            ),
            if (points.length > 1)
              Marker(
                point: points.last,
                width: 36,
                height: 36,
                child: const Icon(Icons.location_on, color: AppColors.danger, size: 32),
              ),
          ],
        ),
      ],
    );
  }
}
