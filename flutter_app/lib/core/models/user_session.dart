enum UserRole { farmer, driver, admin }

class UserSession {
  final String userId;
  final String name;
  final String phone;
  final String email;
  final UserRole role;
  final String state;
  final String district;
  final List<String> activeCrops;
  final String languageCode;
  final String? accessToken;
  final String? refreshToken;
  final bool isVerified;
  final bool publicProfileEnabled;

  const UserSession({
    required this.userId,
    required this.name,
    this.phone = '',
    this.email = '',
    this.role = UserRole.farmer,
    this.state = 'Telangana',
    this.district = 'Warangal',
    this.activeCrops = const ['Cotton', 'Chilli'],
    this.languageCode = 'en',
    this.accessToken,
    this.refreshToken,
    this.isVerified = true,
    this.publicProfileEnabled = false,
  });

  bool get isDriver => role == UserRole.driver;
  bool get isFarmer => role == UserRole.farmer;

  UserSession copyWith({
    String? userId,
    String? name,
    String? phone,
    String? email,
    UserRole? role,
    String? state,
    String? district,
    List<String>? activeCrops,
    String? languageCode,
    String? accessToken,
    String? refreshToken,
    bool? isVerified,
    bool? publicProfileEnabled,
  }) {
    return UserSession(
      userId: userId ?? this.userId,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      role: role ?? this.role,
      state: state ?? this.state,
      district: district ?? this.district,
      activeCrops: activeCrops ?? this.activeCrops,
      languageCode: languageCode ?? this.languageCode,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      isVerified: isVerified ?? this.isVerified,
      publicProfileEnabled: publicProfileEnabled ?? this.publicProfileEnabled,
    );
  }

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'name': name,
        'phone': phone,
        'email': email,
        'role': role.name,
        'state': state,
        'district': district,
        'activeCrops': activeCrops,
        'languageCode': languageCode,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'isVerified': isVerified,
        'publicProfileEnabled': publicProfileEnabled,
      };

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      userId: json['userId'] ?? 'usr_guest',
      name: json['name'] ?? 'Kisan Mitra',
      phone: json['phone'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] == 'driver' ? UserRole.driver : UserRole.farmer,
      state: json['state'] ?? 'Telangana',
      district: json['district'] ?? 'Warangal',
      activeCrops:
          List<String>.from(json['activeCrops'] ?? ['Cotton', 'Chilli']),
      languageCode: json['languageCode'] ?? 'en',
      accessToken: json['accessToken'],
      refreshToken: json['refreshToken'],
      isVerified: json['isVerified'] ?? true,
      publicProfileEnabled: json['publicProfileEnabled'] == true,
    );
  }

  static const guest = UserSession(
    userId: 'usr_default',
    name: 'B. Jaswanth Reddy',
    phone: '+91 98765 43210',
    email: 'farmer@nukrop.ai',
    role: UserRole.farmer,
    state: 'Telangana',
    district: 'Warangal Rural',
    activeCrops: ['Cotton', 'Chilli'],
    publicProfileEnabled: false,
  );
}
