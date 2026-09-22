package com.cipherscan.android.api

import com.cipherscan.android.model.AlertAcknowledgeRequest
import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.model.ReportThreatRequest
import com.cipherscan.android.model.ReportThreatResponse
import com.cipherscan.android.model.RetroactiveAlertResponse
import com.cipherscan.android.model.ScanResult
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface ApiService {
    @POST("api/analyze")
    suspend fun analyzeUrl(@Body request: AnalyzeRequest): Response<ScanResult>

    @POST("api/community/report")
    suspend fun reportThreat(@Body report: ReportThreatRequest): Response<ReportThreatResponse>

    @GET("api/alerts/retroactive")
    suspend fun checkRetroactiveAlert(
        @Query("scanId") scanId: Long? = null,
        @Query("deviceId") deviceId: String? = null
    ): Response<RetroactiveAlertResponse>

    @POST("api/alerts/acknowledge")
    suspend fun acknowledgeAlert(
        @Body request: AlertAcknowledgeRequest
    ): Response<Map<String, Any>>
}