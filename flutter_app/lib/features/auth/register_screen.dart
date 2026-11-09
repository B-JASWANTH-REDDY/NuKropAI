import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/user_session.dart';
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
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  String _selectedRole = 'farmer';
  bool _agreedToTerms = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    final password = _passwordController.text.trim();

    if (name.isEmpty) {
      LuxuryToast.show(
        context,
        message: 'Please enter your full name.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (phone.length < 10) {
      LuxuryToast.show(
        context,
        message: 'Please enter a valid 10-digit mobile number.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (password.length < 6) {
      LuxuryToast.show(
        context,
        message: 'Password must be at least 6 characters.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    if (!_agreedToTerms) {
      LuxuryToast.show(
        context,
        message: 'Please accept Terms of Service & Privacy Notice.',
        color: AppConstants.dangerRed,
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    await Future.delayed(const Duration(milliseconds: 600));

    final role = _selectedRole == 'farmer' ? UserRole.farmer : UserRole.driver;
    final session = UserSession(
      userId: 'usr_${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      phone: '+91 $phone',
      email: '$phone@nukrop.ai',
      role: role,
      state: 'Telangana',
      district: 'Warangal Rural',
      activeCrops: ['Cotton', 'Chilli'],
      accessToken: 'jwt_mock_token_registered',
      refreshToken: 'jwt_mock_refresh_token_registered',
    );

    await SecureStorage.saveSession(session);

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
      LuxuryToast.show(
        context,
        message: 'Account created successfully for $name!',
        icon: Icons.check_circle_rounded,
        color: AppConstants.primaryGreen,
      );
      widget.onRegisterSuccess();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: widget.onNavigateToLogin,
        ),
        title: const Text('Create NuKropAI Account'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Full Name',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(hintText: 'e.g. Ramesh Patel'),
              ),
              const SizedBox(height: 16),
              const Text(
                'Mobile Number',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  prefixText: '+91 ',
                  hintText: '98765 43210',
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Account Role',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Farmer')),
                      selected: _selectedRole == 'farmer',
                      selectedColor: AppConstants.primaryLight,
                      onSelected: (_) => setState(() => _selectedRole = 'farmer'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Driver')),
                      selected: _selectedRole == 'driver',
                      selectedColor: AppConstants.primaryLight,
                      onSelected: (_) => setState(() => _selectedRole = 'driver'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Password',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(hintText: 'Min 6 characters'),
              ),
              const SizedBox(height: 16),
              CheckboxListTile(
                value: _agreedToTerms,
                onChanged: (val) => setState(() => _agreedToTerms = val ?? false),
                activeColor: AppConstants.primaryGreen,
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
                title: const Text(
                  'I agree to the Terms of Service & DPDP 2023 Agrarian Data Notice.',
                  style: TextStyle(fontSize: 12, color: AppConstants.textMuted),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _handleRegister,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Complete Registration'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
