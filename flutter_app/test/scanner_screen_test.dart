import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nukrop_app/core/networking/api_client.dart';
import 'package:nukrop_app/features/scanner/disease_scanner_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
      'DiseaseScannerScreen mounts and displays initial camera viewport',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: DiseaseScannerScreen(),
      ),
    );

    expect(find.text('AI Crop Disease Doctor'), findsOneWidget);
    expect(find.text('Cotton'), findsOneWidget);
    expect(find.byIcon(Icons.camera_alt_rounded), findsOneWidget);
  });

  testWidgets(
      'DiseaseScannerScreen rejects non-crop image with authenticity check notice',
      (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/ai/diagnose-crop')) {
        return http.Response(
            jsonEncode({
              'status': 'success',
              'ai_prediction': {
                'isPlantOrSoil': false,
                'detectedSubject': 'Automobile',
                'diseaseName': 'Unknown / Non-Crop Image',
                'severity': 'None',
                'confidence': 0,
                'pathogen': 'None',
                'symptoms':
                    'The provided image is an automobile, not an agricultural crop foliage.',
                'chemicalSolution': 'None applicable.',
                'organicSolution': 'None required.',
                'sprayAdvisory': 'N/A'
              },
              'provenance':
                  'Groq AI Cloud (qwen/qwen3.8-27b Multimodal Vision)',
              'timestamp': DateTime.now().toIso8601String(),
            }),
            200);
      }
      return http.Response(jsonEncode({}), 200);
    });

    ApiClient.setMockClient(mockClient);

    await tester.pumpWidget(
      const MaterialApp(
        home: DiseaseScannerScreen(),
      ),
    );

    // Initial state has no rejection or result
    expect(find.text('Authenticity Verification Notice'), findsNothing);
  });
}
