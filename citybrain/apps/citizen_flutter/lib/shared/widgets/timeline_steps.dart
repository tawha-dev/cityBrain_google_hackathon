import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../models/models.dart';

const defaultPipelineSteps = [
  ('submitted', 'Report submitted'),
  ('geocode', 'Verifying location'),
  ('weather', 'Checking weather'),
  ('news', 'Scanning news'),
  ('social', 'Social corroboration'),
  ('agents', 'AI analysis'),
  ('complete', 'Authority notified'),
];

class TimelineSteps extends StatelessWidget {
  const TimelineSteps({
    super.key,
    required this.timeline,
    this.reportStatus,
    this.authorityComplete = false,
    this.isActivePipeline = false,
  });

  final List<TimelineStep> timeline;
  final String? reportStatus;
  /// True when the pipeline finished (report terminal, `complete` step, or crisis resolved).
  final bool authorityComplete;
  /// When false, incomplete steps show as pending (no spinner) - for opened/historical reports.
  final bool isActivePipeline;

  bool _allStepsDone() {
    return authorityComplete ||
        reportStatus == 'authority_notified' ||
        reportStatus == 'failed';
  }

  bool _isStepDone(int index, String stepKey) {
    if (_allStepsDone()) return true;
    if (stepKey == 'agents') {
      if (reportStatus == 'analyzing' ||
          reportStatus == 'authority_notified' ||
          reportStatus == 'failed') {
        return true;
      }
      return timeline.any((t) {
        if (t.step == 'agents' || t.step == 'complete') return true;
        final idx = defaultPipelineSteps.indexWhere((d) => d.$1 == t.step);
        return idx >= index;
      });
    }
    if (stepKey == 'complete') {
      return timeline.any((t) => t.step == 'complete');
    }
    return timeline.any((t) {
      final idx = defaultPipelineSteps.indexWhere((d) => d.$1 == t.step);
      return idx >= index || t.step == stepKey;
    });
  }

  int? _firstIncompleteIndex() {
    for (var i = 0; i < defaultPipelineSteps.length; i++) {
      if (!_isStepDone(i, defaultPipelineSteps[i].$1)) return i;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final stepByKey = {for (final t in timeline) t.step: t};
    final activeIndex = _firstIncompleteIndex();

    return Column(
      children: List.generate(defaultPipelineSteps.length, (i) {
        final (stepKey, defaultLabel) = defaultPipelineSteps[i];
        final live = stepByKey[stepKey];
        final done = _isStepDone(i, stepKey);
        final inProgress = isActivePipeline && !done && activeIndex == i;

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: done
                      ? AppColors.success
                      : inProgress
                          ? AppColors.accent.withValues(alpha: 0.3)
                          : AppColors.border,
                  shape: BoxShape.circle,
                  border: inProgress ? Border.all(color: AppColors.accent, width: 2) : null,
                ),
                child: done
                    ? const Icon(Icons.check, size: 16, color: Colors.white)
                    : inProgress
                        ? SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                          )
                        : Text(
                            '${i + 1}',
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  live?.label ?? defaultLabel,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: done ? AppColors.text : AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}
