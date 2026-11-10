import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nukrop_app/app/app.dart';
import 'package:nukrop_app/core/models/user_session.dart';
import 'package:nukrop_app/core/models/mandi_rate.dart';
import 'package:nukrop_app/features/splash/splash_screen.dart';
import 'package:nukrop_app/features/onboarding/onboarding_screen.dart';

void main() {
  testWidgets(
      'NuKropAI Flutter App boots into SplashScreen with Agrarian branding',
      (WidgetTester tester) async {
    await tester.pumpWidget(const NuKropFlutterApp());

    expect(find.text('NuKropAI'), findsOneWidget);
    expect(find.text('Agrarian Intelligence Operating System'), findsOneWidget);
  });

  testWidgets('SplashScreen triggers callback upon completion',
      (WidgetTester tester) async {
    bool finished = false;
    await tester.pumpWidget(
      MaterialApp(
        home: SplashScreen(
          onSplashFinished: () {
            finished = true;
          },
        ),
      ),
    );

    expect(find.text('NuKropAI'), findsOneWidget);

    // Fast-forward periodic telemetry timer
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));

    expect(finished, isTrue);
  });

  testWidgets('OnboardingScreen navigates slides and supports crop selection',
      (WidgetTester tester) async {
    bool finished = false;
    await tester.pumpWidget(
      MaterialApp(
        home: OnboardingScreen(
          onOnboardingFinished: () {
            finished = true;
          },
        ),
      ),
    );

    expect(find.text('Welcome to NuKropAI'), findsOneWidget);
    expect(find.text('Step 1 of 8'), findsOneWidget);

    // Tap Next
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    expect(find.text('Instant Crop Disease Doctor'), findsOneWidget);
    expect(find.text('Step 2 of 8'), findsOneWidget);
    expect(finished, isFalse);
  });

  test('BioRx acreage and knapsack sprayer calculation logic', () {
    const double acres = 4.5;
    const double tankSize = 16.0;
    const double totalWater = acres * 200.0; // 900L
    final int charges = (totalWater / tankSize).ceil(); // 57 charges
    const double totalChemical = acres * 250.0; // 1125g

    expect(totalWater, equals(900.0));
    expect(charges, equals(57));
    expect(totalChemical, equals(1125.0));
  });

  test('UserSession model JSON serialization parity', () {
    const session = UserSession(
      userId: 'usr_test_123',
      name: 'Ramesh Patel',
      role: UserRole.farmer,
      state: 'Gujarat',
      district: 'Rajkot',
      activeCrops: ['Cotton', 'Groundnut'],
    );

    final json = session.toJson();
    final restored = UserSession.fromJson(json);

    expect(restored.userId, equals('usr_test_123'));
    expect(restored.name, equals('Ramesh Patel'));
    expect(restored.role, equals(UserRole.farmer));
    expect(restored.district, equals('Rajkot'));
    expect(restored.activeCrops, contains('Groundnut'));
  });

  test('MandiRate modal price and state integrity', () {
    final rate = MandiRate(
      id: 'm1',
      mandiName: 'Enumamula APMC',
      state: 'Telangana',
      district: 'Warangal',
      commodity: 'Cotton',
      modalPrice: 7850,
      minPrice: 7200,
      maxPrice: 8200,
      arrivalDate: DateTime.now(),
    );

    expect(rate.modalPrice, greaterThanOrEqualTo(rate.minPrice));
    expect(rate.modalPrice, lessThanOrEqualTo(rate.maxPrice));
    expect(rate.district, equals('Warangal'));
  });
}
