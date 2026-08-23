package com.cipherscan.android.api

import com.cipherscan.android.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * CipherScan — RetrofitClient
 *
 * Singleton Retrofit instance pointed at the CipherScan backend.
 *
 * Configuration (local.properties):
 *   cipherscan.server.url=https://your-backend.replit.app/
 *
 * The value is injected into BuildConfig via build.gradle:
 *   buildConfigField("String", "CIPHERSCAN_SERVER_URL",
 *       "\"${localProperties["cipherscan.server.url"]}\"")
 */
object RetrofitClient {

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                else                   HttpLoggingInterceptor.Level.NONE
    }

    // Attaches the shared API key to every request so the backend's
    // requireApiKey middleware accepts it. Must match APP_API_KEY set on
    // the backend (see cipherscan.api.key in local.properties).
    private val apiKeyInterceptor = okhttp3.Interceptor { chain ->
        val original = chain.request()
        val withKey = original.newBuilder()
            .addHeader("x-api-key", BuildConfig.CIPHERSCAN_API_KEY)
            .build()
        chain.proceed(withKey)
    }

    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(apiKeyInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)   // sandbox analysis can take ~5-10 s
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    val instance: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.CIPHERSCAN_SERVER_URL)
            .client(httpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
