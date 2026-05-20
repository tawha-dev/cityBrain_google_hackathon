import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/pin_location_map.dart';
import 'report_draft.dart';

class ReportLocationScreen extends ConsumerStatefulWidget {
  const ReportLocationScreen({super.key});

  @override
  ConsumerState<ReportLocationScreen> createState() => _ReportLocationScreenState();
}

class _ReportLocationScreenState extends ConsumerState<ReportLocationScreen> {
  static const _default = LatLng(24.8607, 67.0011);

  LatLng _center = _default;
  bool _loading = true;
  String? _locationError;

  @override
  void initState() {
    super.initState();
    _initLocation();
  }

  Future<void> _initLocation() async {
    setState(() {
      _loading = true;
      _locationError = null;
    });

    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      setState(() {
        _loading = false;
        _locationError = 'Location permission denied - drag map manually.';
      });
      return;
    }

    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      setState(() {
        _center = LatLng(pos.latitude, pos.longitude);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _locationError = 'GPS unavailable - drag map manually.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasGoogleKey = AppConfig.googleMapsApiKey.isNotEmpty;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('PIN LOCATION'),
        leading: Container(
          margin: const EdgeInsets.only(left: 10),
          decoration: BoxDecoration(
            color: AppColors.card.withValues(alpha: 0.9),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.border, width: 1.5),
          ),
          child: IconButton(
            icon: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.text, size: 16),
            onPressed: () => context.pop(),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Map taking full screen
          Positioned.fill(
            child: _loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 3))
                : PinLocationMap(
                    latitude: _center.latitude,
                    longitude: _center.longitude,
                    onCenterChanged: (lat, lng) =>
                        setState(() => _center = LatLng(lat, lng)),
                  ),
          ),
          
          // Steps indicator at the top
          Positioned(
            top: MediaQuery.of(context).padding.top + 64,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.card.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  _buildStepIndicator('1', 'Category', true),
                  _buildStepConnector(true),
                  _buildStepIndicator('2', 'Location', true),
                  _buildStepConnector(false),
                  _buildStepIndicator('3', 'Review', false),
                ],
              ),
            ),
          ),
          
          // Bottom controls sheet
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
                children: [
                  if (_locationError != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.warn.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _locationError!,
                        style: const TextStyle(color: AppColors.warn, fontSize: 12),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  
                  // Coordinate Tag
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          '${_center.latitude.toStringAsFixed(6)}, ${_center.longitude.toStringAsFixed(6)}',
                          style: TextStyle(
                            fontFamily: 'monospace',
                            color: AppColors.text,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  // Tips
                  if (!hasGoogleKey)
                    Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text(
                        'Tip: Set GOOGLE_MAPS_API_KEY to load standard map view.',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  
                  // GPS Button
                  TextButton.icon(
                    onPressed: _initLocation,
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.accent,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                    icon: const Icon(Icons.my_location_rounded, size: 18),
                    label: const Text('Recenter GPS', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 12),
                  
                  // Action Button
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 58),
                    ),
                    onPressed: () {
                      ref.read(reportDraftProvider.notifier).update(
                            ref.read(reportDraftProvider).copyWith(
                                  location: GeoLocation(
                                    lat: _center.latitude,
                                    lng: _center.longitude,
                                  ),
                                ),
                          );
                      context.push('/report/review');
                    },
                    icon: const Text('Confirm & Review'),
                    label: const Icon(Icons.arrow_forward_rounded, size: 20),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepIndicator(String stepNum, String title, bool isActive) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : AppColors.card,
            shape: BoxShape.circle,
            border: Border.all(color: isActive ? AppColors.primary : AppColors.border, width: 2),
          ),
          alignment: Alignment.center,
          child: Text(
            stepNum,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isActive ? Colors.white : AppColors.textMuted,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            color: isActive ? AppColors.text : AppColors.textMuted,
          ),
        ),
      ],
    );
  }

  Widget _buildStepConnector(bool isActive) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.only(bottom: 14, left: 4, right: 4),
        color: isActive ? AppColors.primary : AppColors.border,
      ),
    );
  }
}
