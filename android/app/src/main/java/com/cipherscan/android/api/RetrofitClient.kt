package com.cipherscan.android.api

import com.cipherscan.android.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private val BASE_URL = if (BuildConfig.CIPHERSCAN_SERVER_URL.isNotBlank()) {
        if (BuildConfig.CIPHERSCAN_SERVER_URL.endsWith("/")) {
            BuildConfig.CIPHERSCAN_SERVER_URL
        } else {
            "${BuildConfig.CIPHERSCAN_SERVER_URL}/"
        }
    } else {
        "https://cipherscan-ecjs.onrender.com/"
    }

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()
        if (BuildConfig.CIPHERSCAN_API_KEY.isNotBlank()) {
            builder.header("x-api-key", BuildConfig.CIPHERSCAN_API_KEY)
        }
        chain.proceed(builder.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .build()

    val instance: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}