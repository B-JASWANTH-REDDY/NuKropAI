import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_session.dart';

/// Enterprise Platform-Backed Secure Storage for NuKropAI
/// Uses Android Keystore (via encryptedSharedPreferences) & iOS Keychain.
/// Non-sensitive preferences (language, onboarding) remain in SharedPreferences.
class SecureStorage {
  // Platform-backed hardware secure storage for tokens & cryptographic secrets
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(resetOnError: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // Secure Storage Keys
  static const String _keySession = 'nukrop_secure_session';
  static const String _keyAccessToken = 'nukrop_access_token';
  static const String _keyRefreshToken = 'nukrop_refresh_token';

  // SharedPreferences Keys (Non-sensitive preferences only)
  static const String _keyLanguage = 'nukrop_app_language';
  static const String _keyOnboardingDone = 'nukrop_onboarding_completed';

  /// Saves the active authenticated session into hardware-backed Keystore/Keychain.
  static Future<void> saveSession(UserSession session) async {
    // 1. Store tokens securely
    if (session.accessToken != null && session.accessToken!.isNotEmpty) {
      await _secureStorage.write(
        key: _keyAccessToken,
        value: session.accessToken,
      );
    }
    if (session.refreshToken != null && session.refreshToken!.isNotEmpty) {
      await _secureStorage.write(
        key: _keyRefreshToken,
        value: session.refreshToken,
      );
    }

    // 2. Store session record in secure storage (Never in SharedPreferences)
    await _secureStorage.write(
      key: _keySession,
      value: jsonEncode(session.toJson()),
    );

    // 3. Clean up any stale unencrypted session from legacy SharedPreferences
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.containsKey(_keySession)) {
        await prefs.remove(_keySession);
      }
    } catch (_) {}
  }

  /// Restores session from hardware-backed secure storage.
  /// Seamlessly migrates legacy sessions if found.
  static Future<UserSession?> getSession() async {
    // 1. Attempt hardware secure storage retrieval
    final secureData = await _secureStorage.read(key: _keySession);
    if (secureData != null && secureData.isNotEmpty) {
      try {
        final json = jsonDecode(secureData);
        // Ensure access token is synchronized
        final accessToken = await _secureStorage.read(key: _keyAccessToken);
        final refreshToken = await _secureStorage.read(key: _keyRefreshToken);
        json['accessToken'] = accessToken ?? json['accessToken'];
        json['refreshToken'] = refreshToken ?? json['refreshToken'];
        return UserSession.fromJson(json);
      } catch (_) {
        return null;
      }
    }

    // 2. Migration fallback: Check if legacy unencrypted session exists in SharedPreferences
    try {
      final prefs = await SharedPreferences.getInstance();
      final legacyData = prefs.getString(_keySession);
      if (legacyData != null && legacyData.isNotEmpty) {
        final json = jsonDecode(legacyData);
        final migratedSession = UserSession.fromJson(json);
        // Migrate to secure storage immediately
        await saveSession(migratedSession);
        // Purge plaintext from SharedPreferences
        await prefs.remove(_keySession);
        return migratedSession;
      }
    } catch (_) {}

    return null;
  }

  /// Retrieves the current Access Token from Keystore/Keychain.
  static Future<String?> getAccessToken() async {
    return _secureStorage.read(key: _keyAccessToken);
  }

  /// Retrieves the current Refresh Token from Keystore/Keychain.
  static Future<String?> getRefreshToken() async {
    return _secureStorage.read(key: _keyRefreshToken);
  }

  /// Updates or rotates tokens in Keystore/Keychain.
  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _secureStorage.write(key: _keyAccessToken, value: accessToken);
    await _secureStorage.write(key: _keyRefreshToken, value: refreshToken);

    // Update session object in secure storage if present
    final currentSession = await getSession();
    if (currentSession != null) {
      final updatedJson = currentSession.toJson();
      updatedJson['accessToken'] = accessToken;
      updatedJson['refreshToken'] = refreshToken;
      await _secureStorage.write(
        key: _keySession,
        value: jsonEncode(updatedJson),
      );
    }
  }

  /// Purges all sensitive credentials, tokens, and active session upon logout.
  static Future<void> clearSession() async {
    await _secureStorage.delete(key: _keySession);
    await _secureStorage.delete(key: _keyAccessToken);
    await _secureStorage.delete(key: _keyRefreshToken);

    // Clean up any legacy preferences
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keySession);
    } catch (_) {}
  }

  // --- Non-Sensitive Preferences (SharedPreferences) ---

  static Future<void> saveLanguage(String langCode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyLanguage, langCode);
  }

  static Future<String> getLanguage() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyLanguage) ?? 'en';
  }

  static Future<void> setOnboardingCompleted(bool completed) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyOnboardingDone, completed);
  }

  static Future<bool> isOnboardingCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyOnboardingDone) ?? false;
  }
}
