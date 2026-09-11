package com.cipherscan.android.api

import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.model.ReportThreatRequest
import com.cipherscan.android.model.ReportThreatResponse
import com.cipherscan.android.model.ScanResult
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface ApiService {
    @POST("api/analyze")
    suspend fun analyzeUrl(@Body request: AnalyzeRequest): Response<ScanResult>

    @POST("api/community/report")
    suspend fun reportThreat(@Body report: ReportThreatRequest): Response<ReportThreatResponse>
}