package com.cipherscan.android.api

import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.model.ScanResult
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * CipherScan — Retrofit API interface.
 *
 * Base URL is configured in [RetrofitClient].
 * Update `cipherscan.server.url` in local.properties to point at your
 * deployed CipherScan backend.
 */
interface ApiService {

    /**
     * POST /api/analyze
     *
     * Sends a URL or UPI payment string for threat analysis.
     * Returns a full [ScanResult] with isSafe, riskScore, redirectChain, etc.
     */
    @POST("api/analyze")
    suspend fun analyzeUrl(@Body request: AnalyzeRequest): ScanResult
}
