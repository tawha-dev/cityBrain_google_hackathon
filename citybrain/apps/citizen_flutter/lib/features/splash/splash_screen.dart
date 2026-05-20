import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_theme.dart';

/// Branded launch screen shown once per cold start before [HomeScreen].
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  static const Duration displayDuration = Duration(milliseconds: 2800);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _introController;
  late final AnimationController _pulseController;
  late final AnimationController _progressController;
  late final AnimationController _wordController;

  late final Animation<double> _logoScale;
  late final Animation<double> _logoOpacity;
  late final Animation<double> _glowOpacity;
  late final Animation<double> _citizenOpacity;
  late final Animation<double> _citizenSlide;
  late final Animation<double> _taglineOpacity;
  late final Animation<double> _footerOpacity;
  late final Animation<double> _cityOpacity;
  late final Animation<double> _brainOpacity;

  @override
  void initState() {
    super.initState();

    _introController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);

    _progressController = AnimationController(
      vsync: this,
      duration: SplashScreen.displayDuration,
    )..forward();

    _wordController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    final introCurve = CurvedAnimation(
      parent: _introController,
      curve: Curves.easeOutCubic,
    );

    _logoScale = Tween<double>(begin: 0.82, end: 1).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0, 0.65, curve: Curves.easeOutBack),
      ),
    );
    _logoOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0, 0.4, curve: Curves.easeOut),
      ),
    );
    _glowOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.05, 0.55, curve: Curves.easeOut),
      ),
    );
    _citizenSlide = Tween<double>(begin: 16, end: 0).animate(introCurve);
    _citizenOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.35, 0.72, curve: Curves.easeOut),
      ),
    );
    _cityOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _wordController,
        curve: const Interval(0, 0.45, curve: Curves.easeOut),
      ),
    );
    _brainOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _wordController,
        curve: const Interval(0.35, 1, curve: Curves.easeOut),
      ),
    );
    _taglineOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.5, 0.88, curve: Curves.easeOut),
      ),
    );
    _footerOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _introController,
        curve: const Interval(0.62, 1, curve: Curves.easeOut),
      ),
    );

    _introController.forward();
    _wordController.forward();

    Future<void>.delayed(SplashScreen.displayDuration, () {
      if (mounted) context.go('/');
    });
  }

  @override
  void dispose() {
    _introController.dispose();
    _pulseController.dispose();
    _progressController.dispose();
    _wordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pulse = CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    );
    final maxLogoWidth = (MediaQuery.sizeOf(context).width * 0.88).clamp(260.0, 420.0);

    return Scaffold(
      backgroundColor: AppColors.brandBlack,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const _SplashBackground(),
          SafeArea(
            child: Column(
              children: [
                const Spacer(flex: 3),
                AnimatedBuilder(
                  animation: Listenable.merge([
                    _introController,
                    _pulseController,
                  ]),
                  builder: (context, _) {
                    final pulseScale = 1 + pulse.value * 0.018;
                    return Opacity(
                      opacity: _logoOpacity.value,
                      child: Transform.scale(
                        scale: _logoScale.value * pulseScale,
                        child: _HeroLogo(
                          maxWidth: maxLogoWidth,
                          glowStrength: _glowOpacity.value,
                          pulse: pulse.value,
                          brandTeal: AppColors.brandTeal,
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 28),
                AnimatedBuilder(
                  animation: Listenable.merge([
                    _introController,
                    _wordController,
                  ]),
                  builder: (context, _) {
                    return Opacity(
                      opacity: _citizenOpacity.value,
                      child: Transform.translate(
                        offset: Offset(0, _citizenSlide.value),
                        child: _StaggeredCitizenLine(
                          cityOpacity: _cityOpacity.value,
                          brainOpacity: _brainOpacity.value,
                          brandTeal: AppColors.brandTeal,
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 10),
                FadeTransition(
                  opacity: _taglineOpacity,
                  child: Text(
                    'Report · Track · Stay Safe',
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.55),
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
                const Spacer(flex: 4),
                FadeTransition(
                  opacity: _footerOpacity,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(40, 0, 40, 36),
                    child: Column(
                      children: [
                        AnimatedBuilder(
                          animation: _progressController,
                          builder: (context, _) {
                            return ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: LinearProgressIndicator(
                                value: _progressController.value,
                                minHeight: 3,
                                backgroundColor:
                                    Colors.white.withValues(alpha: 0.08),
                                color: AppColors.brandTeal,
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'SMART CITY EMERGENCY PLATFORM',
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.35),
                            letterSpacing: 2.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Radial teal accents + subtle grid on pure black.
class _SplashBackground extends StatelessWidget {
  const _SplashBackground();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _SplashBackgroundPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _SplashBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          AppColors.brandSurfaceTop,
          AppColors.brandBlack,
          AppColors.brandSurfaceMid,
        ],
        stops: [0, 0.45, 1],
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

    glow(Offset(size.width * 0.5, size.height * 0.34), size.width * 0.55, 0.12);
    glow(Offset(size.width * 0.92, size.height * 0.88), size.width * 0.4, 0.05);

    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.025)
      ..strokeWidth = 1;
    const spacing = 56.0;
    for (var x = 0.0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (var y = 0.0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Vector wordmark (transparent — no baked-in background) + soft teal aura.
class _HeroLogo extends StatelessWidget {
  const _HeroLogo({
    required this.maxWidth,
    required this.glowStrength,
    required this.pulse,
    required this.brandTeal,
  });

  final double maxWidth;
  final double glowStrength;
  final double pulse;
  final Color brandTeal;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: maxWidth,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Positioned(
            child: IgnorePointer(
              child: Container(
                width: maxWidth * 0.92,
                height: maxWidth * 0.38,
                decoration: BoxDecoration(
                  color: Colors.transparent,
                  boxShadow: [
                    BoxShadow(
                      color: brandTeal.withValues(
                        alpha: (0.22 + pulse * 0.08) *
                            glowStrength.clamp(0.0, 1.0),
                      ),
                      blurRadius: 48 + pulse * 16,
                      spreadRadius: 4,
                    ),
                  ],
                ),
              ),
            ),
          ),
          SvgPicture.asset(
            'assets/images/citybrain_logo.svg',
            width: maxWidth,
            fit: BoxFit.contain,
            alignment: Alignment.center,
            allowDrawingOutsideViewBox: true,
          ),
        ],
      ),
    );
  }
}

/// Wordmark-style subtitle: "Cit" (light) then "izen" (teal), staggered in time.
class _StaggeredCitizenLine extends StatelessWidget {
  const _StaggeredCitizenLine({
    required this.cityOpacity,
    required this.brainOpacity,
    required this.brandTeal,
  });

  final double cityOpacity;
  final double brainOpacity;
  final Color brandTeal;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Opacity(
          opacity: cityOpacity,
          child: Text(
            'Cit',
            style: GoogleFonts.outfit(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.92),
              letterSpacing: 2.8,
              height: 1,
            ),
          ),
        ),
        Opacity(
          opacity: brainOpacity,
          child: Text(
            'izen',
            style: GoogleFonts.outfit(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: brandTeal,
              letterSpacing: 2.8,
              height: 1,
            ),
          ),
        ),
      ],
    );
  }
}
