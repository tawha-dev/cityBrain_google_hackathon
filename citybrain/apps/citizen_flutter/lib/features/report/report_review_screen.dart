import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/providers/providers.dart';
import '../../core/storage/report_queue.dart';
import '../../core/theme/app_theme.dart';
import 'report_categories.dart';
import 'report_draft.dart';

class ReportReviewScreen extends ConsumerStatefulWidget {
  const ReportReviewScreen({super.key});

  @override
  ConsumerState<ReportReviewScreen> createState() => _ReportReviewScreenState();
}

class _ReportReviewScreenState extends ConsumerState<ReportReviewScreen> {
  bool _submitting = false;

  String _getCategoryEmoji(String? id) {
    if (id == null || id.isEmpty) return '⚠️';
    for (final c in kEmergencyCategories) {
      if (c.id == id) return c.emoji;
    }
    return '⚠️';
  }

  Future<void> _submit() async {
    final draft = ref.read(reportDraftProvider);
    if (draft.location == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location is required')),
      );
      return;
    }

    setState(() => _submitting = true);
    final api = ref.read(apiClientProvider);

    try {
      final res = await api.submitReport(
        rawText: draft.rawText,
        category: draft.category,
        language: draft.language,
        location: draft.location,
      );
      ref.read(reportDraftProvider.notifier).reset();
      if (!mounted) return;
      context.go(
        '/dashboard/${res.reportId}',
        extra: res.crisisId,
      );
    } on ApiException catch (e) {
      final prefs = await ref.read(sharedPreferencesProvider.future);
      final queue = ReportQueueService(prefs);
      await queue.enqueue(
        QueuedReport(
          rawText: draft.rawText,
          category: draft.category,
          language: draft.language,
          lat: draft.location?.lat,
          lng: draft.location?.lng,
          queuedAt: DateTime.now().toIso8601String(),
        ),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Queued offline: ${e.message}'),
          backgroundColor: AppColors.warn,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(reportDraftProvider);
    final loc = draft.location;

    return Scaffold(
      appBar: AppBar(
        title: const Text('CONFIRM REPORT'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Step indicator
              Row(
                children: [
                  _buildStepIndicator('1', 'Category', true),
                  _buildStepConnector(true),
                  _buildStepIndicator('2', 'Location', true),
                  _buildStepConnector(true),
                  _buildStepIndicator('3', 'Review', true),
                ],
              ),
              const SizedBox(height: 28),
              
              const Text(
                'Review Alert Details',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.5),
              ),
              const SizedBox(height: 6),
              Text(
                'Please double check the information before submitting to dispatch.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 13),
              ),
              const SizedBox(height: 24),
              
              // Custom Ticket Cards
              _buildReviewField(
                label: 'Emergency Category',
                icon: Text(_getCategoryEmoji(draft.category), style: const TextStyle(fontSize: 20)),
                child: Text(
                  categoryLabel(draft.category),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.text),
                ),
              ),
              const SizedBox(height: 12),
              
              _buildReviewField(
                label: 'Situation Description',
                icon: Icon(Icons.description_rounded, color: AppColors.accent, size: 20),
                child: Text(
                  draft.rawText,
                  style: TextStyle(fontSize: 15, color: AppColors.text, height: 1.4),
                ),
              ),
              const SizedBox(height: 12),
              
              _buildReviewField(
                label: 'Geographical Coordinates',
                icon: const Icon(Icons.location_pin, color: AppColors.primary, size: 20),
                child: Text(
                  loc != null
                      ? '${loc.lat.toStringAsFixed(6)}, ${loc.lng.toStringAsFixed(6)}'
                      : 'Coordinates not set',
                  style: TextStyle(
                    fontSize: 15, 
                    fontWeight: FontWeight.bold,
                    fontFamily: 'monospace',
                    color: AppColors.text,
                  ),
                ),
              ),
              
              const Spacer(),
              
              if (_submitting)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: CircularProgressIndicator(strokeWidth: 3),
                  ),
                )
              else
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.25),
                        blurRadius: 15,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      minimumSize: const Size(double.infinity, 60),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: _submit,
                    icon: const Icon(Icons.send_rounded, size: 20),
                    label: const Text(
                      'SUBMIT EMERGENCY ALERT',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildReviewField({
    required String label,
    required Widget icon,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              icon,
              const SizedBox(width: 12),
              Expanded(child: child),
            ],
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
