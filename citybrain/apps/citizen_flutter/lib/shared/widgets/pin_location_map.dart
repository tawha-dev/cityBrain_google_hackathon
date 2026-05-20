import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:latlong2/latlong.dart' as osm;

import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import 'osm_pin_map.dart';

/// Pin picker: Google Maps when configured, OpenStreetMap as fallback or manual switch.
class PinLocationMap extends StatefulWidget {
  const PinLocationMap({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.onCenterChanged,
    this.zoom = 15,
  });

  final double latitude;
  final double longitude;
  final void Function(double lat, double lng) onCenterChanged;
  final double zoom;

  @override
  State<PinLocationMap> createState() => _PinLocationMapState();
}

class _PinLocationMapState extends State<PinLocationMap> {
  GoogleMapController? _googleController;
  bool _useOsm = false;

  bool get _hasGoogleKey => AppConfig.googleMapsApiKey.isNotEmpty;

  bool get _showGoogle => _hasGoogleKey && !_useOsm;

  LatLng get _googleCenter => LatLng(widget.latitude, widget.longitude);

  void _moveGoogleCamera(LatLng target) {
    _googleController?.animateCamera(
      CameraUpdate.newLatLngZoom(target, widget.zoom),
    );
  }

  @override
  void didUpdateWidget(PinLocationMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_showGoogle &&
        (oldWidget.latitude != widget.latitude ||
            oldWidget.longitude != widget.longitude)) {
      _moveGoogleCamera(_googleCenter);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        if (_showGoogle) ...[
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: _googleCenter,
              zoom: widget.zoom,
            ),
            onMapCreated: (c) {
              _googleController = c;
              _moveGoogleCamera(_googleCenter);
            },
            onCameraMove: (pos) =>
                widget.onCenterChanged(pos.target.latitude, pos.target.longitude),
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            zoomControlsEnabled: true,
            mapToolbarEnabled: false,
            compassEnabled: true,
            mapType: MapType.normal,
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
        ] else
          OsmPinMap(
            center: osm.LatLng(widget.latitude, widget.longitude),
            zoom: widget.zoom,
            onCenterChanged: (c) =>
                widget.onCenterChanged(c.latitude, c.longitude),
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
