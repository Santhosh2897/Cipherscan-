package com.cipherscan.android.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

data class AnalyzeRequest(
    @SerializedName("url")
    val url: String,
    @SerializedName("targetUrl")
    val targetUrl: String = url,
    @SerializedName("triggerType")
    val triggerType: String = "CLICK"
)

@Parcelize
data class ScanResult(
    @SerializedName("id")
    val id: String? = null,
    @SerializedName("targetUrl")
    val targetUrl: String,
    @SerializedName("finalUrl")
    val finalUrl: String? = null,
    @SerializedName("verdict")
    val verdict: String,
    @SerializedName("riskScore")
    val riskScore: Int,
    @SerializedName("threatTypes")
    val threatTypes: List<String> = emptyList(),
    @SerializedName("threatReasons")
    val threatReasons: List<String> = emptyList(),
    @SerializedName("redirectChain")
    val redirectChain: List<String> = emptyList(),
    @SerializedName("screenshotUrl")
    val screenshotUrl: String? = null,
    @SerializedName("domainReputation")
    val domainReputation: DomainReputation? = null,
    @SerializedName("scannedAt")
    val scannedAt: String? = null
) : Parcelable

@Parcelize
data class DomainReputation(
    @SerializedName("domain")
    val domain: String? = null,
    @SerializedName("creationDate")
    val creationDate: String? = null,
    @SerializedName("registrar")
    val registrar: String? = null,
    @SerializedName("virustotalScore")
    val virustotalScore: Int? = null,
    @SerializedName("googleSafeBrowsingMatch")
    val googleSafeBrowsingMatch: Boolean? = null
) : Parcelable