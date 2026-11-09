import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nukrop_app/core/networking/api_client.dart';
import 'package:nukrop_app/core/storage/secure_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  group('ApiClient Enterprise Network Engine Suite', () {
    test('Injects Authorization, Correlation ID, and Idempotency headers on mutations', () async {
      await SecureStorage.saveTokens(
        accessToken: 'valid_test_access_jwt',
        refreshToken: 'valid_test_refresh_jwt',
      );

      String? capturedAuth;
      String? capturedCorrId;
      String? capturedIdemKey;

      final mockClient = MockClient((request) async {
        capturedAuth = request.headers['Authorization'];
        capturedCorrId = request.headers['X-Correlation-Id'];
        capturedIdemKey = request.headers['X-Idempotency-Key'];
        return http.Response(jsonEncode({'status': 'ok'}), 200);
      });

      ApiClient.setMockClient(mockClient);

      final result = await ApiClient.post<Map<String, dynamic>>(
        '/test/endpoint',
        body: {'key': 'value'},
      );

      expect(result['status'], equals('ok'));
      expect(capturedAuth, equals('Bearer valid_test_access_jwt'));
      expect(capturedCorrId, startsWith('nukrop_corr_'));
      expect(capturedIdemKey, startsWith('idem_'));
    });

    test('Classifies 409 Conflict with ConflictException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Email address is already registered'}),
          409,
        );
      });

      ApiClient.setMockClient(mockClient);

      expect(
        () => ApiClient.post('/auth/register', body: {'email': 'dup@test.com'}),
        throwsA(isA<ConflictException>()),
      );
    });

    test('Classifies 403 Forbidden with ForbiddenException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Forbidden: Administrative self-registration prohibited'}),
          403,
        );
      });

      ApiClient.setMockClient(mockClient);

      expect(
        () => ApiClient.post('/auth/register', body: {'role': 'admin'}),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test('Handles 401 Unauthorized by executing token refresh and retrying original request', () async {
      await SecureStorage.saveTokens(
        accessToken: 'expired_access_token',
        refreshToken: 'valid_refresh_token',
      );

      int requestCount = 0;
      final mockClient = MockClient((request) async {
        requestCount++;
        if (request.url.path.contains('/auth/refresh')) {
          return http.Response(
            jsonEncode({
              'accessToken': 'fresh_rotated_access_token',
              'refreshToken': 'fresh_rotated_refresh_token',
            }),
            200,
          );
        }

        if (request.headers['Authorization'] == 'Bearer expired_access_token') {
          return http.Response(jsonEncode({'error': 'Token expired'}), 401);
        }

        if (request.headers['Authorization'] == 'Bearer fresh_rotated_access_token') {
          return http.Response(jsonEncode({'data': 'authorized_profile_payload'}), 200);
        }

        return http.Response(jsonEncode({'error': 'Unexpected token'}), 400);
      });

      ApiClient.setMockClient(mockClient);

      final res = await ApiClient.get<Map<String, dynamic>>('/user/profile');

      expect(res['data'], equals('authorized_profile_payload'));
      expect(requestCount, equals(3)); // Initial 401 -> Refresh call -> Successful retry

      // Verify new tokens saved in hardware Keystore
      final savedAccess = await SecureStorage.getAccessToken();
      expect(savedAccess, equals('fresh_rotated_access_token'));
    });
  });
}
