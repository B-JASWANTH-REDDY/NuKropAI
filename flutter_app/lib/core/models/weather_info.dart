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
  final String sprayAdvisory; // 'SAFE', 'MARGINAL', 'UNSAFE'
  final String sprayWindow;
  final String sunrise;
  final String sunset;

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
  });

  static const sample = WeatherInfo(
    temperature: 31.0,
    tempHigh: 34.0,
    tempLow: 24.0,
    condition: 'Partly Cloudy',
    location: 'Warangal Rural, Telangana',
    humidity: 42,
    rainfall: 0.0,
    pressure: 988,
    windSpeed: 11.5,
    sprayAdvisory: 'SAFE',
    sprayWindow: '07:30 AM - 10:30 AM',
  );
}

