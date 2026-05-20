import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use { localProperties.load(it) }
}

fun readMapsKeyFromApiConfig(): String {
    val configFile = rootProject.file("../assets/config/api_config.json")
    if (!configFile.exists()) return ""
    val text = configFile.readText()
    val match = Regex(""""GOOGLE_MAPS_API_KEY"\s*:\s*"([^"]*)"""").find(text)
    return match?.groupValues?.get(1)?.trim().orEmpty()
}

val mapsApiKey: String = localProperties.getProperty("GOOGLE_MAPS_API_KEY", "")
    .ifBlank { readMapsKeyFromApiConfig() }

android {
    namespace = "com.citybrain.citybrain_citizen"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.citybrain.citybrain_citizen"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["GOOGLE_MAPS_API_KEY"] = mapsApiKey
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

flutter {
    source = "../.."
}

// Match Java compileOptions (17) — Kotlin 2.x defaults to JVM 21 otherwise.
kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}
