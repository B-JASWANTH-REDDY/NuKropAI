package com.example

import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import kotlinx.serialization.json.addJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object GeminiVisionService {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .build()

    private val jsonParser = Json { ignoreUnknownKeys = true }

    private const val GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
    private const val DEFAULT_MODEL = "gemini-1.5-flash"

    /**
     * Resolves Gemini API key with strict precedence:
     * 1. Provided parameter if non-blank
     * 2. BuildConfig.GEMINI_API_KEY if configured
     * 3. System environment variable GEMINI_API_KEY
     */
    fun resolveApiKey(providedKey: String = ""): String {
        if (providedKey.isNotBlank()) return providedKey
        try {
            val buildKey = BuildConfig.GEMINI_API_KEY
            if (buildKey.isNotBlank()) return buildKey
        } catch (_: Throwable) {}
        val envKey = System.getenv("GEMINI_API_KEY")
        if (!envKey.isNullOrBlank()) return envKey
        return ""
    }

    private fun parseGeminiResponse(body: String): String {
        if (body.isBlank()) return "API Error: Empty response from Gemini server"
        return try {
            val element = jsonParser.parseToJsonElement(body).jsonObject
            if (element.containsKey("error")) {
                val errObj = element["error"]?.jsonObject
                val msg = errObj?.get("message")?.jsonPrimitive?.content ?: "Unknown API Error"
                return "API Error: $msg"
            }
            val candidates = element["candidates"]?.jsonArray
            if (candidates.isNullOrEmpty()) {
                return "API Error: No candidates returned"
            }
            val firstCandidate = candidates[0].jsonObject
            val parts = firstCandidate["content"]?.jsonObject?.get("parts")?.jsonArray
            if (parts.isNullOrEmpty()) {
                return "API Error: No content parts returned"
            }
            val text = parts[0].jsonObject["text"]?.jsonPrimitive?.content ?: return "API Error: No text in candidate"

            // Clean markdown tags if returned
            val cleaned = text.trim()
                .removePrefix("```json")
                .removePrefix("```")
                .removeSuffix("```")
                .trim()
            if (cleaned.isBlank()) text.trim() else cleaned
        } catch (e: Exception) {
            "API Error: Parse failed (${e.message}). Raw: $body"
        }
    }

    suspend fun analyzeImage(apiKey: String, imageBytes: ByteArray, prompt: String): Result<String> =
        withContext(Dispatchers.IO) {
            val key = if (apiKey.isNotBlank()) apiKey else resolveApiKey(apiKey)
            if (apiKey.isBlank() || key.isBlank()) {
                return@withContext Result.failure(IllegalStateException("Gemini API key is not configured"))
            }

            val b64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
            val lang = LanguageManager.currentLanguage.value
            val langName = LanguageManager.getLanguageName(lang)
            val translationInstruction = if (lang != "en") {
                " YOU MUST RESPOND ENTIRELY AND STRICTLY IN THE $langName LANGUAGE. However, if a JSON format is requested, keep the JSON structure and keys strictly in English, and only translate the values."
            } else ""

            val finalPrompt = prompt + translationInstruction + "\nCRITICAL: Respond ONLY with valid raw JSON object. DO NOT include reasoning or markdown wrappers."

            val requestPayload = buildJsonObject {
                put("contents", buildJsonArray {
                    addJsonObject {
                        put("role", "user")
                        put("parts", buildJsonArray {
                            addJsonObject {
                                put("text", finalPrompt)
                            }
                            addJsonObject {
                                putJsonObject("inlineData") {
                                    put("mimeType", "image/jpeg")
                                    put("data", b64)
                                }
                            }
                        })
                    }
                })
                putJsonObject("generationConfig") {
                    put("temperature", 0.2)
                    put("responseMimeType", "application/json")
                }
            }.toString()

            val url = "$GEMINI_BASE_URL/$DEFAULT_MODEL:generateContent?key=$key"
            val req = Request.Builder()
                .url(url)
                .post(requestPayload.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            try {
                val parsed = client.newCall(req).execute().use { resp ->
                    val body = resp.body?.string() ?: ""
                    parseGeminiResponse(body)
                }

                if (!parsed.startsWith("API Error")) {
                    Result.success(parsed)
                } else {
                    Result.failure(Exception(parsed))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun textQuery(apiKey: String, prompt: String): Result<String> =
        withContext(Dispatchers.IO) {
            val key = if (apiKey.isNotBlank()) apiKey else resolveApiKey(apiKey)
            if (apiKey.isBlank() || key.isBlank()) {
                return@withContext Result.failure(IllegalStateException("Gemini API key is not configured"))
            }

            val lang = LanguageManager.currentLanguage.value
            val langName = LanguageManager.getLanguageName(lang)
            val translationInstruction = if (lang != "en") {
                "\n\nCRITICAL INSTRUCTION: You MUST translate the output into $langName. However, if the prompt requires a strictly structured JSON response, YOU MUST KEEP ALL JSON KEYS IN EXACT ENGLISH as requested, and ONLY translate the VALUES into $langName. Do NOT respond in English. Use standard $langName script."
            } else ""

            val finalPrompt = prompt + translationInstruction

            val requestPayload = buildJsonObject {
                put("contents", buildJsonArray {
                    addJsonObject {
                        put("role", "user")
                        put("parts", buildJsonArray {
                            addJsonObject {
                                put("text", finalPrompt)
                            }
                        })
                    }
                })
                putJsonObject("generationConfig") {
                    put("temperature", 0.2)
                }
            }.toString()

            val url = "$GEMINI_BASE_URL/$DEFAULT_MODEL:generateContent?key=$key"
            val req = Request.Builder()
                .url(url)
                .post(requestPayload.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            try {
                val parsed = client.newCall(req).execute().use { resp ->
                    val body = resp.body?.string() ?: ""
                    parseGeminiResponse(body)
                }

                if (!parsed.startsWith("API Error")) {
                    Result.success(parsed)
                } else {
                    Result.failure(Exception(parsed))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun chatQuery(prompt: String): Result<String> = textQuery("", prompt)

    suspend fun checkAlerts(apiKey: String, state: String, mandi: String): Result<String> =
        withContext(Dispatchers.IO) {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            val today = sdf.format(java.util.Date())
            val prompt = "TODAY IS $today. You are NuKropAI Market Observer. The user is in State: '$state', Mandi: '$mandi'. Are there any sudden massive price drops/spikes for major crops HERE TODAY? Or any severe weather alerts expected HERE TODAY? Respond with a short 1-2 sentence emergency alert message if YES. If there are NO major alerts, respond STRICTLY with 'NO_ALERT'."
            textQuery(apiKey, prompt)
        }

    fun cropScanPrompt() = """You are a master Senior Agronomist and Plant Pathologist. Analyze this crop image. Identify the precise disease/pest, provide MAXIMUM pest control measures, and list 100% REAL, brand-name chemical pesticide/fungicide products available in India (e.g. Syngenta, Bayer, UPL) with exact dosages. BE EXTREMELY BRIEF AND FAST. 1 SENTENCE MAX PER FIELD.
Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "status": "Diseased",
  "name": "Disease/pest name or Healthy",
  "confidence": 92,
  "severity": "Low",
  "symptoms": "Very brief symptom description",
  "cause": "Exact causative organism",
  "treatment": "Precise chemical or organic treatment plan",
  "details": "Detailed biological information, lifecycle, or advanced agronomic insights about this condition (3-4 sentences).",
  "products": [
    {
      "name": "REAL brand name pesticide",
      "dose": "Exact dosage e.g. 2ml/L",
      "stores": [
        {
          "name": "Amazon India",
          "url": "https://www.amazon.in/s?k=brand+name+pesticide",
          "icon": "🛒"
        }
      ]
    }
  ],
  "prevention": "1 step prevention tip"
}"""

    fun soilScanPrompt() = """You are a master Soil Scientist. Analyze this soil image. Determine the soil type, estimate its properties, and recommend best practices. BE EXTREMELY BRIEF AND FAST.
Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "soilType": "Loam",
  "texture": "Fine",
  "estimatedPH": "6.5-7.5",
  "organicMatter": "Medium",
  "deficiencies": ["Nitrogen"],
  "improvements": "Add organic compost",
  "details": "Detailed analysis of soil profile, structure, and advanced agronomical insights (3-4 sentences).",
  "suitableCrops": ["Wheat", "Soybean"],
  "fertilizers": [
    {
      "name": "Urea 46%",
      "dose": "50kg/acre",
      "stores": [
        {
          "name": "Amazon India",
          "url": "https://www.amazon.in/s?k=Urea+fertilizer",
          "icon": "🛒"
        }
      ]
    }
  ]
}"""

    fun marketPrompt(crop: String) = """You are an AI Agriculture Commodity Expert. Analyze current market trends for $crop. Give a quick prediction for the next 7 days.
Respond ONLY in this JSON format (no markdown, no extra text):
{
  "crop": "$crop",
  "prediction": "Upward",
  "confidence": 85,
  "reasoning": "Brief explanation",
  "action": "Hold and sell next week"
}"""
}
