import 'package:flutter/material.dart';
import '../core/constants/app_constants.dart';
import '../core/models/user_session.dart';
import '../core/storage/secure_storage.dart';
import 'theme/app_theme.dart';
import '../shared/widgets/plantix_nav_bar.dart';
import '../shared/widgets/luxury_toast.dart';

// Features
import '../features/splash/splash_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/home/home_screen.dart';
import '../features/mandi/mandi_screen.dart';
import '../features/scanner/disease_scanner_screen.dart';
import '../features/community/community_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/gramhaul/gramhaul_screen.dart';
import '../features/khata/farm_khata_screen.dart';
import '../features/biorx/biorx_screen.dart';
import '../features/bioshield/bioshield_radar_screen.dart';
import '../features/agristack/agristack_passport_screen.dart';
import '../features/machinery/equipment_rental_screen.dart';
import '../features/loan/kcc_loan_screen.dart';
import '../features/chat/agronomy_chat_screen.dart';
import '../features/driver/driver_dashboard_screen.dart';
import '../features/language/language_select_sheet.dart';

class NuKropFlutterApp extends StatefulWidget {
  const NuKropFlutterApp({super.key});

  @override
  State<NuKropFlutterApp> createState() => _NuKropFlutterAppState();
}

class _NuKropFlutterAppState extends State<NuKropFlutterApp> {
  bool _isSplashDone = false;
  bool _isOnboardingDone = false;
  UserSession? _session;
  String _currentLang = 'en';

  // Navigation State
  int _currentDockIndex = 0; // 0: Home, 1: Community, 2: Market, 3: Profile
  String _activeScreen = AppConstants.viewHome;
  final List<String> _navigationStack = [];

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    final session = await SecureStorage.getSession();
    final onboardingDone = await SecureStorage.isOnboardingCompleted();
    final lang = await SecureStorage.getLanguage();

    setState(() {
      _session = session;
      _isOnboardingDone = onboardingDone;
      _currentLang = lang;
    });
  }

  void _navigateToScreen(String screen) {
    setState(() {
      _navigationStack.add(_activeScreen);
      _activeScreen = screen;
      if (screen == AppConstants.viewHome) _currentDockIndex = 0;
      if (screen == AppConstants.viewCommunity) _currentDockIndex = 1;
      if (screen == AppConstants.viewMarket) _currentDockIndex = 2;
      if (screen == AppConstants.viewProfile) _currentDockIndex = 3;
    });
  }

  void _handleBackPress() {
    if (_navigationStack.isNotEmpty) {
      setState(() {
        _activeScreen = _navigationStack.removeLast();
        if (_activeScreen == AppConstants.viewHome) _currentDockIndex = 0;
        if (_activeScreen == AppConstants.viewCommunity) _currentDockIndex = 1;
        if (_activeScreen == AppConstants.viewMarket) _currentDockIndex = 2;
        if (_activeScreen == AppConstants.viewProfile) _currentDockIndex = 3;
      });
    } else if (_activeScreen != AppConstants.viewHome) {
      setState(() {
        _activeScreen = AppConstants.viewHome;
        _currentDockIndex = 0;
      });
    }
  }

  void _openLanguageSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => LanguageSelectSheet(
        currentLang: _currentLang,
        onLanguageSelected: (lang) {
          setState(() {
            _currentLang = lang;
          });
        },
      ),
    );
  }

  void _showNotificationsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Agrarian Notifications'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.wb_sunny_rounded, color: AppConstants.accentGold),
              title: Text('Spray Window Safe Today', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              subtitle: Text('07:30 AM - 10:30 AM (Low wind: 11 km/h)', style: TextStyle(fontSize: 11)),
            ),
            Divider(),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.storefront_rounded, color: AppConstants.primaryGreen),
              title: Text('Warangal Cotton Rate Rose', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              subtitle: Text('₹7,850/Qtl (+₹120 above MSP)', style: TextStyle(fontSize: 11)),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NuKropAI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: PopScope(
        canPop: _activeScreen == AppConstants.viewHome && _navigationStack.isEmpty,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) {
            _handleBackPress();
          }
        },
        child: _buildCurrentStateView(),
      ),
    );
  }

  Widget _buildCurrentStateView() {
    // Stage 1: Splash Screen
    if (!_isSplashDone) {
      return SplashScreen(
        onSplashFinished: () {
          setState(() {
            _isSplashDone = true;
          });
        },
      );
    }

    // Stage 2: Onboarding Flow
    if (!_isOnboardingDone) {
      return OnboardingScreen(
        onOnboardingFinished: () {
          setState(() {
            _isOnboardingDone = true;
          });
        },
      );
    }

    // Stage 3: Multi-Channel Authentication
    if (_session == null) {
      if (_activeScreen == AppConstants.viewRegister) {
        return RegisterScreen(
          onRegisterSuccess: () => _initApp(),
          onNavigateToLogin: () {
            setState(() {
              _activeScreen = AppConstants.viewLogin;
            });
          },
        );
      }
      return LoginScreen(
        onLoginSuccess: () => _initApp(),
        onNavigateToRegister: () {
          setState(() {
            _activeScreen = AppConstants.viewRegister;
          });
        },
      );
    }

    // Driver Role Dashboard
    if (_session!.isDriver) {
      return DriverDashboardScreen(
        session: _session!,
        onLogout: () {
          setState(() {
            _session = null;
            _activeScreen = AppConstants.viewLogin;
          });
        },
      );
    }

    // Farmer Role: 18 Agrarian Views
    return Scaffold(
      body: _buildActiveAgrarianView(),
      bottomNavigationBar: PlantixBottomBar(
        currentIndex: _currentDockIndex,
        onTabSelected: (index) {
          setState(() {
            _currentDockIndex = index;
            if (index == 0) _activeScreen = AppConstants.viewHome;
            if (index == 1) _activeScreen = AppConstants.viewCommunity;
            if (index == 2) _activeScreen = AppConstants.viewMarket;
            if (index == 3) _activeScreen = AppConstants.viewProfile;
          });
        },
        onScanPressed: () {
          _navigateToScreen(AppConstants.viewScanner);
        },
      ),
    );
  }

  Widget _buildActiveAgrarianView() {
    switch (_activeScreen) {
      case AppConstants.viewHome:
        return HomeScreen(
          session: _session!,
          onNavigateToScreen: _navigateToScreen,
          onOpenNotifications: _showNotificationsDialog,
          onOpenLanguageSheet: _openLanguageSheet,
        );
      case AppConstants.viewScanner:
        return DiseaseScannerScreen(
          onBack: _handleBackPress,
          onShareToCommunity: () {
            _navigateToScreen(AppConstants.viewCommunity);
            LuxuryToast.show(context, message: 'Diagnosis shared to Kisan Community Feed!');
          },
        );
      case AppConstants.viewMarket:
        return MandiScreen(onBack: _handleBackPress);
      case AppConstants.viewCommunity:
        return CommunityScreen(onBack: _handleBackPress);
      case AppConstants.viewProfile:
        return ProfileScreen(
          session: _session!,
          onLogout: () {
            setState(() {
              _session = null;
              _activeScreen = AppConstants.viewLogin;
            });
          },
          onReplaySplash: () {
            setState(() {
              _isSplashDone = false;
            });
          },
          onOpenLanguageSheet: _openLanguageSheet,
          onBack: _handleBackPress,
        );
      case AppConstants.viewGramHaul:
        return GramHaulScreen(onBack: _handleBackPress);
      case AppConstants.viewKhata:
        return FarmKhataScreen(onBack: _handleBackPress);
      case AppConstants.viewBioRx:
        return BioRxScreen(onBack: _handleBackPress);
      case AppConstants.viewBioShield:
        return BioShieldRadarScreen(onBack: _handleBackPress);
      case AppConstants.viewAgriStack:
        return AgriStackPassportScreen(onBack: _handleBackPress);
      case AppConstants.viewEquipment:
        return EquipmentRentalScreen(onBack: _handleBackPress);
      case AppConstants.viewLoan:
        return KccLoanScreen(onBack: _handleBackPress);
      case AppConstants.viewChat:
        return AgronomyChatScreen(onBack: _handleBackPress);
      default:
        return HomeScreen(
          session: _session!,
          onNavigateToScreen: _navigateToScreen,
          onOpenNotifications: _showNotificationsDialog,
          onOpenLanguageSheet: _openLanguageSheet,
        );
    }
  }
}
