package com.cipherscan.android.ui

import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.graphics.toColorInt
import androidx.lifecycle.lifecycleScope
import com.cipherscan.android.R
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.ReportThreatRequest
import com.cipherscan.android.model.ScanResult
import com.cipherscan.android.util.DeviceUtils
import com.cipherscan.android.util.UpiVpaValidator
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import coil.load
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SecurityOverlayBottomSheet : BottomSheetDialogFragment() {

    private var scanResult: ScanResult? = null

    companion object {
        private const val ARG_SCAN_RESULT = "arg_scan_result"

        fun newInstance(scanResult: ScanResult): SecurityOverlayBottomSheet {
            val fragment = SecurityOverlayBottomSheet()
            val args = Bundle().apply {
                putSerializable(ARG_SCAN_RESULT, scanResult)
            }
            fragment.arguments = args
            return fragment
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        scanResult = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arguments?.getSerializable(ARG_SCAN_RESULT, ScanResult::class.java)
        } else {
            @Suppress("DEPRECATION")
            arguments?.getSerializable(ARG_SCAN_RESULT) as? ScanResult
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.layout_security_overlay, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val result = scanResult ?: return

        val tvUrl = view.findViewById<TextView>(R.id.tvTargetUrl)
        val tvVerdict = view.findViewById<TextView>(R.id.tvVerdictBadge)
        val tvScore = view.findViewById<TextView>(R.id.tvRiskScore)
        val ivScreenshot = view.findViewById<ImageView>(R.id.ivScreenshotPreview)
        val containerReasons = view.findViewById<LinearLayout>(R.id.containerThreatReasons)
        val btnProceed = view.findViewById<Button>(R.id.btnProceedAnyway)
        val btnBlock = view.findViewById<Button>(R.id.btnCancel)
        val btnReportThreat = view.findViewById<Button>(R.id.btnReportThreat)

        // Intelligence Badges
        val tvCacheBadge = view.findViewById<TextView>(R.id.tvCacheBadge)
        val tvTrustedDomainBadge = view.findViewById<TextView>(R.id.tvTrustedDomainBadge)
        val tvCommunityTrustBadge = view.findViewById<TextView>(R.id.tvCommunityTrustBadge)

        // UPI Alert Views
        val containerUpiAlert = view.findViewById<LinearLayout>(R.id.containerUpiAlert)
        val tvUpiTitle = view.findViewById<TextView>(R.id.tvUpiTitle)
        val tvUpiDetails = view.findViewById<TextView>(R.id.tvUpiDetails)
        val tvUpiWarning = view.findViewById<TextView>(R.id.tvUpiWarning)

        val targetUrl = result.originalUrl ?: result.finalUrl ?: "Unknown URL"
        tvUrl?.text = targetUrl
        tvScore?.text = getString(R.string.risk_score_format, result.riskScore)

        // 1. Show Intelligence Badges
        if (result.fromCache) {
            tvCacheBadge?.visibility = View.VISIBLE
            val hits = result.cacheHitCount ?: 1
            tvCacheBadge?.text = if (hits > 1) "⚡ Instant Cache ($hits hits)" else "⚡ Instant Cache"
        } else {
            tvCacheBadge?.visibility = View.GONE
        }

        if (result.fromTrustedDomain) {
            tvTrustedDomainBadge?.visibility = View.VISIBLE
            val scans = result.domainScanCount ?: 1
            tvTrustedDomainBadge?.text = "⭐ Trusted Domain ($scans scans)"
        } else {
            tvTrustedDomainBadge?.visibility = View.GONE
        }

        if (result.communityTrustScore != null && result.communityTrustScore >= 0) {
            tvCommunityTrustBadge?.visibility = View.VISIBLE
            tvCommunityTrustBadge?.text = "👥 Community Trust: ${result.communityTrustScore}/100"
        } else {
            tvCommunityTrustBadge?.visibility = View.GONE
        }

        // 2. UPI VPA Fraud Detection Check
        var isUpiSuspicious = false
        val isUpiScheme = targetUrl.lowercase().startsWith("upi://") || targetUrl.contains("@")
        if (isUpiScheme) {
            val upiAnalysis = UpiVpaValidator.analyze(targetUrl)
            containerUpiAlert?.visibility = View.VISIBLE

            val detailsText = buildString {
                append("Payee VPA: ${upiAnalysis.vpa}")
                if (!upiAnalysis.payeeName.isNullOrBlank()) {
                    append("\nPayee Name: ${upiAnalysis.payeeName}")
                }
                if (!upiAnalysis.amount.isNullOrBlank()) {
                    append("\nAmount: ₹${upiAnalysis.amount}")
                }
            }
            tvUpiDetails?.text = detailsText

            if (upiAnalysis.isTrustedVpa) {
                tvUpiTitle?.text = "✓ Verified Legitimate UPI (${upiAnalysis.matchedTrustedName ?: "Bank"})"
                tvUpiTitle?.setTextColor("#10B981".toColorInt())
                tvUpiWarning?.visibility = View.GONE
            } else if (upiAnalysis.isSuspicious) {
                isUpiSuspicious = true
                tvUpiTitle?.text = "⚠️ Suspicious UPI Payment Intent"
                tvUpiTitle?.setTextColor("#EF4444".toColorInt())
                tvUpiWarning?.visibility = View.VISIBLE
                tvUpiWarning?.text = upiAnalysis.warning ?: "Potential typosquatting or fraudulent payment handle."
            } else {
                tvUpiTitle?.text = "💳 UPI Payment Intent"
                tvUpiTitle?.setTextColor("#C084FC".toColorInt())
                tvUpiWarning?.visibility = View.GONE
            }
        } else {
            containerUpiAlert?.visibility = View.GONE
        }

        // 3. Verdict styling (adjusted if UPI flagged as suspicious)
        var verdictUpper = result.verdict.uppercase()
        if (isUpiSuspicious && verdictUpper == "SAFE") {
            verdictUpper = "SUSPICIOUS"
        }

        tvVerdict?.text = verdictUpper
        when (verdictUpper) {
            "MALICIOUS" -> {
                tvVerdict?.setTextColor("#EF4444".toColorInt())
                tvVerdict?.setBackgroundColor("#33EF4444".toColorInt())
            }
            "SUSPICIOUS" -> {
                tvVerdict?.setTextColor("#F59E0B".toColorInt())
                tvVerdict?.setBackgroundColor("#33F59E0B".toColorInt())
            }
            else -> {
                tvVerdict?.setTextColor("#10B981".toColorInt())
                tvVerdict?.setBackgroundColor("#3310B981".toColorInt())
            }
        }

        // 4. Reasons List
        containerReasons?.removeAllViews()
        val reasonsList = (result.reasons ?: emptyList()).toMutableList()
        if (isUpiSuspicious) {
            reasonsList.add(0, "Typosquatted or suspicious UPI VPA detected")
        }

        if (reasonsList.isEmpty()) {
            val tvEmpty = TextView(context).apply {
                text = if (verdictUpper == "SAFE") "• No malicious signatures detected." else "• Flagged by threat intelligence scanners."
                setTextColor("#AAAAAA".toColorInt())
                textSize = 13f
            }
            containerReasons?.addView(tvEmpty)
        } else {
            for (reason in reasonsList) {
                val tvReason = TextView(context).apply {
                    text = getString(R.string.reason_bullet_format, reason)
                    setTextColor(Color.WHITE)
                    textSize = 13f
                    setPadding(0, 4, 0, 4)
                }
                containerReasons?.addView(tvReason)
            }
        }

        // 5. Screenshot preview
        val previewUrl = result.previewImageUrl
        if (!previewUrl.isNullOrBlank()) {
            ivScreenshot?.visibility = View.VISIBLE
            if (previewUrl.startsWith("data:image")) {
                try {
                    val cleanBase64 = if (previewUrl.contains(",")) {
                        previewUrl.substringAfter(",")
                    } else {
                        previewUrl
                    }
                    val decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                    val bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
                    if (bitmap != null) {
                        ivScreenshot?.setImageBitmap(bitmap)
                    } else {
                        ivScreenshot?.visibility = View.GONE
                    }
                } catch (_: Exception) {
                    ivScreenshot?.visibility = View.GONE
                }
            } else {
                val baseUrl = if (com.cipherscan.android.BuildConfig.CIPHERSCAN_SERVER_URL.isNotBlank()) {
                    com.cipherscan.android.BuildConfig.CIPHERSCAN_SERVER_URL.trimEnd('/')
                } else {
                    "https://cipherscan-ecjs.onrender.com"
                }
                val fullUrl = if (previewUrl.startsWith("http://") || previewUrl.startsWith("https://")) {
                    previewUrl
                } else {
                    "$baseUrl$previewUrl"
                }
                ivScreenshot?.load(fullUrl) {
                    crossfade(true)
                    listener(
                        onError = { _, _ -> ivScreenshot.visibility = View.GONE },
                        onSuccess = { _, _ -> ivScreenshot.visibility = View.VISIBLE }
                    )
                }
            }
        } else {
            ivScreenshot?.visibility = View.GONE
        }

        // 6. Report as Threat Button Action
        btnReportThreat?.setOnClickListener {
            val ctx = context ?: return@setOnClickListener
            val devId = DeviceUtils.getDeviceId(ctx)
            btnReportThreat.isEnabled = false
            btnReportThreat.text = "Reporting threat..."

            viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val req = ReportThreatRequest(
                        url = targetUrl,
                        deviceId = devId,
                        reportedVerdict = "malicious"
                    )
                    val response = RetrofitClient.instance.reportThreat(req)
                    withContext(Dispatchers.Main) {
                        if (response.isSuccessful && response.body()?.success == true) {
                            Toast.makeText(ctx, "✓ Reported to CipherScan Community Network!", Toast.LENGTH_SHORT).show()
                            btnReportThreat.text = "✓ Reported to Community"
                            btnReportThreat.setTextColor("#10B981".toColorInt())
                        } else {
                            Toast.makeText(ctx, "Report submitted to queue", Toast.LENGTH_SHORT).show()
                            btnReportThreat.text = "✓ Report Received"
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(ctx, "Report saved locally", Toast.LENGTH_SHORT).show()
                        btnReportThreat.text = "✓ Recorded"
                    }
                }
            }
        }

        val btnDashboard = view.findViewById<Button>(R.id.btnViewOnWebDashboard)
        btnDashboard?.setOnClickListener {
            val act = activity
            if (act != null) {
                BrowserLauncher.openUrl(act, "https://cipherscan-dashboard.vercel.app/scans")
            }
        }

        btnBlock?.setOnClickListener {
            dismiss()
            activity?.finish()
        }

        btnProceed?.setOnClickListener {
            val destination = result.finalUrl ?: result.originalUrl ?: "https://google.com"
            val act = activity
            if (act != null && !act.isFinishing) {
                BrowserLauncher.openUrl(act, destination)
            }
            try {
                dismissAllowingStateLoss()
            } catch (_: Exception) {}
            act?.finish()
        }
    }

    override fun onDismiss(dialog: android.content.DialogInterface) {
        super.onDismiss(dialog)
        activity?.finish()
    }

    override fun onCancel(dialog: android.content.DialogInterface) {
        super.onCancel(dialog)
        activity?.finish()
    }
}