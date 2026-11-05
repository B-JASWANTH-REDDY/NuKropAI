plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.google.devtools.ksp)
  alias(libs.plugins.roborazzi)
  alias(libs.plugins.secrets)
  alias(libs.plugins.kotlinx.serialization)
  
}

android {
  namespace = "com.example"
  compileSdk { version = release(36) { minorApiLevel = 1 } }

  defaultConfig {
    applicationId = "com.nukrop.app"
    minSdk = 24
    targetSdk = 36
    versionCode = 2
    versionName = "1.1.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

    val geminiApiKey = (project.findProperty("GEMINI_API_KEY") as? String)
        ?: System.getenv("GEMINI_API_KEY")
        ?: ""
    buildConfigField("String", "GEMINI_API_KEY", "\"$geminiApiKey\"")

    val googleWebClientId = (project.findProperty("GOOGLE_WEB_CLIENT_ID") as? String)
        ?: System.getenv("GOOGLE_WEB_CLIENT_ID")
        ?: ""
    buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
  }

  signingConfigs {
    create("release") {
      val keystorePath = System.getenv("KEYSTORE_PATH")
      val isReleaseTask = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
      if (!keystorePath.isNullOrBlank() && file(keystorePath).exists()) {
        val storePass = System.getenv("STORE_PASSWORD")
        val keyUserAlias = System.getenv("KEY_ALIAS")
        val keyPass = System.getenv("KEY_PASSWORD")
        if (storePass.isNullOrBlank() || keyUserAlias.isNullOrBlank() || keyPass.isNullOrBlank()) {
          throw org.gradle.api.GradleException(
            "FATAL: Production release signing is misconfigured. " +
            "KEYSTORE_PATH is provided ($keystorePath), but STORE_PASSWORD, KEY_ALIAS, or KEY_PASSWORD are missing."
          )
        }
        storeFile = file(keystorePath)
        storePassword = storePass
        keyAlias = keyUserAlias
        keyPassword = keyPass
      } else if (isReleaseTask) {
        throw org.gradle.api.GradleException(
          "FATAL: Production release signing requires a valid production keystore. " +
          "KEYSTORE_PATH was not provided or file does not exist ($keystorePath). " +
          "Silent debug-key fallback on production release builds is strictly prohibited. " +
          "Configure KEYSTORE_PATH, STORE_PASSWORD, KEY_ALIAS, and KEY_PASSWORD in environment."
        )
      } else {
        // Fallback for non-release development tasks only (e.g. testDebugUnitTest, lint)
        storeFile = file("${rootDir}/debug.keystore")
        storePassword = "android"
        keyAlias = "androiddebugkey"
        keyPassword = "android"
      }
    }
    create("debugConfig") {
      storeFile = file("${rootDir}/debug.keystore")
      storePassword = "android"
      keyAlias = "androiddebugkey"
      keyPassword = "android"
    }
  }

  buildTypes {
    release {
      isCrunchPngs = true
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      signingConfig = signingConfigs.getByName("release")
    }
    debug {
      applicationIdSuffix = ".debug"
      isDebuggable = true
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }
  buildFeatures {
    compose = true
    buildConfig = true
  }
  lint {
    abortOnError = false
    checkReleaseBuilds = false
  }
}

// Configure the Secrets Gradle Plugin to use .env and .env.example files
// to match the convention used in Web projects.
secrets {
  propertiesFileName = ".env"
  defaultPropertiesFileName = ".env.example"
}

// Some unused dependencies are commented out below instead of being removed.
// This makes it easy to add them back in the future if needed.
dependencies {
  implementation(platform(libs.androidx.compose.bom))
  // implementation(libs.accompanist.permissions)
  implementation(libs.androidx.activity.compose)
  // implementation(libs.androidx.camera.camera2)
  // implementation(libs.androidx.camera.core)
  // implementation(libs.androidx.camera.lifecycle)
  // implementation(libs.androidx.camera.view)
  implementation(libs.androidx.compose.material.icons.core)
  implementation(libs.androidx.compose.material.icons.extended)
  implementation(libs.androidx.compose.material3)
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.graphics)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.core.ktx)
  // implementation(libs.androidx.datastore.preferences)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  // implementation(libs.androidx.navigation.compose)
  implementation(libs.androidx.room.ktx)
  implementation(libs.androidx.room.runtime)
  implementation(libs.compose.markdown)
  implementation(libs.coil.compose)
  // implementation(libs.converter.moshi)
  implementation(libs.supabase.auth)
  implementation(libs.supabase.postgrest)
  implementation(libs.supabase.realtime)
  implementation(libs.ktor.client.android)
  implementation("androidx.credentials:credentials:1.3.0")
  implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
  implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
  implementation(libs.kotlinx.coroutines.android)
  implementation(libs.kotlinx.coroutines.core)
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")
  implementation(libs.logging.interceptor)
  // implementation(libs.moshi.kotlin)
  implementation(libs.okhttp)
  // implementation(libs.play.services.location)
  implementation(libs.retrofit)
  implementation(libs.retrofit.converter.kotlinx.serialization)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.play.services.location)
  implementation("androidx.work:work-runtime-ktx:2.9.0")
  implementation(libs.androidx.lifecycle.runtime.compose)

  testImplementation(libs.androidx.compose.ui.test.junit4)
  testImplementation(libs.androidx.core)

  testImplementation(libs.androidx.junit)
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.robolectric)
  testImplementation(libs.roborazzi)
  testImplementation(libs.roborazzi.compose)
  testImplementation(libs.roborazzi.junit.rule)
  androidTestImplementation(platform(libs.androidx.compose.bom))
  androidTestImplementation(libs.androidx.compose.ui.test.junit4)
  androidTestImplementation(libs.androidx.espresso.core)
  androidTestImplementation(libs.androidx.junit)
  androidTestImplementation(libs.androidx.runner)
  debugImplementation(libs.androidx.compose.ui.test.manifest)
  debugImplementation(libs.androidx.compose.ui.tooling)
  implementation(libs.tensorflow.lite)
  implementation(libs.androidx.camera.camera2)
  implementation(libs.androidx.camera.core)
  implementation(libs.androidx.camera.lifecycle)
  implementation(libs.androidx.camera.view)
  "ksp"(libs.androidx.room.compiler)
  "ksp"(libs.moshi.kotlin.codegen)
}

val projectRootDir = rootDir
val apkOutputDir = layout.buildDirectory.dir("outputs/apk")

tasks.register("syncApkToWeb") {
    description = "Syncs authentic release APK to web public download path only if production signed"
    notCompatibleWithConfigurationCache("Dynamic file copy to web directory")
    doLast {
        val releaseApk = apkOutputDir.get().file("release/app-release.apk").asFile
        if (releaseApk.exists()) {
            val isProductionConfigured = !System.getenv("KEYSTORE_PATH").isNullOrBlank()
            if (!isProductionConfigured) {
                println("⚠️ [Gradle syncApkToWeb] Release APK was compiled without KEYSTORE_PATH. Refusing to copy debug-signed APK to production download paths.")
                return@doLast
            }
            val rootApk = File(projectRootDir, "NuKropAI.apk")
            val webPublicDir = File(projectRootDir, "web/public")
            webPublicDir.mkdirs()
            releaseApk.copyTo(rootApk, overwrite = true)
            releaseApk.copyTo(File(webPublicDir, "NuKropAI.apk"), overwrite = true)
            releaseApk.copyTo(File(webPublicDir, "NuKropAI_v2.0.apk"), overwrite = true)
            releaseApk.copyTo(File(webPublicDir, "NuKropAI_latest.apk"), overwrite = true)
            println("✅ [Gradle] Successfully verified production-signed Release APK (${releaseApk.length() / (1024 * 1024)} MB) synced to public download paths.")
        }
    }
}

tasks.matching { it.name == "assembleRelease" }.configureEach {
    finalizedBy("syncApkToWeb")
}

