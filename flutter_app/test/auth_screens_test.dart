import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nukrop_app/core/networking/api_client.dart';
import 'package:nukrop_app/core/storage/secure_storage.dart';
import 'package:nukrop_app/features/auth/login_screen.dart';
import 'package:nukrop_app/features/auth/register_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  group('Authentication Flow Integration Suite', () {
    testWidgets('LoginScreen dispatches authentic POST /auth/login and stores canonical identity', (WidgetTester tester) async {
      bool loginSuccessCalled = false;

      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/auth/login')) {
          final body = jsonDecode(request.body);
          if (body['email'] == '9876543210@nukrop.ai' && body['password'] == 'SecretPass@2026') {
            return http.Response(
              jsonEncode({
                'accessToken': 'auth_test_access_jwt',
                'refreshToken': 'auth_test_refresh_jwt',
                'user': {
                  'id': 'uuid-canonical-farmer-100',
                  'name': 'Jaswanth Reddy',
                  'email': '9876543210@nukrop.ai',
                  'role': 'farmer',
                },
              }),
              200,
            );
          }
        }
        return http.Response(jsonEncode({'error': 'Invalid credentials'}), 401);
      });

      ApiClient.setMockClient(mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            onLoginSuccess: () => loginSuccessCalled = true,
            onNavigateToRegister: () {},
          ),
        ),
      );

      // Enter credentials
      await tester.enterText(find.byType(TextField).first, '9876543210');
      await tester.enterText(find.byType(TextField).last, 'SecretPass@2026');
      await tester.pump();

      // Tap Sign In
      await tester.tap(find.text('Sign In'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(loginSuccessCalled, isTrue);

      // Verify canonical identity stored in hardware Keystore
      final session = await SecureStorage.getSession();
      expect(session, isNotNull);
      expect(session!.userId, equals('uuid-canonical-farmer-100'));
      expect(session.accessToken, equals('auth_test_access_jwt'));
    });

    testWidgets('RegisterScreen dispatches authentic POST /auth/register and verifies role', (WidgetTester tester) async {
      bool registerSuccessCalled = false;

      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/auth/register')) {
          final body = jsonDecode(request.body);
          if (body['email'] == 'newfarmer@nukrop.ai' && body['role'] == 'farmer') {
            return http.Response(
              jsonEncode({
                'accessToken': 'new_reg_access_jwt',
                'refreshToken': 'new_reg_refresh_jwt',
                'user': {
                  'id': 'uuid-registered-farmer-200',
                  'email': 'newfarmer@nukrop.ai',
                  'role': 'farmer',
                },
              }),
              201,
            );
          }
        }
        return http.Response(jsonEncode({'error': 'Registration rejected'}), 400);
      });

      ApiClient.setMockClient(mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: RegisterScreen(
            onRegisterSuccess: () => registerSuccessCalled = true,
            onNavigateToLogin: () {},
          ),
        ),
      );

      // Fill in fields
      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'Ramesh Kumar');
      await tester.enterText(textFields.at(1), 'newfarmer@nukrop.ai');
      await tester.enterText(textFields.at(2), 'NewPass@2026');

      // Check Terms
      await tester.tap(find.byType(Checkbox));
      await tester.pump();

      // Tap Create Account Button
      await tester.tap(find.widgetWithText(ElevatedButton, 'Create Account'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(registerSuccessCalled, isTrue);

      final session = await SecureStorage.getSession();
      expect(session, isNotNull);
      expect(session!.userId, equals('uuid-registered-farmer-200'));
      expect(session.accessToken, equals('new_reg_access_jwt'));
    });
  });
}
