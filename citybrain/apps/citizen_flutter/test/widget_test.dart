import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:citybrain_citizen/app.dart';
import 'package:citybrain_citizen/core/config/app_config.dart';
import 'package:citybrain_citizen/features/home/reports_provider.dart';
import 'package:citybrain_citizen/shared/models/models.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await AppConfig.ensureLoaded();
  });

  testWidgets('App loads home', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          myReportsProvider.overrideWith((ref) async => <CitizenReport>[]),
        ],
        child: const CityBrainCitizenApp(),
      ),
    );
    await tester.pump();
    expect(find.text('Report Now'), findsOneWidget);
  });
}
