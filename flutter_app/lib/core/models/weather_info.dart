class WeatherInfo {
  final double temperature;
  final double tempHigh;
  final double tempLow;
  final String condition;
  final String location;
  final int humidity;
  final double rainfall;
  final int pressure;
  final double windSpeed;
  final String sprayAdvisory; // 'OPTIMAL TO SPRAY', 'UNSAFE TO SPRAY', 'Advisory unavailable'
  final String sprayWindow;
  final String sunrise;
  final String sunset;
  final String source;
  final DateTime observationTime;
  final bool isAvailable;

  const WeatherInfo({
    required this.temperature,
    required this.tempHigh,
    required this.tempLow,
    required this.condition,
    required this.location,
    required this.humidity,
    required this.rainfall,
    required this.pressure,
    required this.windSpeed,
    required this.sprayAdvisory,
    required this.sprayWindow,
    this.sunrise = '05:57 am',
    this.sunset = '06:26 pm',
    this.source = 'Open-Meteo Meteorological Service',
    required this.observationTime,
    this.isAvailable = true,
  });

  factory WeatherInfo.fromJson(Map<String, dynamic> json) {
    final weather = json['weather'] as Map<String, dynamic>? ?? {};
    final advisory = json['sprayAdvisory'] as Map<String, dynamic>? ?? {};
    final locationMap = json['location'] as Map<String, dynamic>? ?? {};

    final temp = (weather['temperature'] ?? 0.0).toDouble();
    final humidity = (weather['humidity'] ?? 0).toInt();
    final wind = (weather['windSpeed'] ?? 0.0).toDouble();
    final condition = weather['condition']?.toString() ?? 'Clear';
    final district = locationMap['district']?.toString() ?? 'Warangal';
    final state = locationMap['state']?.toString() ?? 'Telangana';

    final isSafe = advisory['isSafe'] == true;
    final advisoryStatus = advisory['status']?.toString() ?? (isSafe ? 'OPTIMAL TO SPRAY' : 'Advisory unavailable');
    final window = advisory['window']?.toString() ?? 'Morning 07:30 - 10:30 AM';

    DateTime obsTime;
    try {
      obsTime = DateTime.parse(json['observationTime'] ?? '');
    } catch (_) {
      obsTime = DateTime.now();
    }

    return WeatherInfo(
      temperature: temp,
      tempHigh: temp + 3.0,
      tempLow: temp - 5.0,
      condition: condition,
      location: '$district, $state',
      humidity: humidity,
      rainfall: 0.0,
      pressure: 1012,
      windSpeed: wind,
      sprayAdvisory: advisoryStatus,
      sprayWindow: window,
      source: json['source']?.toString() ?? 'Open-Meteo Meteorological Service',
      observationTime: obsTime,
      isAvailable: json['status'] == 'AVAILABLE',
    );
  }

  // Unavailable state representation (Zero fake weather)
  static final unavailable = WeatherInfo(
    temperature: 0.0,
    tempHigh: 0.0,
    tempLow: 0.0,
    condition: 'Telemetry Unavailable',
    location: 'District Station Offline',
    humidity: 0,
    rainfall: 0.0,
    pressure: 0,
    windSpeed: 0.0,
    sprayAdvisory: 'Advisory unavailable',
    sprayWindow: 'Telemetry offline',
    source: 'Weather Provider Offline',
    observationTime: DateTime.now(),
    isAvailable: false,
  );
}
