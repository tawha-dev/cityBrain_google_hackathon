import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../shared/widgets/connection_badge.dart';
import '../../shared/widgets/score_ring.dart';
import '../../shared/widgets/timeline_steps.dart';
import '../../shared/widgets/validation_metrics.dart';
import 'dashboard_controller.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({
    super.key,
    required this.reportId,
    this.crisisId,
  });

  final String reportId;
  final String? crisisId;

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  String? _shownRouteAlert;

  @override
  Widget build(BuildContext context) {
    final args = DashboardArgs(reportId: widget.reportId, crisisId: widget.crisisId);
    final state = ref.watch(dashboardControllerProvider(args));
    final controller = ref.read(dashboardControllerProvider(args).notifier);

    final alertMsg = state.routeAlert?.message;
    if (alertMsg != null && alertMsg != _shownRouteAlert) {
      _shownRouteAlert = alertMsg;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(alertMsg),
            action: SnackBarAction(
              label: 'Route',
              onPressed: () => context.push('/dashboard/${widget.reportId}/route'),
            ),
          ),
        );
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('ALERT BRIEFING'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.go('/'),
        ),
        actions: [
          ConnectionBadge(status: state.wsStatus),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => controller.refresh(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: state.isLoading && state.report == null
          ? const Center(child: CircularProgressIndicator(strokeWidth: 3))
          : RefreshIndicator(
              onRefresh: controller.refresh,
              child: CustomScrollView(
                slivers: [
                  if (state.error != null)
                    SliverToBoxAdapter(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        margin: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                        ),
                        child: Text(
                          state.error!,
                          style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (state.displayStatus != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.accent.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: AppColors.accent.withValues(alpha: 0.5), width: 1.5),
                              ),
                              child: Text(
                                state.displayStatus!.toUpperCase(),
                                style: TextStyle(
                                  color: AppColors.accent,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 10,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          if (state.validationScore != null) ...[
                            const SizedBox(height: 20),
                            Center(child: ScoreRing(score: state.validationScore!)),
                            const SizedBox(height: 12),
                            Center(
                              child: Text(
                                'AI + Live Data Corroboration',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.auto_mode_rounded, color: AppColors.accent, size: 18),
                                  SizedBox(width: 8),
                                  Text(
                                    'AUTOMATION PROGRESS',
                                    style: TextStyle(
                                      fontSize: 11,
                                      letterSpacing: 1,
                                      color: AppColors.textMuted,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              TimelineSteps(
                                timeline: state.mergedTimeline,
                                reportStatus: state.report?.status,
                                authorityComplete: state.authorityComplete,
                                isActivePipeline: state.isActivePipeline,
                              ),
                              if (state.pipelineMessage != null &&
                                  !state.authorityComplete)
                                Padding(
                                  padding: const EdgeInsets.only(top: 14),
                                  child: Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: AppColors.accent.withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      children: [
                                        SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            state.pipelineMessage!,
                                            style: TextStyle(
                                              color: AppColors.accent,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (state.validation != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.fact_check_rounded, color: AppColors.primary, size: 18),
                                    SizedBox(width: 8),
                                    Text(
                                      'VALIDATION BREAKDOWN',
                                      style: TextStyle(
                                        fontSize: 11,
                                        letterSpacing: 1,
                                        color: AppColors.textMuted,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                ValidationMetrics(validation: state.validation!),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (state.dossier?.social != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.feed_rounded, color: AppColors.accent, size: 18),
                                    SizedBox(width: 8),
                                    Text(
                                      'SOCIAL / MEDIA SYNDICATION',
                                      style: TextStyle(
                                        fontSize: 11,
                                        letterSpacing: 1,
                                        color: AppColors.textMuted,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Text(
                                    state.dossier!.social!.summary,
                                    style: TextStyle(fontSize: 14, height: 1.4, color: AppColors.text),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (state.dossier != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.crisis_alert_rounded, color: AppColors.primary, size: 18),
                                    SizedBox(width: 8),
                                    Text(
                                      'CRISIS SUMMARY',
                                      style: TextStyle(
                                        fontSize: 11,
                                        letterSpacing: 1,
                                        color: AppColors.textMuted,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  state.dossier!.crisisTitle ?? 'Crisis Incident',
                                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.text),
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    _buildInfoBadge(Icons.radio_button_checked, state.dossier!.crisisStatus ?? '-'),
                                    const SizedBox(width: 8),
                                    _buildInfoBadge(Icons.wifi_tethering_rounded, '${state.dossier!.signalCount} signals'),
                                    const SizedBox(width: 8),
                                    _buildInfoBadge(Icons.smart_toy_outlined, '${state.dossier!.agentRunCount} runs'),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (state.agentTraces.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.terminal_rounded, color: AppColors.accent, size: 18),
                                    SizedBox(width: 8),
                                    Text(
                                      'AI AGENT DISPATCH TRACES',
                                      style: TextStyle(
                                        fontSize: 11,
                                        letterSpacing: 1,
                                        color: AppColors.textMuted,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.4),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: state.agentTraces.map((t) => Padding(
                                      padding: const EdgeInsets.only(bottom: 6),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text('> ', style: TextStyle(color: AppColors.accent, fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.bold)),
                                          Expanded(
                                            child: Text(t, style: TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.textMuted)),
                                          ),
                                        ],
                                      ),
                                    )).toList(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          if (state.hasActiveDispatch || state.dispatchUnits.isNotEmpty)
                            Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 12),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withValues(alpha: 0.3),
                                    blurRadius: 15,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  minimumSize: const Size(double.infinity, 58),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                ),
                                onPressed: () => context.push(
                                  '/dashboard/${widget.reportId}/tracking',
                                ),
                                icon: const Icon(Icons.local_shipping_rounded,
                                    size: 20, color: Colors.white),
                                label: Text(
                                  state.dispatchUnits.isNotEmpty
                                      ? 'TRACK DISPATCHED UNITS (${state.dispatchUnits.length})'
                                      : 'LIVE DISPATCH TRACKING',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          if (state.dispatchUnits.isNotEmpty)
                            Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'UNITS EN ROUTE',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1,
                                        color: AppColors.textMuted,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    ...state.dispatchUnits.map((u) => Padding(
                                          padding: const EdgeInsets.only(bottom: 6),
                                          child: Row(
                                            children: [
                                              Icon(Icons.emergency_rounded,
                                                  size: 16, color: AppColors.primary),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  '${u.unit}${u.facility != null ? ' · ${u.facility}' : ''}',
                                                  style: TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w600,
                                                    color: AppColors.text,
                                                  ),
                                                ),
                                              ),
                                              Text(
                                                u.arrived
                                                    ? 'Arrived'
                                                    : '${u.etaMinutes ?? "?"}m',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w900,
                                                  color: AppColors.accent,
                                                  fontSize: 13,
                                                ),
                                              ),
                                            ],
                                          ),
                                        )),
                                  ],
                                ),
                              ),
                            ),
                          Container(
                            width: double.infinity,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.accent.withValues(alpha: 0.25),
                                  blurRadius: 15,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.accent,
                                minimumSize: const Size(double.infinity, 58),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              onPressed: () => context.push('/dashboard/${widget.reportId}/route'),
                              icon: const Icon(Icons.map_rounded, size: 20, color: Colors.white),
                              label: const Text(
                                'GET SAFE EVACUATION ROUTE',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.white),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(double.infinity, 54),
                              side: BorderSide(color: AppColors.border, width: 1.5),
                            ),
                            onPressed: () => context.go('/'),
                            icon: const Icon(Icons.home_rounded, size: 18),
                            label: const Text('Back to Home Screen'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildInfoBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.textMuted),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
