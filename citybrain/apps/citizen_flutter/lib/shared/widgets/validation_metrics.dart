import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../models/models.dart';

class ValidationMetrics extends StatelessWidget {
  const ValidationMetrics({super.key, required this.validation});

  final ValidationBreakdown validation;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _row('Geolocation', validation.geolocation),
        _row('Weather', validation.weather),
        _row('News', validation.news),
        _row('Social', validation.social),
        _row('Agent confidence', validation.agentConfidence),
      ],
    );
  }

  Widget _row(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
          ),
          SizedBox(
            width: 48,
            child: Text(
              '$value',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
