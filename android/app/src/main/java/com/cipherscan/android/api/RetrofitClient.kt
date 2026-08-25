package com.cipherscan.android.api

import com.cipherscan.android.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private const val DEFAULT_BASE_URL = "https://cipherscan-ecjs.onrender.com/"

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .addInterceptor { chain ->
            val original = chain.request()
            val requestBuilder = original.newBuilder()
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")

            if (BuildConfig.CIPHERSCAN_API_KEY.isNotBlank() && BuildConfig.CIPHERSCAN_API_KEY != "null") {
                requestBuilder.header("x-api-key", BuildConfig.CIPHERSCAN_API_KEY)
            }

            chain.proceed(requestBuilder.build())
        }
        .connectTimeout(45, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit: Retrofit by lazy {
        val configuredUrl = BuildConfig.CIPHERSCAN_SERVER_URL.ifBlank { DEFAULT_BASE_URL }
        val sanitizedUrl = if (configuredUrl.endsWith("/")) configuredUrl else "$configuredUrl/"

        Retrofit.Builder()
            .baseUrl(sanitizedUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val apiService: ApiService by lazy {
        retrofit.create(ApiService::class.java)
    }
}