import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/user_session.dart';
import '../../core/networking/api_client.dart';
import '../../core/storage/secure_storage.dart';
import '../../shared/widgets/luxury_toast.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoginSuccess;
  final VoidCallback onNavigateToRegister;

  const LoginScreen({
    super.key,
    required this.onLoginSuccess,
    required this.onNavigateToRegister,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String _normalizeEmail(String input) {
    final trimmed = input.trim().toLowerCase();
    if (trimmed.contains('@')) {
      return trimmed;
    }
    // Standard phone normalization to agrarian identity email
    final cleanDigits = trimmed.replaceAll(RegExp(r'\D'), '');
    final phone = cleanDigits.length > 10
        ? cleanDigits.substring(cleanDigits.length - 10)
        : cleanDigits;
    return '$phone@nukrop.ai';
  }

  Future<void> _handleLogin() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text.trim();

    if (identifier.isEmpty) {
      LuxuryToast.show(
        context,
        message: 'Please enter your registered mobile number or email address.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (password.isEmpty || password.length < 8) {
      LuxuryToast.show(
        context,
        message: 'Password must be at least 8 characters long.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final expectedRole = _tabController.index == 0 ? 'farmer' : 'driver';
    final normalizedEmail = _normalizeEmail(identifier);

    try {
      final response = await ApiClient.post<Map<String, dynamic>>(
        '/auth/login',
        body: {
          'email': normalizedEmail,
          'password': password,
        },
      );

      final accessToken = response['accessToken'] as String?;
      final refreshToken = response['refreshToken'] as String?;
      final user = response['user'] as Map<String, dynamic>?;

      if (accessToken == null || refreshToken == null || user == null) {
        throw const ServerException(
            'Server returned an invalid authentication payload.');
      }

      final serverRole = (user['role'] as String? ?? 'farmer').toLowerCase();

      // Enforce strict Role Guard conflict detection
      if (serverRole != expectedRole) {
        throw ForbiddenException(
          'Role conflict: This account is registered as a $serverRole. '
          'Please sign in under the $serverRole portal.',
        );
      }

      // Canonical Identity: Real database UUID for PostgreSQL RLS
      final canonicalUserId = user['id']?.toString() ?? '';
      final session = UserSession(
        userId: canonicalUserId,
        name: user['name'] ??
            (serverRole == 'driver' ? 'Verified Driver' : 'Kisan Mitra'),
        email: user['email'] ?? normalizedEmail,
        phone: user['phone'] ?? (identifier.contains('@') ? '' : identifier),
        role: serverRole == 'driver' ? UserRole.driver : UserRole.farmer,
        state: user['state'] ?? 'Telangana',
        district: user['district'] ?? 'Warangal',
        activeCrops: user['activeCrops'] != null
            ? List<String>.from(user['activeCrops'])
            : ['Cotton', 'Chilli'],
        accessToken: accessToken,
        refreshToken: refreshToken,
      );

      // Persist in platform-backed Android Keystore / iOS Keychain
      await SecureStorage.saveSession(session);

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        LuxuryToast.show(
          context,
          message: 'Welcome back, ${session.name}!',
          icon: Icons.check_circle_rounded,
          color: AppConstants.primaryGreen,
        );
        widget.onLoginSuccess();
      }
    } on UnauthorizedException {
      if (mounted) {
        setState(() => _isLoading = false);
        LuxuryToast.show(
          context,
          message:
              'Invalid mobile/email or password. Please verify your credentials.',
          color: AppConstants.dangerRed,
        );
      }
    } on ForbiddenException catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        LuxuryToast.show(
          context,
          message: e.message,
          color: AppConstants.dangerRed,
        );
      }
    } on NetworkException catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        LuxuryToast.show(
          context,
          message: e.message,
          color: AppConstants.dangerRed,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        LuxuryToast.show(
          context,
          message: 'Authentication failed: ${e.toString()}',
          color: AppConstants.dangerRed,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Agrarian Logo & Identity Header
                Center(
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppConstants.primaryLight,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppConstants.primaryGreen,
                        width: 2,
                      ),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.eco_rounded,
                        color: AppConstants.primaryGreen,
                        size: 36,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Center(
                  child: Text(
                    'NuKropAI',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: AppConstants.primaryDark,
                      letterSpacing: -0.5,
                    ),
                  ),
                ),
                const Center(
                  child: Text(
                    'Agrarian Intelligence Operating System',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppConstants.textMuted,
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Role Selector Tabs (Farmer / Driver)
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: AppConstants.primaryGreen,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    labelColor: Colors.white,
                    unselectedLabelColor: AppConstants.textDark,
                    labelStyle: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                    tabs: const [
                      Tab(
                        icon: Icon(Icons.agriculture_rounded, size: 18),
                        text: 'Kisan / Farmer',
                      ),
                      Tab(
                        icon: Icon(Icons.local_shipping_rounded, size: 18),
                        text: 'GramHaul Driver',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Auth Card
                Card(
                  elevation: 0.5,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(color: Colors.grey.shade200),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Sign In to Your Account',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppConstants.textDark,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Mobile or Email
                        TextField(
                          controller: _identifierController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'Mobile Number or Email',
                            hintText: 'e.g. 9876543210 or farmer@nukrop.ai',
                            prefixIcon: Icon(Icons.person_outline_rounded),
                            isDense: true,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Password
                        TextField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            hintText: 'Minimum 8 characters',
                            prefixIcon: const Icon(Icons.lock_outline_rounded),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_rounded
                                    : Icons.visibility_rounded,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                            isDense: true,
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Submit Button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppConstants.primaryGreen,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2.5,
                                    ),
                                  )
                                : const Text(
                                    'Sign In',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Navigate to Register
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Don’t have an account?',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppConstants.textMuted,
                      ),
                    ),
                    TextButton(
                      onPressed: widget.onNavigateToRegister,
                      child: const Text(
                        'Register Here',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: AppConstants.primaryGreen,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
