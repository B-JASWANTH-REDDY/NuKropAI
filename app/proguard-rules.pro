# ════════════════════════════════════════════════════════════
# NuKropAI — Production ProGuard Rules
# Required for Play Store release build with isMinifyEnabled=true
# ════════════════════════════════════════════════════════════

# Preserve stack traces in crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── WebView JavaScript Bridge ───────────────────────────────
# CRITICAL: Keep all @JavascriptInterface methods or the WebView
# bridge will break silently in release builds.
-keepclassmembers class com.example.MainActivity$WebAppInterface {
    public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Kotlin Coroutines ───────────────────────────────────────
-keepclassmembernames class kotlinx.** { volatile <fields>; }
-keep class kotlinx.coroutines.** { *; }

# ─── Supabase / Ktor ─────────────────────────────────────────
-keep class io.github.jan.supabase.** { *; }
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# ─── OkHttp ──────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ─── Retrofit ────────────────────────────────────────────────
-keepattributes Signature
-keepattributes Exceptions
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**

# ─── Kotlinx Serialization ───────────────────────────────────
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep,includedescriptorclasses class com.example.**$$serializer { *; }
-keepclassmembers class com.example.** {
    *** Companion;
}
-keepclasseswithmembers class com.example.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ─── Data Classes (Mandi records) ────────────────────────────
-keep class com.example.MandiRecord { *; }

# ─── Moshi ───────────────────────────────────────────────────
-keepclasseswithmembers class * {
    @com.squareup.moshi.* <methods>;
}
-keep @com.squareup.moshi.JsonQualifier interface *
-dontwarn com.squareup.moshi.**

# ─── Google Play Services / Credentials ──────────────────────
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-keep class androidx.credentials.** { *; }
-dontwarn com.google.android.libraries.identity.**
-keep class com.google.android.libraries.identity.** { *; }

# ─── Room Database ───────────────────────────────────────────
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.**

# ─── TensorFlow Lite (crop disease ML model) ─────────────────
-keep class org.tensorflow.lite.** { *; }
-dontwarn org.tensorflow.**

# ─── WorkManager ─────────────────────────────────────────────
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.ListenableWorker
-keepclassmembers class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context,androidx.work.WorkerParameters);
}

# ─── Coil Image Loading ───────────────────────────────────────
-dontwarn coil.**

# ─── AndroidX / Compose ──────────────────────────────────────
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# ─── R8 / Generic ────────────────────────────────────────────
-allowaccessmodification
-repackageclasses
