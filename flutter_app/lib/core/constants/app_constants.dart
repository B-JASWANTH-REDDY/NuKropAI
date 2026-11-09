import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppConstants {
  // Brand Colors
  static const Color primaryGreen = Color(0xFF10B981);
  static const Color primaryDark = Color(0xFF047857);
  static const Color primaryLight = Color(0xFFD1FAE5);
  static const Color accentGold = Color(0xFFF59E0B);
  static const Color surfaceBg = Color(0xFFF9FAFB);
  static const Color surfaceCard = Color(0xFFFFFFFF);
  static const Color textDark = Color(0xFF111827);
  static const Color textMuted = Color(0xFF6B7280);
  static const Color borderSubtle = Color(0xFFE5E7EB);
  static const Color dangerRed = Color(0xFFEF4444);
  static const Color dangerLight = Color(0xFFFEE2E2);

  // Supabase & Backend Endpoints
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://yxjqseiegwjdfnccdchk.supabase.co',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  );

  // Environment-Aware API Base URLs
  static const String defaultEmulatorUrl = 'http://10.0.2.2:3000/api/v1';
  static const String defaultLanUrl = 'http://192.168.1.100:3000/api/v1';
  static const String stagingApiUrl = 'https://api.staging.nukropai.com/api/v1';
  static const String productionApiUrl = 'https://api.nukropai.com/api/v1';

  /// Resolves the API Base URL with strict release security enforcement:
  /// - In release mode, only HTTPS URLs are allowed.
  /// - Localhost, 127.0.0.1, 10.0.2.2, and insecure HTTP endpoints are strictly rejected.
  static String get apiBaseUrl {
    const rawUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: kReleaseMode ? productionApiUrl : defaultEmulatorUrl,
    );
    if (kReleaseMode) {
      if (!rawUrl.startsWith('https://') ||
          rawUrl.contains('localhost') ||
          rawUrl.contains('127.0.0.1') ||
          rawUrl.contains('10.0.2.2')) {
        throw StateError(
          'INSECURE_RELEASE_CONFIG: Insecure cleartext or local development endpoint "$rawUrl" is strictly prohibited in release mode. Must configure a valid HTTPS URL.',
        );
      }
    }
    return rawUrl;
  }

  // App Views
  static const String viewHome = 'home';
  static const String viewScanner = 'scanner';
  static const String viewMarket = 'market';
  static const String viewCommunity = 'community';
  static const String viewProfile = 'profile';
  static const String viewGramHaul = 'gramhaul';
  static const String viewGramHaulTracking = 'gramhaul_tracking';
  static const String viewAgriStack = 'agristack';
  static const String viewEquipment = 'equipment';
  static const String viewLoan = 'loan';
  static const String viewKhata = 'khata';
  static const String viewChat = 'chat';
  static const String viewBioShield = 'bioshield';
  static const String viewBioRx = 'biorx';
  static const String viewCalcFert = 'calc_fert';
  static const String viewCalcPest = 'calc_pest';
  static const String viewCalcBudget = 'calc_budget';
  static const String viewDriverDashboard = 'driver_dashboard';
  static const String viewSettings = 'settings';
  static const String viewWeather = 'weather';
  static const String viewOnboarding = 'onboarding';
  static const String viewSplash = 'splash';
  static const String viewLogin = 'login';
  static const String viewRegister = 'register';
}

