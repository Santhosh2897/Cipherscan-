# Preserve Gson / Retrofit Model serialization classes
-keepclassmembers class com.cipherscan.android.model.** { *; }
-keep class com.cipherscan.android.model.** { *; }

# Retain Retrofit and OkHttp annotations & methods
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations

# OkHttp & Coroutines
-dontwarn okhttp3.**
-dontwarn kotlinx.coroutines.**