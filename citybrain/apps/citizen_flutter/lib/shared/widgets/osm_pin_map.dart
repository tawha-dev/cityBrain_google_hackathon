import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme/app_theme.dart';

/// Interactive OpenStreetMap picker with a fixed center pin (no Google API key required).
class OsmPinMap extends StatefulWidget {
  const OsmPinMap({
    super.key,
    required this.center,
    required this.onCenterChanged,
    this.zoom = 15,
  });

  final LatLng center;
  final ValueChanged<LatLng> onCenterChanged;
  final double zoom;

  @override
  State<OsmPinMap> createState() => _OsmPinMapState();
}

class _OsmPinMapState extends State<OsmPinMap> {
  late final MapController _controller;

  @override
  void initState() {
    super.initState();
    _controller = MapController();
  }

  @override
  void didUpdateWidget(OsmPinMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.center != widget.center) {
      _controller.move(widget.center, widget.zoom);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        FlutterMap(
          mapController: _controller,
          options: MapOptions(
            initialCenter: widget.center,
            initialZoom: widget.zoom,
            onMapEvent: (event) {
              if (event is MapEventMoveEnd || event is MapEventFlingAnimationEnd) {
                final c = _controller.camera.center;
                widget.onCenterChanged(c);
              }
            },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.citybrain.citybrain_citizen',
            ),
          ],
        ),
        const Center(
          child: Padding(
            padding: EdgeInsets.only(bottom: 36),
            child: Icon(
              Icons.location_on,
              size: 48,
              color: AppColors.danger,
              shadows: [Shadow(blurRadius: 4, color: Colors.black54)],
            ),
          ),
        ),
        Positioned(
          right: 12,
          bottom: 12,
          child: Material(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(8),
            elevation: 2,
            child: IconButton(
              icon: Icon(Icons.my_location, color: AppColors.accent),
              tooltip: 'Recenter',
              onPressed: () => _controller.move(widget.center, widget.zoom),
            ),
          ),
        ),
      ],
    );
  }
}
