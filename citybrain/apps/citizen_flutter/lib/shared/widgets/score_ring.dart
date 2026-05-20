import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class ScoreRing extends StatelessWidget {
  const ScoreRing({super.key, required this.score, this.size = 120});

  final int score;
  final double size;

  @override
  Widget build(BuildContext context) {
    final progress = (score.clamp(0, 100)) / 100;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: progress,
              strokeWidth: 8,
              backgroundColor: AppColors.border,
              color: score >= 60 ? AppColors.success : AppColors.warn,
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$score%',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppColors.success,
                ),
              ),
              Text(
                'Validation',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
