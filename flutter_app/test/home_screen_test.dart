import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nukrop_app/core/models/user_session.dart';
import 'package:nukrop_app/core/networking/api_client.dart';
import 'package:nukrop_app/features/home/home_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  const testSession = UserSession(
    userId: 'usr_test_farmer_1',
    name: 'Suresh Kumar',
    role: UserRole.farmer,
    state: 'Telangana',
    district: 'Warangal',
    activeCrops: ['Cotton'],
  );

  testWidgets(
      'HomeScreen displays honest Weather Offline and Price Unavailable when telemetry is absent',
      (WidgetTester tester) async {
    // Mock backend returning empty mandi rates and unavailable weather
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/mandi/rates')) {
        return http.Response(
            jsonEncode({'status': 'success', 'data': []}), 200);
      }
      if (request.url.path.contains('/weather/current')) {
        return http.Response(
            jsonEncode({
              'status': 'unavailable',
              'source': 'Open-Meteo',
              'data': null,
              'message': 'Weather telemetry offline'
            }),
            200);
      }
      if (request.url.path.contains('/weather/notifications/unread-count')) {
        return http.Response(jsonEncode({'unreadCount': 0}), 200);
      }
      return http.Response(jsonEncode({'data': {}}), 200);
    });

    ApiClient.setMockClient(mockClient);

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          session: testSession,
          onNavigateToScreen: (_) {},
          onOpenNotifications: () {},
          onOpenLanguageSheet: () {},
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify ZERO fake weather or spray advisory
    expect(find.text('Weather Telemetry Offline'), findsOneWidget);
    expect(find.text('Advisory unavailable'), findsOneWidget);
    expect(find.text('SAFE TO SPRAY'), findsNothing);

    // Verify ZERO fake fallback commodity rate
    expect(find.text('₹7,850/Qtl'), findsNothing);
    expect(find.text('Price Unavailable'), findsWidgets);
  });

  testWidgets(
      'HomeScreen displays authentic weather telemetry and dynamic spray advisory when available',
      (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/mandi/rates')) {
        return http.Response(
          utf8.decode(utf8.encode(jsonEncode({
            'status': 'success',
            'records': [
              {
                'id': 'm1',
                'commodity': 'Cotton',
                'market': 'Warangal APMC',
                'state': 'Telangana',
                'district': 'Warangal',
                'modalPrice': 7420,
                'minPrice': 7100,
                'maxPrice': 7650,
                'priceUnit': 'Rs/Quintal',
                'priceChange': '+120',
                'tradeVolume': '450 MT',
                'arrivalDate': '2026-11-09',
                'source': 'data.gov.in (Agmarknet)',
              }
            ],
            'data': [
              {
                'id': 'm1',
                'commodity': 'Cotton',
                'market': 'Warangal APMC',
                'state': 'Telangana',
                'district': 'Warangal',
                'modalPrice': 7420,
                'minPrice': 7100,
                'maxPrice': 7650,
                'priceUnit': 'Rs/Quintal',
                'priceChange': '+120',
                'tradeVolume': '450 MT',
                'arrivalDate': '2026-11-09',
                'source': 'data.gov.in (Agmarknet)',
              }
            ]
          }))),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      if (request.url.path.contains('/weather/current')) {
        return http.Response(
            jsonEncode({
              'status': 'AVAILABLE',
              'source':
                  'Open-Meteo Meteorological Service (WMO Station Network)',
              'location': {'district': 'Warangal', 'state': 'Telangana'},
              'observationTime': DateTime.now().toIso8601String(),
              'weather': {
                'temperature': 26.5,
                'humidity': 55,
                'windSpeed': 8.2,
                'condition': 'Clear',
                'weatherCode': 0,
              },
              'sprayAdvisory': {
                'isSafe': true,
                'status':
                    'OPTIMAL: Temperature 26.5°C, Wind 8.2 km/h, Humidity 55%',
                'window': 'Morning 07:30 - 10:30 AM',
              },
            }),
            200);
      }
      if (request.url.path.contains('/weather/notifications/unread-count')) {
        return http.Response(jsonEncode({'unreadCount': 3}), 200);
      }
      return http.Response(jsonEncode({'data': {}}), 200);
    });

    ApiClient.setMockClient(mockClient);

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          session: testSession,
          onNavigateToScreen: (_) {},
          onOpenNotifications: () {},
          onOpenLanguageSheet: () {},
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify authentic weather and dynamic advisory
    expect(find.text('26°C • Clear'), findsOneWidget);
    expect(find.text('OPTIMAL TO SPRAY'), findsOneWidget);
    expect(find.text('55%'), findsOneWidget);
    expect(find.text('8.2 km/h'), findsOneWidget);

    // Verify authentic mandi rate
    expect(find.text('₹7420'), findsOneWidget);
    expect(find.text('Warangal APMC (Cotton)'), findsOneWidget);
  });
}
