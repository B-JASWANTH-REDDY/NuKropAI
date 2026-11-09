class WeatherInfo {
  final double temperature;
  final double? tempHigh;
  final double? tempLow;
  final String condition;
  final String location;
  final int humidity;
  final double? rainfall;
  final int? pressure;
  final double windSpeed;
  final double? windGusts;
  final String sprayAdvisory; // 'OPTIMAL TO SPRAY', 'UNSAFE TO SPRAY', 'Advisory unavailable'
  final String sprayWindow;
  final String source;
  final DateTime observationTime;
  final bool isAvailable;

  const WeatherInfo({
    required this.temperature,
    this.tempHigh,
    this.tempLow,
    required this.condition,
    required this.location,
    required this.humidity,
    this.rainfall,
    this.pressure,
    required this.windSpeed,
    this.windGusts,
    required this.sprayAdvisory,
    required this.sprayWindow,
    this.source = 'Open-Meteo Weather API (NWP Forecast Model)',
    required this.observationTime,
    this.isAvailable = true,
  });

  factory WeatherInfo.fromJson(Map<String, dynamic> json) {
    final weather = json['weather'] as Map<String, dynamic>? ?? {};
    final advisory = json['sprayAdvisory'] as Map<String, dynamic>? ?? {};
    final locationMap = json['location'] as Map<String, dynamic>? ?? {};

    final temp = (weather['temperature'] as num?)?.toDouble() ?? 0.0;
    final humidity = (weather['humidity'] as num?)?.toInt() ?? 0;
    final wind = (weather['windSpeed'] as num?)?.toDouble() ?? 0.0;
    final windGusts = (weather['windGusts'] as num?)?.toDouble();
    final precipitation = (weather['precipitation'] as num?)?.toDouble();
    final tempHigh = (weather['tempHigh'] as num?)?.toDouble();
    final tempLow = (weather['tempLow'] as num?)?.toDouble();
    final pressure = (weather['pressure'] as num?)?.toInt();
    final condition = weather['condition']?.toString() ?? 'Clear';
    final district = locationMap['district']?.toString() ?? 'Warangal';
    final state = locationMap['state']?.toString() ?? 'Telangana';

    final isSafe = advisory['isSafe'] == true;
    final advisoryStatus = advisory['status']?.toString() ?? (isSafe ? 'OPTIMAL TO SPRAY' : 'Advisory unavailable');
    final window = advisory['window']?.toString() ?? 'Condition-dependent: apply while parameters remain within safe ranges';

    DateTime obsTime;
    try {
      obsTime = DateTime.parse(json['observationTime'] ?? '');
    } catch (_) {
      obsTime = DateTime.now();
    }

    return WeatherInfo(
      temperature: temp,
      tempHigh: tempHigh,
      tempLow: tempLow,
      condition: condition,
      location: '$district, $state',
      humidity: humidity,
      rainfall: precipitation,
      pressure: pressure,
      windSpeed: wind,
      windGusts: windGusts,
      sprayAdvisory: advisoryStatus,
      sprayWindow: window,
      source: json['source']?.toString() ?? 'Open-Meteo Weather API (NWP Forecast Model)',
      observationTime: obsTime,
      isAvailable: json['status'] == 'AVAILABLE',
    );
  }

  // Unavailable state representation (Zero fake weather)
  static final unavailable = WeatherInfo(
    temperature: 0.0,
    tempHigh: null,
    tempLow: null,
    condition: 'Telemetry Unavailable',
    location: 'District Station Offline',
    humidity: 0,
    rainfall: null,
    pressure: null,
    windSpeed: 0.0,
    windGusts: null,
    sprayAdvisory: 'Advisory unavailable',
    sprayWindow: 'Telemetry offline',
    source: 'Weather Provider Offline',
    observationTime: DateTime.now(),
    isAvailable: false,
  );
}
