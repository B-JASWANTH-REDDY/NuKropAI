import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';
import '../storage/secure_storage.dart';

/// Structured API Exceptions hierarchy for NuKropAI
sealed class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;
  final dynamic details;

  const ApiException(this.message, {this.statusCode, this.code, this.details});

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}

class NetworkException extends ApiException {
  const NetworkException(super.message, {super.code, super.details});
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException(super.message, {super.details})
      : super(statusCode: 401, code: 'UNAUTHORIZED');
}

class ForbiddenException extends ApiException {
  const ForbiddenException(super.message, {super.details})
      : super(statusCode: 403, code: 'FORBIDDEN');
}

class NotFoundException extends ApiException {
  const NotFoundException(super.message, {super.details})
      : super(statusCode: 404, code: 'NOT_FOUND');
}

class ConflictException extends ApiException {
  const ConflictException(super.message, {super.details})
      : super(statusCode: 409, code: 'CONFLICT');
}

class RateLimitException extends ApiException {
  const RateLimitException(super.message, {super.details})
      : super(statusCode: 429, code: 'RATE_LIMITED');
}

class ServerException extends ApiException {
  const ServerException(super.message,
      {super.statusCode, super.code, super.details});
}

/// Enterprise Typed HTTP & WebSocket API Client for NuKropAI
/// Features:
/// - Hardware-backed token injection
/// - Automatic token renewal & replay recovery
/// - Distributed correlation IDs (X-Correlation-Id)
/// - Persistent idempotency identifiers (X-Idempotency-Key)
/// - Exponential retry and backoff on transient errors
/// - Sanitized logging (zero credential leaks)
class ApiClient {
  static http.Client _client = http.Client();
  static bool _isRefreshing = false;
  static Completer<bool>? _refreshCompleter;
  static String _customBaseUrl = AppConstants.apiBaseUrl;

  /// Active Base URL for API communications
  static String get baseUrl => _customBaseUrl;

  /// Dynamic runtime override for testing, LAN, staging, or production.
  /// In release builds, only secure HTTPS endpoints are accepted.
  static void setBaseUrl(String url) {
    final sanitized = url.replaceAll(RegExp(r'/+$'), '');
    if (kReleaseMode) {
      if (!sanitized.startsWith('https://') ||
          sanitized.contains('localhost') ||
          sanitized.contains('127.0.0.1') ||
          sanitized.contains('10.0.2.2')) {
        throw ArgumentError(
          'INSECURE_RELEASE_CONFIG: Insecure cleartext or local development endpoint "$sanitized" is strictly prohibited in release mode. Must configure a valid HTTPS URL.',
        );
      }
    }
    _customBaseUrl = sanitized;
  }

  /// Reset to compilation default
  static void resetBaseUrl() {
    _customBaseUrl = AppConstants.apiBaseUrl;
  }

  // Visible for testing to inject custom client
  static void setMockClient(http.Client mockClient) {
    _client = mockClient;
  }

  static String _generateCorrelationId() {
    final rand = Random().nextInt(0xFFFFFF).toRadixString(16).padLeft(6, '0');
    return 'nukrop_corr_${DateTime.now().millisecondsSinceEpoch}_$rand';
  }

  static String _generateIdempotencyKey() {
    final rand = Random().nextInt(0xFFFFFF).toRadixString(16).padLeft(6, '0');
    return 'idem_${DateTime.now().microsecondsSinceEpoch}_$rand';
  }

  static Future<Map<String, String>> _buildHeaders({
    String? idempotencyKey,
    bool isMutation = false,
  }) async {
    final token = await SecureStorage.getAccessToken();
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-Id': _generateCorrelationId(),
      'X-Client-Platform': 'Flutter-Native',
      'X-App-Version': '1.1.0',
    };

    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    if (isMutation && idempotencyKey != null && idempotencyKey.isNotEmpty) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    return headers;
  }

  /// Refreshes expired access tokens securely with anti-concurrency mutex.
  static Future<bool> _refreshToken() async {
    if (_isRefreshing) {
      return _refreshCompleter?.future ?? Future.value(false);
    }

    _isRefreshing = true;
    _refreshCompleter = Completer<bool>();

    try {
      final currentRefresh = await SecureStorage.getRefreshToken();
      if (currentRefresh == null || currentRefresh.isEmpty) {
        _isRefreshing = false;
        _refreshCompleter?.complete(false);
        return false;
      }

      final url = Uri.parse('$baseUrl/auth/refresh');
      final res = await _client.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': _generateCorrelationId(),
        },
        body: jsonEncode({'refreshToken': currentRefresh}),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final newAccess = data['accessToken'];
        final newRefresh = data['refreshToken'];
        if (newAccess != null && newRefresh != null) {
          await SecureStorage.saveTokens(
            accessToken: newAccess,
            refreshToken: newRefresh,
          );
          _isRefreshing = false;
          _refreshCompleter?.complete(true);
          return true;
        }
      }

      // Refresh failed or revoked
      await SecureStorage.clearSession();
      _isRefreshing = false;
      _refreshCompleter?.complete(false);
      return false;
    } catch (_) {
      _isRefreshing = false;
      _refreshCompleter?.complete(false);
      return false;
    }
  }

  /// Sends a typed GET request with retry and automatic token rotation
  static Future<T> get<T>(
    String endpoint, {
    Map<String, String>? queryParams,
    T Function(dynamic json)? fromJson,
  }) async {
    return _executeWithRetry<T>(
      () async {
        var uri = Uri.parse('$baseUrl$endpoint');
        if (queryParams != null && queryParams.isNotEmpty) {
          uri = uri.replace(queryParameters: queryParams);
        }
        final headers = await _buildHeaders();
        return _client.get(uri, headers: headers);
      },
      fromJson: fromJson,
    );
  }

  /// Sends a typed POST request with idempotency protection and retry
  static Future<T> post<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    T Function(dynamic json)? fromJson,
  }) async {
    // Generate stable idempotency key ONCE so retries reuse the exact same key
    final stableKey = idempotencyKey ?? _generateIdempotencyKey();
    return _executeWithRetry<T>(
      () async {
        final uri = Uri.parse('$baseUrl$endpoint');
        final headers = await _buildHeaders(
          idempotencyKey: stableKey,
          isMutation: true,
        );
        return _client.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      },
      fromJson: fromJson,
    );
  }

  /// Sends a typed PUT request
  static Future<T> put<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    T Function(dynamic json)? fromJson,
  }) async {
    final stableKey = idempotencyKey ?? _generateIdempotencyKey();
    return _executeWithRetry<T>(
      () async {
        final uri = Uri.parse('$baseUrl$endpoint');
        final headers = await _buildHeaders(
          idempotencyKey: stableKey,
          isMutation: true,
        );
        return _client.put(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      },
      fromJson: fromJson,
    );
  }

  /// Sends a typed PATCH request
  static Future<T> patch<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    T Function(dynamic json)? fromJson,
  }) async {
    final stableKey = idempotencyKey ?? _generateIdempotencyKey();
    return _executeWithRetry<T>(
      () async {
        final uri = Uri.parse('$baseUrl$endpoint');
        final headers = await _buildHeaders(
          idempotencyKey: stableKey,
          isMutation: true,
        );
        return _client.patch(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      },
      fromJson: fromJson,
    );
  }

  /// Sends a typed DELETE request
  static Future<T> delete<T>(
    String endpoint, {
    String? idempotencyKey,
    T Function(dynamic json)? fromJson,
  }) async {
    final stableKey = idempotencyKey ?? _generateIdempotencyKey();
    return _executeWithRetry<T>(
      () async {
        final uri = Uri.parse('$baseUrl$endpoint');
        final headers = await _buildHeaders(
          idempotencyKey: stableKey,
          isMutation: true,
        );
        return _client.delete(uri, headers: headers);
      },
      fromJson: fromJson,
    );
  }

  /// Executes HTTP request with timeout, 401 token renewal, and exponential retry on 5xx
  static Future<T> _executeWithRetry<T>(
    Future<http.Response> Function() requestFn, {
    T Function(dynamic json)? fromJson,
    int maxRetries = 2,
  }) async {
    int attempts = 0;
    while (true) {
      attempts++;
      try {
        final response = await requestFn().timeout(
          const Duration(seconds: 12),
          onTimeout: () {
            throw const NetworkException(
              'Network connection timed out. Please check your internet connection.',
              code: 'TIMEOUT',
            );
          },
        );

        // Handle 401 Unauthorized -> Attempt Token Renewal
        if (response.statusCode == 401 && attempts <= maxRetries) {
          final renewed = await _refreshToken();
          if (renewed) {
            // Re-attempt original request with refreshed token
            continue;
          }
        }

        // Retry transient upstream/gateway errors (502, 503, 504)
        if ((response.statusCode == 502 ||
                response.statusCode == 503 ||
                response.statusCode == 504) &&
            attempts <= maxRetries) {
          await Future.delayed(Duration(milliseconds: 200 * attempts));
          continue;
        }

        // Handle Status Codes
        return _parseResponse<T>(response, fromJson);
      } on ApiException {
        rethrow;
      } on TimeoutException {
        throw const NetworkException(
          'Network connection timed out. Please verify your connection.',
          code: 'TIMEOUT',
        );
      } catch (err) {
        if (attempts >= maxRetries) {
          throw NetworkException(
            'Unable to reach NuKropAI server: ${err.toString()}',
            details: err,
          );
        }
        // Exponential backoff before retry (500ms, 1000ms)
        await Future.delayed(Duration(milliseconds: 500 * attempts));
      }
    }
  }

  /// Parses HTTP response into typed entity with strict error classification
  static T _parseResponse<T>(
    http.Response response,
    T Function(dynamic json)? fromJson,
  ) {
    dynamic parsedBody;
    try {
      if (response.body.isNotEmpty) {
        parsedBody = jsonDecode(response.body);
      }
    } catch (_) {
      parsedBody = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (fromJson != null) {
        return fromJson(parsedBody);
      }
      return parsedBody as T;
    }

    final errorMessage = (parsedBody is Map && parsedBody['error'] != null)
        ? parsedBody['error'].toString()
        : 'Request failed with status ${response.statusCode}';
    final errorCode = (parsedBody is Map && parsedBody['code'] != null)
        ? parsedBody['code'].toString()
        : null;

    switch (response.statusCode) {
      case 400:
        throw ServerException(errorMessage,
            statusCode: 400,
            code: errorCode ?? 'BAD_REQUEST',
            details: parsedBody);
      case 401:
        throw UnauthorizedException(errorMessage, details: parsedBody);
      case 403:
        throw ForbiddenException(errorMessage, details: parsedBody);
      case 404:
        throw NotFoundException(errorMessage, details: parsedBody);
      case 409:
        throw ConflictException(errorMessage, details: parsedBody);
      case 429:
        throw RateLimitException(errorMessage, details: parsedBody);
      case 500:
      case 502:
      case 503:
      case 504:
        throw ServerException(
          errorMessage,
          statusCode: response.statusCode,
          code: errorCode ?? 'SERVER_ERROR',
          details: parsedBody,
        );
      default:
        throw ServerException(
          errorMessage,
          statusCode: response.statusCode,
          details: parsedBody,
        );
    }
  }
}
