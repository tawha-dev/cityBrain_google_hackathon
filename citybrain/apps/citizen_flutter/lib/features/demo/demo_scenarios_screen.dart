import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/models.dart';
import '../report/report_categories.dart';

final demoScenariosProvider = FutureProvider<List<DemoScenario>>((ref) async {
  final api = ref.watch(apiClientProvider);
  return api.fetchDemoScenarios();
});

class DemoScenariosScreen extends ConsumerStatefulWidget {
  const DemoScenariosScreen({super.key});

  @override
  ConsumerState<DemoScenariosScreen> createState() => _DemoScenariosScreenState();
}

class _DemoScenariosScreenState extends ConsumerState<DemoScenariosScreen> {
  String? _launchingKey;

  Future<void> _launch(DemoScenario scenario) async {
    if (_launchingKey != null) return;
    setState(() => _launchingKey = scenario.key);

    try {
      final api = ref.read(apiClientProvider);
      final res = await api.runDemoScenario(scenario.key);
      if (!mounted) return;
      context.go('/dashboard/${res.reportId}', extra: res.crisisId);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppColors.danger),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not start demo scenario. Check API connection.'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _launchingKey = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scenariosAsync = ref.watch(demoScenariosProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Demo Scenarios'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: scenariosAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_rounded, color: AppColors.danger, size: 40),
                const SizedBox(height: 12),
                Text(
                  'Could not load scenarios.\n$e',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textMuted),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(demoScenariosProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (scenarios) {
          final sorted = [...scenarios]
            ..sort((a, b) {
              if (a.featured != b.featured) return a.featured ? -1 : 1;
              return b.expectedConfidence.compareTo(a.expectedConfidence);
            });

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(demoScenariosProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.science_outlined, color: AppColors.accent, size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'One-tap demos inject corroborating weather, social, and sensor signals '
                          'so your report reaches high validation confidence — ideal for judge demos.',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                ...sorted.map((s) => _ScenarioCard(
                      scenario: s,
                      loading: _launchingKey == s.key,
                      disabled: _launchingKey != null && _launchingKey != s.key,
                      onLaunch: () => _launch(s),
                    )),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ScenarioCard extends StatelessWidget {
  const _ScenarioCard({
    required this.scenario,
    required this.loading,
    required this.disabled,
    required this.onLaunch,
  });

  final DemoScenario scenario;
  final bool loading;
  final bool disabled;
  final VoidCallback onLaunch;

  @override
  Widget build(BuildContext context) {
    final confidence = scenario.expectedConfidence;
    final confidenceColor =
        confidence >= 85 ? AppColors.success : AppColors.accent;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: scenario.featured
              ? AppColors.primary.withValues(alpha: 0.4)
              : AppColors.border,
          width: scenario.featured ? 2 : 1.5,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: disabled || loading ? null : onLaunch,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (scenario.featured)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              '★ RECOMMENDED DEMO',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ),
                        Text(
                          scenario.title,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: AppColors.text,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          scenario.areaLabel,
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: confidenceColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: confidenceColor.withValues(alpha: 0.35)),
                    ),
                    child: Text(
                      '~$confidence%',
                      style: TextStyle(
                        color: confidenceColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                scenario.description,
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _chip(Icons.category_outlined, categoryLabel(scenario.category)),
                  const SizedBox(width: 8),
                  _chip(Icons.sensors_rounded, '${scenario.signalCount} signals'),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: disabled || loading ? null : onLaunch,
                  style: FilledButton.styleFrom(
                    backgroundColor: scenario.featured ? AppColors.primary : AppColors.accent,
                    minimumSize: const Size(0, 44),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.play_arrow_rounded, size: 22),
                  label: Text(
                    loading ? 'Launching…' : 'Run demo & open dashboard',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(fontSize: 10, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
