import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/user_session.dart';
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
  final TextEditingController _phoneController =
      TextEditingController(text: '9876543210');
  final TextEditingController _passwordController =
      TextEditingController(text: 'FarmSafe@2026');
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
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final phone = _phoneController.text.trim();
    final password = _passwordController.text.trim();

    if (phone.isEmpty || phone.length < 10) {
      LuxuryToast.show(
        context,
        message: 'Please enter a valid 10-digit mobile number.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (password.isEmpty || password.length < 6) {
      LuxuryToast.show(
        context,
        message: 'Password must be at least 6 characters.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    await Future.delayed(const Duration(milliseconds: 600));

    final role = _tabController.index == 0 ? UserRole.farmer : UserRole.driver;
    final session = UserSession(
      userId: 'usr_${DateTime.now().millisecondsSinceEpoch}',
      name: role == UserRole.farmer ? 'B. Jaswanth Reddy' : 'Suresh Yadav',
      phone: '+91 $phone',
      email: role == UserRole.farmer ? 'farmer@nukrop.ai' : 'driver@gramhaul.in',
      role: role,
      state: 'Telangana',
      district: 'Warangal Rural',
      activeCrops: ['Cotton', 'Chilli'],
      accessToken: 'jwt_mock_token_valid',
      refreshToken: 'jwt_mock_refresh_token_valid',
    );

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
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppConstants.primaryLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.eco_rounded,
                    color: AppConstants.primaryGreen,
                    size: 36,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Sign In to NuKropAI',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppConstants.textDark,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Enterprise Agrarian OS & Rural Freight',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: AppConstants.textMuted,
                ),
              ),
              const SizedBox(height: 24),
              Container(
                decoration: BoxDecoration(
                  color: AppConstants.surfaceBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicatorColor: AppConstants.primaryGreen,
                  labelColor: AppConstants.primaryDark,
                  unselectedLabelColor: AppConstants.textMuted,
                  indicatorSize: TabBarIndicatorSize.tab,
                  labelStyle: const TextStyle(fontWeight: FontWeight.w700),
                  tabs: const [
                    Tab(text: 'Kisan (Farmer)'),
                    Tab(text: 'GramHaul (Driver)'),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Mobile Number',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppConstants.textDark,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  prefixText: '+91 ',
                  prefixStyle: TextStyle(
                    color: AppConstants.textDark,
                    fontWeight: FontWeight.w600,
                  ),
                  hintText: '98765 43210',
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Password',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppConstants.textDark,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  hintText: '••••••••',
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_off_rounded
                          : Icons.visibility_rounded,
                      color: AppConstants.textMuted,
                    ),
                    onPressed: () {
                      setState(() {
                        _obscurePassword = !_obscurePassword;
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _handleLogin,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Sign In'),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    "Don't have an account? ",
                    style: TextStyle(color: AppConstants.textMuted, fontSize: 13),
                  ),
                  GestureDetector(
                    onTap: widget.onNavigateToRegister,
                    child: const Text(
                      'Create Account',
                      style: TextStyle(
                        color: AppConstants.primaryGreen,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              const Center(
                child: Text(
                  'Protected by 256-Bit TLS & DPDP 2023 Compliance',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppConstants.textMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

