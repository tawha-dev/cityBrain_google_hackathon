import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/chat/chat_screen.dart';
import '../../features/chat/safety_chat_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/report/report_category_screen.dart';
import '../../features/report/report_location_screen.dart';
import '../../features/report/report_review_screen.dart';
import '../../features/demo/demo_scenarios_screen.dart';
import '../../features/dispatch_tracking/dispatch_tracking_screen.dart';
import '../../features/route_map/route_map_screen.dart';
import '../../features/splash/splash_screen.dart';

class ThemeSyncWrapper extends StatelessWidget {
  const ThemeSyncWrapper({super.key, required this.childBuilder});
  final Widget Function(BuildContext) childBuilder;

  @override
  Widget build(BuildContext context) {
    Theme.of(context); // Listen to theme changes reactively
    return childBuilder(context);
  }
}

final appRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/',
      builder: (context, state) => ThemeSyncWrapper(
        childBuilder: (context) => const HomeScreen(),
      ),
    ),
    GoRoute(
      path: '/chat',
      builder: (context, state) => ThemeSyncWrapper(
        childBuilder: (context) => const ChatScreen(),
      ),
    ),
    GoRoute(
      path: '/chat/safety',
      builder: (context, state) => ThemeSyncWrapper(
        childBuilder: (context) => const SafetyChatScreen(),
      ),
    ),
    GoRoute(
      path: '/demo',
      builder: (context, state) => ThemeSyncWrapper(
        childBuilder: (context) => const DemoScenariosScreen(),
      ),
    ),
    GoRoute(
      path: '/report',
      builder: (context, state) => ThemeSyncWrapper(
        childBuilder: (context) => const ReportCategoryScreen(),
      ),
      routes: [
        GoRoute(
          path: 'location',
          builder: (context, state) => ThemeSyncWrapper(
            childBuilder: (context) => const ReportLocationScreen(),
          ),
        ),
        GoRoute(
          path: 'review',
          builder: (context, state) => ThemeSyncWrapper(
            childBuilder: (context) => const ReportReviewScreen(),
          ),
        ),
      ],
    ),
    GoRoute(
      path: '/dashboard/:reportId',
      builder: (context, state) {
        final reportId = state.pathParameters['reportId']!;
        final crisisId = state.extra as String?;
        return ThemeSyncWrapper(
          childBuilder: (context) => DashboardScreen(reportId: reportId, crisisId: crisisId),
        );
      },
      routes: [
        GoRoute(
          path: 'route',
          builder: (context, state) {
            final reportId = state.pathParameters['reportId']!;
            return ThemeSyncWrapper(
              childBuilder: (context) => RouteMapScreen(reportId: reportId),
            );
          },
        ),
        GoRoute(
          path: 'tracking',
          builder: (context, state) {
            final reportId = state.pathParameters['reportId']!;
            return ThemeSyncWrapper(
              childBuilder: (context) =>
                  DispatchTrackingScreen(reportId: reportId),
            );
          },
        ),
      ],
    ),
  ],
  errorBuilder: (context, state) => Scaffold(
    body: Center(child: Text('Page not found: ${state.uri}')),
  ),
);
