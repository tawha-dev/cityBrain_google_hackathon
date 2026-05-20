import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/providers.dart';
import '../../core/storage/report_queue.dart';
import '../../core/theme/app_theme.dart';
import '../report/report_categories.dart';
import 'report_queue_sync.dart';
import 'reports_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String _getCategoryEmoji(String? id) {
    if (id == null || id.isEmpty) return '⚠️';
    for (final c in kEmergencyCategories) {
      if (c.id == id) return c.emoji;
    }
    return '⚠️';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(reportQueueSyncProvider);
    final reportsAsync = ref.watch(myReportsProvider);

    return Scaffold(
      backgroundColor: AppColors.brandBlack,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const _HomeBackground(),
          RefreshIndicator(
            color: AppColors.primary,
            backgroundColor: AppColors.card,
            onRefresh: () async {
              ref.invalidate(reportQueueSyncProvider);
              ref.invalidate(myReportsProvider);
            },
            child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Premium Header with a glassmorphic look
            SliverAppBar(
              floating: true,
              pinned: true,
              expandedHeight: 80,
              backgroundColor: AppColors.brandBlack.withValues(alpha: 0.72),
              flexibleSpace: FlexibleSpaceBar(
                centerTitle: false,
                titlePadding: const EdgeInsets.only(left: 20, bottom: 12),
                title: Row(
                  children: [
                    Text(
                      'CityBrain',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 22,
                        color: AppColors.text,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Citizen',
                      style: TextStyle(
                        fontWeight: FontWeight.w400,
                        fontSize: 22,
                        color: AppColors.primary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      margin: const EdgeInsets.only(right: 20),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: AppColors.success,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text(
                            'ONLINE',
                            style: TextStyle(
                              fontSize: 7,
                              fontWeight: FontWeight.bold,
                              color: AppColors.success,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (AppConfig.isEmulatorLoopbackHost)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 20),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.warn.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.warn.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.info_outline_rounded, color: AppColors.warn, size: 20),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Text(
                                'API uses 10.0.2.2 - that only works on the Android emulator. '
                                'On a real phone, edit assets/config/api_config.json with your PC LAN IP (ipconfig), then restart the app.',
                                style: TextStyle(color: AppColors.warn, fontSize: 12, height: 1.4),
                              ),
                            ),
                          ],
                        ),
                      ),
                    
                    // High-impact Emergency Alert Banner
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [
                            AppColors.brandTealDark,
                            AppColors.brandTeal,
                            AppColors.brandTealLight,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          stops: [0.0, 0.48, 1.0],
                        ),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.brandTeal.withValues(alpha: 0.4),
                            blurRadius: 24,
                            offset: const Offset(0, 10),
                          ),
                          BoxShadow(
                            color: AppColors.brandTealDark.withValues(alpha: 0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Stack(
                          children: [
                            Positioned(
                              right: -20,
                              top: -20,
                              child: Icon(
                                Icons.campaign_rounded,
                                size: 150,
                                color: Colors.white.withValues(alpha: 0.08),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 28),
                                      const SizedBox(width: 10),
                                      const Text(
                                        'EMERGENCY ALERT',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.8,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Report floods, accidents, fires, or other crises. '
                                    'Authorities receive your location and AI-validated alert in real time.',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.9),
                                      fontSize: 14,
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 24),
                                  
                                  // Primary action Button
                                  ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.white,
                                      foregroundColor: AppColors.primary,
                                      elevation: 0,
                                      minimumSize: const Size(double.infinity, 56),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                    ),
                                    onPressed: () => context.push('/report'),
                                    icon: const Icon(Icons.add_alert_rounded, size: 22),
                                    label: const Text(
                                      'Report Now',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 18,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  
                                  // Secondary Action Buttons
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: Colors.white,
                                            side: const BorderSide(color: Colors.white38, width: 1.5),
                                            minimumSize: const Size(0, 48),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                            padding: const EdgeInsets.symmetric(horizontal: 8),
                                          ),
                                          onPressed: () => context.push('/chat'),
                                          icon: const Icon(Icons.chat_bubble_outline_rounded, size: 16),
                                          label: const Text('AI Chat Draft', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: Colors.white,
                                            side: const BorderSide(color: Colors.white38, width: 1.5),
                                            minimumSize: const Size(0, 48),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                            padding: const EdgeInsets.symmetric(horizontal: 8),
                                          ),
                                          onPressed: () => context.push('/chat/safety'),
                                          icon: const Icon(Icons.shield_outlined, size: 16),
                                          label: const Text('Safety Tips', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  OutlinedButton.icon(
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      side: BorderSide(
                                        color: AppColors.accent.withValues(alpha: 0.6),
                                        width: 1.5,
                                      ),
                                      minimumSize: const Size(double.infinity, 44),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                    ),
                                    onPressed: () => context.push('/demo'),
                                    icon: const Icon(Icons.science_outlined, size: 18),
                                    label: const Text(
                                      'Demo Scenarios (high confidence)',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    Row(
                      children: [
                        Icon(Icons.history_toggle_off_rounded, color: AppColors.textMuted, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'YOUR ACTIVE REPORTS',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                            letterSpacing: 1.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            reportsAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: CircularProgressIndicator(strokeWidth: 3)),
                ),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: AppColors.danger),
                            const SizedBox(width: 10),
                            Text(
                              'Connection Issue',
                              style: TextStyle(
                                color: AppColors.text,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Could not load reports: $e',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'API: ${AppConfig.apiV1}',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.danger.withValues(alpha: 0.1),
                            foregroundColor: AppColors.danger,
                            minimumSize: const Size(double.infinity, 44),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () async {
                            final prefs = await ref.read(sharedPreferencesProvider.future);
                            await ReportQueueService(prefs).clearAll();
                            ref.invalidate(reportQueueSyncProvider);
                            ref.invalidate(myReportsProvider);
                          },
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Clear Queue & Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              data: (reports) {
                if (reports.isEmpty) {
                  return SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                        decoration: BoxDecoration(
                          color: AppColors.card.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.shield_moon_outlined, size: 48, color: AppColors.textMuted.withValues(alpha: 0.5)),
                            const SizedBox(height: 16),
                            Text(
                              'No active emergencies reported.',
                              style: TextStyle(
                                color: AppColors.text,
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Tap Report Now to submit your first alert.',
                              style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, i) {
                      final r = reports[i];
                      
                      Color statusBadgeColor;
                      Color statusTextColor;
                      switch(r.status.toLowerCase()) {
                        case 'submitted':
                          statusBadgeColor = AppColors.success.withValues(alpha: 0.15);
                          statusTextColor = AppColors.success;
                          break;
                        case 'pending':
                        case 'syncing':
                          statusBadgeColor = AppColors.warn.withValues(alpha: 0.15);
                          statusTextColor = AppColors.warn;
                          break;
                        case 'failed':
                          statusBadgeColor = AppColors.danger.withValues(alpha: 0.15);
                          statusTextColor = AppColors.danger;
                          break;
                        default:
                          statusBadgeColor = AppColors.border;
                          statusTextColor = AppColors.textMuted;
                      }

                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                        child: Card(
                          margin: EdgeInsets.zero,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () => context.push(
                              '/dashboard/${r.id}',
                              extra: r.crisisId,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(18),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        _getCategoryEmoji(r.category),
                                        style: const TextStyle(fontSize: 20),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          categoryLabel(r.category),
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                            letterSpacing: -0.2,
                                          ),
                                        ),
                                      ),
                                      Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    r.rawText,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: AppColors.textMuted, 
                                      fontSize: 13,
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: statusBadgeColor,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          r.status.toUpperCase(),
                                          style: TextStyle(
                                            fontSize: 10, 
                                            color: statusTextColor,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ),
                                      if (r.validationScore != null)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: AppColors.success.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            'Score ${r.validationScore}%',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: AppColors.success,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                    childCount: reports.length,
                  ),
                );
              },
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Splash-style ambient gradient behind home content.
class _HomeBackground extends StatelessWidget {
  const _HomeBackground();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _HomeBackgroundPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _HomeBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          AppColors.brandSurfaceTop,
          AppColors.brandBlack,
          AppColors.brandSurfaceMid,
        ],
        stops: [0, 0.5, 1],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, bg);

    void glow(Offset center, double radius, double alpha) {
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            AppColors.brandTeal.withValues(alpha: alpha),
            AppColors.brandTeal.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromCircle(center: center, radius: radius));
      canvas.drawCircle(center, radius, paint);
    }

    glow(Offset(size.width * 0.85, size.height * 0.08), size.width * 0.42, 0.1);
    glow(Offset(size.width * 0.12, size.height * 0.72), size.width * 0.48, 0.06);
    glow(Offset(size.width * 0.5, size.height * 0.38), size.width * 0.32, 0.04);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

//
