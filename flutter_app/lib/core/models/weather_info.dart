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
  final String
      sprayAdvisory; // 'OPTIMAL TO SPRAY', 'UNSAFE TO SPRAY', 'ADVISORY_UNAVAILABLE'
  final String sprayWindow;
  final bool isWeatherSuitable;
  final String? screeningType;
  final String? disclaimer;
  final String? cropProductContext;
  final String source;
  final DateTime? observationTime;
  final DateTime? modelTime;
  final DateTime? retrievedAt;
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
    this.isWeatherSuitable = false,
    this.screeningType = 'METEOROLOGICAL_SUITABILITY_SCREENING',
    this.disclaimer,
    this.cropProductContext,
    this.source = 'Open-Meteo Weather API (NWP Numerical Forecast Model)',
    this.observationTime,
    this.modelTime,
    this.retrievedAt,
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
    final district = locationMap['district']?.toString();
    final state = locationMap['state']?.toString();
    final location = (district != null && state != null)
        ? '$district, $state'
        : (district ?? state ?? 'Agricultural Location');

    final isSafe =
        advisory['isSafe'] == true || advisory['isWeatherSuitable'] == true;
    final advisoryStatus = advisory['reason']?.toString() ??
        advisory['status']?.toString() ??
        (isSafe ? 'OPTIMAL TO SPRAY' : 'Advisory unavailable');
    final window = advisory['window']?.toString() ??
        (isSafe
            ? 'Condition-dependent: apply while parameters remain within safe ranges'
            : 'Unavailable');
    final screeningType = advisory['screeningType']?.toString() ??
        'METEOROLOGICAL_SUITABILITY_SCREENING';
    final disclaimer = advisory['disclaimer']?.toString();
    final cropProductContext = advisory['cropProductContext']?.toString();

    DateTime? obsTime;
    if (json['observationTime'] != null) {
      try {
        obsTime = DateTime.parse(json['observationTime'].toString());
      } catch (_) {
        obsTime = null;
      }
    }

    DateTime? modelTime;
    if (json['modelTime'] != null) {
      try {
        modelTime = DateTime.parse(json['modelTime'].toString());
      } catch (_) {
        modelTime = null;
      }
    }

    DateTime? retrievedAt;
    if (json['retrievedAt'] != null) {
      try {
        retrievedAt = DateTime.parse(json['retrievedAt'].toString());
      } catch (_) {
        retrievedAt = null;
      }
    }

    return WeatherInfo(
      temperature: temp,
      tempHigh: tempHigh,
      tempLow: tempLow,
      condition: condition,
      location: location,
      humidity: humidity,
      rainfall: precipitation,
      pressure: pressure,
      windSpeed: wind,
      windGusts: windGusts,
      sprayAdvisory: advisoryStatus,
      sprayWindow: window,
      isWeatherSuitable: isSafe,
      screeningType: screeningType,
      disclaimer: disclaimer,
      cropProductContext: cropProductContext,
      source: json['source']?.toString() ??
          'Open-Meteo Weather API (NWP Numerical Forecast Model)',
      observationTime: obsTime,
      modelTime: modelTime,
      retrievedAt: retrievedAt,
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
    isWeatherSuitable: false,
    screeningType: 'METEOROLOGICAL_SUITABILITY_SCREENING',
    disclaimer:
        'Meteorological telemetry offline; spray suitability screening unavailable.',
    cropProductContext: null,
    source: 'Weather Provider Offline',
    observationTime: null,
    modelTime: null,
    retrievedAt: null,
    isAvailable: false,
  );
}
