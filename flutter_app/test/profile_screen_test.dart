import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nukrop_app/core/models/user_session.dart';
import 'package:nukrop_app/core/networking/api_client.dart';
import 'package:nukrop_app/features/profile/profile_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  group('UserSession Public Profile Discovery Model Tests', () {
    test('UserSession defaults publicProfileEnabled to false (default shield)',
        () {
      const session = UserSession(
        userId: 'f_test_001',
        name: 'Rao Bahadur',
      );
      expect(session.publicProfileEnabled, isFalse);
    });

    test('UserSession copyWith updates publicProfileEnabled cleanly', () {
      const session = UserSession(
        userId: 'f_test_001',
        name: 'Rao Bahadur',
        publicProfileEnabled: false,
      );
      final updated = session.copyWith(publicProfileEnabled: true);
      expect(updated.publicProfileEnabled, isTrue);
      expect(updated.userId, equals(session.userId));
      expect(updated.name, equals(session.name));

      final revoked = updated.copyWith(publicProfileEnabled: false);
      expect(revoked.publicProfileEnabled, isFalse);
    });

    test('UserSession toJson and fromJson preserves publicProfileEnabled', () {
      const sessionOptedIn = UserSession(
        userId: 'f_test_002',
        name: 'Laxmi Devi',
        publicProfileEnabled: true,
      );
      final json = sessionOptedIn.toJson();
      expect(json['publicProfileEnabled'], isTrue);

      final restored = UserSession.fromJson(json);
      expect(restored.publicProfileEnabled, isTrue);

      const sessionOptedOut = UserSession(
        userId: 'f_test_003',
        name: 'Suresh Kumar',
        publicProfileEnabled: false,
      );
      final jsonOut = sessionOptedOut.toJson();
      expect(jsonOut['publicProfileEnabled'], isFalse);

      final restoredOut = UserSession.fromJson(jsonOut);
      expect(restoredOut.publicProfileEnabled, isFalse);
    });
  });

  group('ProfileScreen Discovery Toggle Widget Tests', () {
    testWidgets('ProfileScreen initializes Switch with session opt-in status',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/auth/profile/discovery')) {
          return http.Response(
            jsonEncode({'success': true, 'public_profile_enabled': false}),
            200,
          );
        }
        return http.Response(jsonEncode({'status': 'ok'}), 200);
      });
      ApiClient.setMockClient(mockClient);

      const optedOutSession = UserSession(
        userId: 'f_test_101',
        name: 'Kisan One',
        publicProfileEnabled: false,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProfileScreen(
              session: optedOutSession,
              onLogout: () {},
              onReplaySplash: () {},
              onOpenLanguageSheet: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify privacy discovery toggle exists
      expect(find.textContaining('Public Profile Discovery'), findsOneWidget);
      expect(
        find.text(
            'Your profile is completely hidden from public discovery (default shield)'),
        findsOneWidget,
      );

      // Verify switch is OFF
      final switchFinder = find.byType(Switch);
      expect(switchFinder, findsOneWidget);
      final Switch switchWidget = tester.widget(switchFinder);
      expect(switchWidget.value, isFalse);
    });

    testWidgets('ProfileScreen displays discoverable subtitle when opted in',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/auth/profile/discovery')) {
          return http.Response(
            jsonEncode({'success': true, 'public_profile_enabled': true}),
            200,
          );
        }
        return http.Response(jsonEncode({'status': 'ok'}), 200);
      });
      ApiClient.setMockClient(mockClient);

      const optedInSession = UserSession(
        userId: 'f_test_102',
        name: 'Kisan Two',
        publicProfileEnabled: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProfileScreen(
              session: optedInSession,
              onLogout: () {},
              onReplaySplash: () {},
              onOpenLanguageSheet: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Public Profile Discovery'), findsOneWidget);
      expect(
        find.text(
            'Your name and district are visible in public community discovery'),
        findsOneWidget,
      );

      final switchFinder = find.byType(Switch);
      expect(switchFinder, findsOneWidget);
      final Switch switchWidget = tester.widget(switchFinder);
      expect(switchWidget.value, isTrue);
    });

    testWidgets('ProfileScreen reverts switch state upon network error',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final mockClient = MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path.contains('/auth/profile/discovery')) {
          return http.Response(
            jsonEncode({'success': true, 'public_profile_enabled': false}),
            200,
          );
        }
        if (request.method == 'PATCH' &&
            request.url.path.contains('/auth/profile/discovery')) {
          return http.Response(
            jsonEncode({'error': 'Database failure'}),
            500,
          );
        }
        return http.Response(jsonEncode({'status': 'ok'}), 200);
      });
      ApiClient.setMockClient(mockClient);

      const initialSession = UserSession(
        userId: 'f_test_103',
        name: 'Kisan Three',
        publicProfileEnabled: false,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProfileScreen(
              session: initialSession,
              onLogout: () {},
              onReplaySplash: () {},
              onOpenLanguageSheet: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final switchFinder = find.byType(Switch);
      expect(switchFinder, findsOneWidget);
      expect((tester.widget(switchFinder) as Switch).value, isFalse);

      // Tap the switch to trigger opt-in (which will fail with 500)
      await tester.tap(switchFinder);
      await tester.pump();
      await tester.pumpAndSettle();

      // Verify switch was reverted to false
      expect((tester.widget(switchFinder) as Switch).value, isFalse);
    });
  });
}
