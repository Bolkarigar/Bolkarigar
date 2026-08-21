# BolKarigar — release obfuscation (R8)

-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor / WebView bridge
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
}
-keep class com.bolkarigar.app.MainActivity { *; }

# AndroidX
-keep class androidx.core.content.FileProvider { *; }
-dontwarn org.chromium.**
