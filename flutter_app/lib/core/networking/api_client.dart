import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  static final http.Client _client = http.Client();

  static Future<Map<String, String>> _buildHeaders({bool isMutation = false}) async {
    final session = await SecureStorage.getSession();
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (session?.accessToken != null) {
      headers['Authorization'] = 'Bearer ${session!.accessToken}';
    }
    if (isMutation) {
      headers['X-Idempotency-Key'] = 'idem_${DateTime.now().millisecondsSinceEpoch}';
    }
    return headers;
  }

  static Future<dynamic> get(String endpoint) async {
    try {
      final headers = await _buildHeaders();
      final url = Uri.parse('${AppConstants.apiBaseUrl}$endpoint');
      final response = await _client.get(url, headers: headers).timeout(
            const Duration(seconds: 10),
          );
      return _handleResponse(response);
    } catch (e) {
      // Graceful offline fallback
      return null;
    }
  }

  static Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    try {
      final headers = await _buildHeaders(isMutation: true);
      final url = Uri.parse('${AppConstants.apiBaseUrl}$endpoint');
      final response = await _client
          .post(url, headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 10));
      return _handleResponse(response);
    } catch (e) {
      return null;
    }
  }

  static dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return true;
      return jsonDecode(response.body);
    } else {
      return null;
    }
  }
}
