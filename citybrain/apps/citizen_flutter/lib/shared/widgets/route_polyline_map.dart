import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import '../models/models.dart';
import 'osm_route_map.dart';

/// Route polyline: Google Maps when configured, OpenStreetMap as fallback or manual switch.
class RoutePolylineMap extends StatefulWidget {
  const RoutePolylineMap({
    super.key,
    required this.polyline,
    this.initialZoom = 14,
    this.startLabel,
    this.endLabel,
  });

  final List<GeoLocation> polyline;
  final double initialZoom;
  final String? startLabel;
  final String? endLabel;

  @override
  State<RoutePolylineMap> createState() => _RoutePolylineMapState();
}

class _RoutePolylineMapState extends State<RoutePolylineMap> {
  GoogleMapController? _googleController;
  bool _useOsm = false;

  bool get _hasGoogleKey => AppConfig.googleMapsApiKey.isNotEmpty;

  bool get _showGoogle => _hasGoogleKey && !_useOsm;

  List<LatLng> get _points =>
      widget.polyline.map((p) => LatLng(p.lat, p.lng)).toList();

  @override
  void didUpdateWidget(RoutePolylineMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_showGoogle && oldWidget.polyline != widget.polyline) {
      _fitGoogleBounds();
    }
  }

  Future<void> _fitGoogleBounds() async {
    final points = _points;
    if (points.isEmpty || _googleController == null) return;
    await _googleController!.animateCamera(
      CameraUpdate.newLatLngBounds(_boundsFromPoints(points), 48),
    );
  }

  LatLngBounds _boundsFromPoints(List<LatLng> points) {
    var minLat = points.first.latitude;
    var maxLat = points.first.latitude;
    var minLng = points.first.longitude;
    var maxLng = points.first.longitude;
    for (final p in points) {
      minLat = math.min(minLat, p.latitude);
      maxLat = math.max(maxLat, p.latitude);
      minLng = math.min(minLng, p.longitude);
      maxLng = math.max(maxLng, p.longitude);
    }
    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }

  Set<Polyline> _googlePolylines(List<LatLng> points) {
    if (points.length < 2) return {};
    return {
      Polyline(
        polylineId: const PolylineId('route'),
        points: points,
        color: AppColors.accent,
        width: 5,
      ),
    };
  }

  Set<Marker> _googleMarkers(List<LatLng> points) {
    if (points.isEmpty) return {};
    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('start'),
        position: points.first,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: InfoWindow(title: widget.startLabel ?? 'Start'),
      ),
    };
    if (points.length > 1) {
      markers.add(
        Marker(
          markerId: const MarkerId('end'),
          position: points.last,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          infoWindow: InfoWindow(
            title: widget.endLabel ?? 'Safe destination',
          ),
        ),
      );
    }
    return markers;
  }

  @override
  Widget build(BuildContext context) {
    final points = _points;
    if (points.isEmpty) {
      return const Center(child: Text('No route points'));
    }

    return Stack(
      children: [
        if (_showGoogle)
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: points.first,
              zoom: widget.initialZoom,
            ),
            onMapCreated: (c) {
              _googleController = c;
              _fitGoogleBounds();
            },
            polylines: _googlePolylines(points),
            markers: _googleMarkers(points),
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            zoomControlsEnabled: true,
            mapToolbarEnabled: false,
            compassEnabled: true,
            mapType: MapType.normal,
          )
        else
          OsmRouteMap(
            polyline: widget.polyline,
            initialZoom: widget.initialZoom,
          ),
        Positioned(
          top: MediaQuery.of(context).padding.top + kToolbarHeight + 12,
          left: 8,
          right: 8,
          child: Row(
            children: [
              _MapSourceChip(
                label: _showGoogle ? 'Google Maps' : 'OpenStreetMap',
                isGoogle: _showGoogle,
              ),
              const Spacer(),
              if (_hasGoogleKey)
                Material(
                  color: AppColors.card.withValues(alpha: 0.95),
                  borderRadius: BorderRadius.circular(8),
                  child: TextButton(
                    onPressed: () => setState(() => _useOsm = !_useOsm),
                    child: Text(
                      _showGoogle ? 'Use OSM fallback' : 'Use Google Maps',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (!_hasGoogleKey)
          Positioned(
            bottom: 8,
            left: 8,
            right: 8,
            child: Material(
              color: AppColors.card.withValues(alpha: 0.95),
              borderRadius: BorderRadius.circular(8),
              child: const Padding(
                padding: EdgeInsets.all(8),
                child: Text(
                  'No Google Maps key — using OpenStreetMap. Add GOOGLE_MAPS_API_KEY to '
                  'android/local.properties and rebuild for Google tiles.',
                  style: TextStyle(fontSize: 11, color: AppColors.warn),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MapSourceChip extends StatelessWidget {
  const _MapSourceChip({required this.label, required this.isGoogle});

  final String label;
  final bool isGoogle;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card.withValues(alpha: 0.95),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isGoogle ? Icons.map : Icons.public,
              size: 14,
              color: AppColors.accent,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}
