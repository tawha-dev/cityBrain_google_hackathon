import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import 'report_categories.dart';
import 'report_draft.dart';

class ReportCategoryScreen extends ConsumerStatefulWidget {
  const ReportCategoryScreen({super.key});

  @override
  ConsumerState<ReportCategoryScreen> createState() => _ReportCategoryScreenState();
}

class _ReportCategoryScreenState extends ConsumerState<ReportCategoryScreen> {
  late final TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: ref.read(reportDraftProvider).rawText);
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(reportDraftProvider);
    final notifier = ref.read(reportDraftProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('NEW REPORT'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Stepper Indicator (Pure UI)
            Row(
              children: [
                _buildStepIndicator('1', 'Category', true),
                _buildStepConnector(true),
                _buildStepIndicator('2', 'Location', false),
                _buildStepConnector(false),
                _buildStepIndicator('3', 'Review', false),
              ],
            ),
            const SizedBox(height: 28),
            const Text(
              'Emergency Type',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.5),
            ),
            const SizedBox(height: 6),
            Text(
              'Select the category that best matches your situation.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 20),
            
            // Re-designed category items
            ...kEmergencyCategories.map((c) {
              final selected = draft.category == c.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.primary.withValues(alpha: 0.08)
                        : AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: selected ? AppColors.primary : AppColors.border,
                      width: selected ? 2.0 : 1.5,
                    ),
                    boxShadow: selected
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => notifier.update(draft.copyWith(category: c.id)),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: selected
                                    ? AppColors.primary.withValues(alpha: 0.15)
                                    : AppColors.surface,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(c.emoji, style: const TextStyle(fontSize: 22)),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Text(
                                c.label,
                                style: TextStyle(
                                  fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                                  fontSize: 15,
                                  color: selected ? AppColors.text : AppColors.textMuted,
                                ),
                              ),
                            ),
                            Icon(
                              selected ? Icons.radio_button_checked : Icons.radio_button_off,
                              color: selected ? AppColors.primary : AppColors.textMuted,
                              size: 22,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
            
            const SizedBox(height: 28),
            const Text(
              'Situation Details',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: -0.3),
            ),
            const SizedBox(height: 4),
            Text(
              'Describe what you are seeing. Clear details help responders.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _textController,
              maxLines: 5,
              onChanged: (v) => notifier.update(draft.copyWith(rawText: v)),
              style: const TextStyle(fontSize: 15),
              decoration: const InputDecoration(
                hintText: 'Describe what you see (e.g. water height, vehicle crash details...)',
                alignLabelWithHint: true,
              ),
            ),
            
            const SizedBox(height: 24),
            Text(
              'Preferred Reporting Language',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.text),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              children: ['en', 'ur', 'roman_ur'].map((lang) {
                final selected = draft.language == lang;
                
                String labelText = 'English';
                if (lang == 'ur') labelText = 'اردو';
                if (lang == 'roman_ur') labelText = 'Roman Urdu';

                return ChoiceChip(
                  label: Text(
                    labelText,
                    style: TextStyle(
                      color: selected ? Colors.white : AppColors.textMuted,
                      fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  selected: selected,
                  selectedColor: AppColors.primary,
                  backgroundColor: AppColors.card,
                  showCheckmark: false,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(
                      color: selected ? AppColors.primary : AppColors.border,
                      width: 1.5,
                    ),
                  ),
                  onSelected: (_) => notifier.update(draft.copyWith(language: lang)),
                );
              }).toList(),
            ),
            
            const SizedBox(height: 36),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 58),
              ),
              onPressed: draft.rawText.trim().length < 5
                  ? null
                  : () => context.push('/report/location'),
              icon: const Text('Next: Location Picker'),
              label: const Icon(Icons.arrow_forward_rounded, size: 20),
            ),
            const SizedBox(height: 20),
          ],
        ),
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
