import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nukrop_app/core/models/user_session.dart';
import 'package:nukrop_app/core/storage/secure_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  group('SecureStorage Hardware-Backed & Preferences Isolation Suite', () {
    test('Stores and retrieves authentic session with JWT access and refresh tokens', () async {
      const session = UserSession(
        userId: 'usr_farmer_warangal_001',
        name: 'B. Jaswanth Reddy',
        phone: '+91 98765 43210',
        email: 'farmer@nukrop.ai',
        role: UserRole.farmer,
        state: 'Telangana',
        district: 'Warangal Rural',
        activeCrops: ['Cotton', 'Chilli'],
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
      );

      await SecureStorage.saveSession(session);

      final restored = await SecureStorage.getSession();
      expect(restored, isNotNull);
      expect(restored!.userId, equals('usr_farmer_warangal_001'));
      expect(restored.accessToken, equals('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access'));
      expect(restored.refreshToken, equals('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh'));

      final tokenDirect = await SecureStorage.getAccessToken();
      expect(tokenDirect, equals('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access'));
    });

    test('Rotates access and refresh tokens without corrupting profile', () async {
      const session = UserSession(
        userId: 'usr_farmer_002',
        name: 'Suresh Driver',
        role: UserRole.driver,
        accessToken: 'initial_access_token',
        refreshToken: 'initial_refresh_token',
      );

      await SecureStorage.saveSession(session);

      // Perform token rotation
      await SecureStorage.saveTokens(
        accessToken: 'rotated_access_token_v2',
        refreshToken: 'rotated_refresh_token_v2',
      );

      final token = await SecureStorage.getAccessToken();
      final refresh = await SecureStorage.getRefreshToken();
      expect(token, equals('rotated_access_token_v2'));
      expect(refresh, equals('rotated_refresh_token_v2'));

      final updatedSession = await SecureStorage.getSession();
      expect(updatedSession!.accessToken, equals('rotated_access_token_v2'));
      expect(updatedSession.role, equals(UserRole.driver));
    });

    test('clearSession purges all sensitive credentials and tokens', () async {
      const session = UserSession(
        userId: 'usr_farmer_003',
        name: 'Farmer Test',
        accessToken: 'sensitive_jwt_token',
      );

      await SecureStorage.saveSession(session);
      expect(await SecureStorage.getAccessToken(), isNotNull);

      await SecureStorage.clearSession();

      expect(await SecureStorage.getSession(), isNull);
      expect(await SecureStorage.getAccessToken(), isNull);
      expect(await SecureStorage.getRefreshToken(), isNull);
    });

    test('Non-sensitive preferences are isolated in SharedPreferences without token leak', () async {
      await SecureStorage.saveLanguage('te');
      await SecureStorage.setOnboardingCompleted(true);

      final lang = await SecureStorage.getLanguage();
      final onboarding = await SecureStorage.isOnboardingCompleted();

      expect(lang, equals('te'));
      expect(onboarding, isTrue);

      final prefs = await SharedPreferences.getInstance();
      // Ensure SharedPreferences does NOT hold access token or refresh token keys
      expect(prefs.containsKey('nukrop_access_token'), isFalse);
      expect(prefs.containsKey('nukrop_refresh_token'), isFalse);
    });
  });
}
