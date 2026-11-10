plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.nukrop.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.nukrop.app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = 2
        versionName = "1.1.0"
    }

    buildTypes {
        release {
            val keystorePath = System.getenv("KEYSTORE_PATH")
            if (!keystorePath.isNullOrBlank() && file(keystorePath).exists()) {
                val storePass = System.getenv("STORE_PASSWORD")
                val keyUserAlias = System.getenv("KEY_ALIAS")
                val keyPass = System.getenv("KEY_PASSWORD")
                if (!storePass.isNullOrBlank() && !keyUserAlias.isNullOrBlank() && !keyPass.isNullOrBlank()) {
                    signingConfig = signingConfigs.create("release") {
                        storeFile = file(keystorePath)
                        storePassword = storePass
                        keyAlias = keyUserAlias
                        keyPassword = keyPass
                    }
                }
            }
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
