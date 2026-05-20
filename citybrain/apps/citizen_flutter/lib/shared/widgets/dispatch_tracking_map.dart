import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import '../models/models.dart';
import 'osm_route_map.dart';

/// Map showing incident, dispatch routes, and live unit positions.
class DispatchTrackingMap extends StatefulWidget {
  const DispatchTrackingMap({
    super.key,
    required this.incident,
    required this.units,
    this.initialZoom = 13,
  });

  final GeoLocation incident;
  final List<DispatchUnitTrack> units;
  final double initialZoom;

  @override
  State<DispatchTrackingMap> createState() => _DispatchTrackingMapState();
}

class _DispatchTrackingMapState extends State<DispatchTrackingMap> {
  GoogleMapController? _googleController;
  bool _useOsm = false;

  bool get _hasGoogleKey => AppConfig.googleMapsApiKey.isNotEmpty;
  bool get _showGoogle => _hasGoogleKey && !_useOsm;

  List<LatLng> _allPoints() {
    final pts = <LatLng>[
      LatLng(widget.incident.lat, widget.incident.lng),
    ];
    for (final u in widget.units) {
      pts.add(LatLng(u.lat, u.lng));
      for (final p in u.routePolyline) {
        pts.add(LatLng(p.lat, p.lng));
      }
    }
    return pts;
  }

  Future<void> _fitGoogleBounds() async {
    final points = _allPoints();
    if (points.isEmpty || _googleController == null) return;
    await _googleController!.animateCamera(
      CameraUpdate.newLatLngBounds(_boundsFromPoints(points), 56),
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

  Set<Polyline> _polylines() {
    final lines = <Polyline>{};
    var i = 0;
    for (final u in widget.units) {
      final pts = u.routePolyline
          .map((p) => LatLng(p.lat, p.lng))
          .where((p) => p.latitude != 0 || p.longitude != 0)
          .toList();
      if (pts.length < 2) continue;
      lines.add(
        Polyline(
          polylineId: PolylineId('route_$i'),
          points: pts,
          color: AppColors.primary.withValues(alpha: 0.85),
          width: 4,
          patterns: u.rerouteCount > 0
              ? [PatternItem.dash(20), PatternItem.gap(10)]
              : [],
        ),
      );
      i++;
    }
    return lines;
  }

  Set<Marker> _markers() {
    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('incident'),
        position: LatLng(widget.incident.lat, widget.incident.lng),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        infoWindow: const InfoWindow(title: 'Your incident'),
      ),
    };
    var i = 0;
    for (final u in widget.units) {
      markers.add(
        Marker(
          markerId: MarkerId('unit_$i'),
          position: LatLng(u.lat, u.lng),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            u.arrived ? BitmapDescriptor.hueGreen : BitmapDescriptor.hueAzure,
          ),
          infoWindow: InfoWindow(
            title: u.unit,
            snippet: u.arrived
                ? 'Arrived'
                : '${u.etaMinutes ?? "?"} min · ${((u.distanceRemainingMeters ?? 0) / 1000).toStringAsFixed(1)} km away',
          ),
        ),
      );
      i++;
    }
    return markers;
  }

  @override
  void didUpdateWidget(DispatchTrackingMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_showGoogle) _fitGoogleBounds();
  }

  @override
  Widget build(BuildContext context) {
    final incident = widget.incident;
    final primaryPolyline = widget.units.isNotEmpty &&
            widget.units.first.routePolyline.isNotEmpty
        ? widget.units.first.routePolyline
        : [incident];

    return Stack(
      children: [
        if (_showGoogle)
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: LatLng(incident.lat, incident.lng),
              zoom: widget.initialZoom,
            ),
            onMapCreated: (c) {
              _googleController = c;
              _fitGoogleBounds();
            },
            polylines: _polylines(),
            markers: _markers(),
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            zoomControlsEnabled: true,
            mapToolbarEnabled: false,
          )
        else
          OsmRouteMap(polyline: primaryPolyline, initialZoom: widget.initialZoom),
        if (_hasGoogleKey)
          Positioned(
            top: 12,
            right: 12,
            child: Material(
              color: AppColors.card.withValues(alpha: 0.95),
              borderRadius: BorderRadius.circular(8),
              child: TextButton(
                onPressed: () => setState(() => _useOsm = !_useOsm),
                child: Text(
                  _showGoogle ? 'OSM' : 'Google',
                  style: const TextStyle(fontSize: 11),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
