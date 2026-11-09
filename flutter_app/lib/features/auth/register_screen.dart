import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/user_session.dart';
import '../../core/networking/api_client.dart';
import '../../core/storage/secure_storage.dart';
import '../../shared/widgets/luxury_toast.dart';

class RegisterScreen extends StatefulWidget {
  final VoidCallback onRegisterSuccess;
  final VoidCallback onNavigateToLogin;

  const RegisterScreen({
    super.key,
    required this.onRegisterSuccess,
    required this.onNavigateToLogin,
  });

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  String _selectedRole = 'farmer';
  bool _agreedToTerms = false;
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String _normalizeEmail(String input) {
    final trimmed = input.trim().toLowerCase();
    if (trimmed.contains('@')) {
      return trimmed;
    }
    final cleanDigits = trimmed.replaceAll(RegExp(r'\D'), '');
    final phone = cleanDigits.length > 10
        ? cleanDigits.substring(cleanDigits.length - 10)
        : cleanDigits;
    return '$phone@nukrop.ai';
  }

  Future<void> _handleRegister() async {
    final name = _nameController.text.trim();
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text.trim();

    if (name.isEmpty) {
      LuxuryToast.show(
        context,
        message: 'Please enter your full name.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (identifier.isEmpty) {
      LuxuryToast.show(
        context,
        message: 'Please enter a valid 10-digit mobile number or email.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (password.length < 8) {
      LuxuryToast.show(
        context,
        message: 'Password must be at least 8 characters long.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (!_agreedToTerms) {
      LuxuryToast.show(
        context,
        message: 'Please accept Terms of Service & DPDP 2023 Consent.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final normalizedEmail = _normalizeEmail(identifier);

    try {
      final response = await ApiClient.post<Map<String, dynamic>>(
        '/auth/register',
        body: {
          'email': normalizedEmail,
          'password': password,
          'role': _selectedRole,
        },
      );

      final accessToken = response['accessToken'] as String?;
      final refreshToken = response['refreshToken'] as String?;
      final user = response['user'] as Map<String, dynamic>?;

      if (accessToken == null || refreshToken == null || user == null) {
        throw const ServerException(
            'Server returned an invalid registration response.');
      }

      // Canonical UUID for RLS
      final canonicalUserId = user['id']?.toString() ?? '';
      final session = UserSession(
        userId: canonicalUserId,
        name: name,
        email: normalizedEmail,
        phone: identifier.contains('@') ? '' : identifier,
        role: _selectedRole == 'driver' ? UserRole.driver : UserRole.farmer,
        state: 'Telangana',
        district: 'Warangal Rural',
        activeCrops: ['Cotton', 'Chilli'],
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
          message: 'Account registered successfully! Welcome to NuKropAI.',
          icon: Icons.check_circle_rounded,
          color: AppConstants.primaryGreen,
        );
        widget.onRegisterSuccess();
      }
    } on ConflictException {
      if (mounted) {
        setState(() => _isLoading = false);
        LuxuryToast.show(
          context,
          message: 'This mobile/email is already registered. Please sign in.',
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
          message: 'Registration failed: ${e.toString()}',
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
                // Header
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded),
                      onPressed: widget.onNavigateToLogin,
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Create Account',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppConstants.textDark,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Form Card
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
                        // Role Selection
                        const Text(
                          'Select Agrarian Role',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppConstants.textDark,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: ChoiceChip(
                                label: const Text('🌾 Kisan / Farmer'),
                                selected: _selectedRole == 'farmer',
                                onSelected: (val) {
                                  if (val) {
                                    setState(() => _selectedRole = 'farmer');
                                  }
                                },
                                selectedColor: AppConstants.primaryLight,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ChoiceChip(
                                label: const Text('🚚 Driver'),
                                selected: _selectedRole == 'driver',
                                onSelected: (val) {
                                  if (val) {
                                    setState(() => _selectedRole = 'driver');
                                  }
                                },
                                selectedColor: AppConstants.primaryLight,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Full Name
                        TextField(
                          controller: _nameController,
                          decoration: const InputDecoration(
                            labelText: 'Full Name',
                            hintText: 'e.g. Jaswanth Reddy',
                            prefixIcon: Icon(Icons.person_outline_rounded),
                            isDense: true,
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
                            prefixIcon: Icon(Icons.phone_android_rounded),
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
                        const SizedBox(height: 16),

                        // Terms & DPDP checkbox
                        Row(
                          children: [
                            Checkbox(
                              value: _agreedToTerms,
                              activeColor: AppConstants.primaryGreen,
                              onChanged: (val) {
                                setState(() {
                                  _agreedToTerms = val ?? false;
                                });
                              },
                            ),
                            const Expanded(
                              child: Text(
                                'I agree to the Terms of Service & DPDP 2023 Consent for Agricultural Intelligence.',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppConstants.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // Submit Button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _handleRegister,
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
                                    'Create Account',
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
                const SizedBox(height: 16),

                // Back to Login
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Already registered?',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppConstants.textMuted,
                      ),
                    ),
                    TextButton(
                      onPressed: widget.onNavigateToLogin,
                      child: const Text(
                        'Sign In',
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
