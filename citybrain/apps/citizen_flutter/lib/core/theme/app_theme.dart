import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// CityBrain brand palette — aligned with [SplashScreen] (black + mint teal).
class AppColors {
  static ThemeData? _currentTheme;

  static void updateTheme(ThemeData theme) {
    _currentTheme = theme;
  }

  static bool get isDark {
    if (_currentTheme != null) {
      return _currentTheme!.brightness == Brightness.dark;
    }
    return WidgetsBinding.instance.platformDispatcher.platformBrightness ==
        Brightness.dark;
  }

  // Brand (splash)
  static const brandTeal = Color(0xFF00CBA9);
  static const brandTealLight = Color(0xFF37E2B4);
  static const brandTealDark = Color(0xFF009B82);
  static const brandBlack = Color(0xFF000000);
  static const brandSurfaceTop = Color(0xFF020202);
  static const brandSurfaceMid = Color(0xFF050808);
  static const brandCard = Color(0xFF0F1219);
  static const brandBorder = Color(0xFF1A2E2A);

  // Semantic (unchanged — alerts / status)
  static const primary = brandTeal;
  static const danger = Color(0xFFFF3B30);
  static const warn = Color(0xFFFF9500);
  static const success = Color(0xFF34C759);

  static Color get surface => isDark ? brandBlack : const Color(0xFFF2F6F5);

  static Color get card => isDark ? brandCard : const Color(0xFFFFFFFF);

  static Color get border => isDark ? brandBorder : const Color(0xFFD0E8E3);

  static Color get accent => isDark ? brandTeal : brandTealDark;

  static Color get text =>
      isDark ? const Color(0xFFF2F4F8) : const Color(0xFF0A1210);

  static Color get textMuted =>
      isDark ? const Color(0xFF8A9A94) : const Color(0xFF4A5C56);

  static Color get textPlaceholder =>
      isDark ? const Color(0xFF4A5C56) : const Color(0xFF94A8A2);

  /// Teal gradient stops for banners, bubbles, FABs.
  static const List<Color> brandGradient = [
    brandTeal,
    brandTealLight,
  ];
}

ThemeData buildDarkTheme() {
  return _buildThemeForBrightness(Brightness.dark);
}

ThemeData buildLightTheme() {
  return _buildThemeForBrightness(Brightness.light);
}

ThemeData _buildThemeForBrightness(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final baseTheme = ThemeData(
    useMaterial3: true,
    brightness: brightness,
  );

  final surfaceColor = isDark ? AppColors.brandBlack : const Color(0xFFF2F6F5);
  final cardColor = isDark ? AppColors.brandCard : const Color(0xFFFFFFFF);
  final borderColor = isDark ? AppColors.brandBorder : const Color(0xFFD0E8E3);
  final textColor =
      isDark ? const Color(0xFFF2F4F8) : const Color(0xFF0A1210);
  final textMutedColor =
      isDark ? const Color(0xFF8A9A94) : const Color(0xFF4A5C56);
  final textPlaceholderColor =
      isDark ? const Color(0xFF4A5C56) : const Color(0xFF94A8A2);
  final primaryColor = AppColors.brandTeal;
  final accentColor = isDark ? AppColors.brandTeal : AppColors.brandTealDark;

  final colorScheme = isDark
      ? ColorScheme.dark(
          primary: primaryColor,
          onPrimary: AppColors.brandBlack,
          secondary: AppColors.brandTealLight,
          onSecondary: AppColors.brandBlack,
          surface: cardColor,
          onSurface: textColor,
          error: AppColors.danger,
          outline: borderColor,
        )
      : ColorScheme.light(
          primary: primaryColor,
          onPrimary: Colors.white,
          secondary: AppColors.brandTealDark,
          onSecondary: Colors.white,
          surface: cardColor,
          onSurface: textColor,
          error: AppColors.danger,
          outline: borderColor,
        );

  return baseTheme.copyWith(
    scaffoldBackgroundColor: surfaceColor,
    colorScheme: colorScheme,
    textTheme: GoogleFonts.outfitTextTheme(baseTheme.textTheme).copyWith(
      bodyLarge: GoogleFonts.outfit(color: textColor),
      bodyMedium: GoogleFonts.outfit(color: textMutedColor),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: surfaceColor,
      foregroundColor: textColor,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.outfit(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: textColor,
      ),
    ),
    cardTheme: CardThemeData(
      color: cardColor,
      elevation: isDark ? 4 : 2,
      shadowColor: isDark
          ? AppColors.brandTeal.withValues(alpha: 0.08)
          : Colors.black.withValues(alpha: 0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: borderColor, width: 1.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: isDark ? AppColors.brandBlack : Colors.white,
        minimumSize: const Size(double.infinity, 54),
        elevation: 2,
        shadowColor: primaryColor.withValues(alpha: 0.35),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: textColor,
        minimumSize: const Size(double.infinity, 54),
        side: BorderSide(color: borderColor, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.outfit(
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: primaryColor,
      foregroundColor: isDark ? AppColors.brandBlack : Colors.white,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: primaryColor,
      linearTrackColor: borderColor,
    ),
    dividerTheme: DividerThemeData(color: borderColor, thickness: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: cardColor,
      hintStyle: GoogleFonts.outfit(color: textPlaceholderColor),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: borderColor, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: borderColor, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: accentColor, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
    ),
  );
}
