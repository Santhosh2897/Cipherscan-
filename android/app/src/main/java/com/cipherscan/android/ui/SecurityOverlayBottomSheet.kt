package com.cipherscan.android.ui

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import coil.load
import com.cipherscan.android.R
import com.cipherscan.android.model.ScanResult
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.button.MaterialButton

/**
 * CipherScan — SecurityOverlayBottomSheet
 *
 * Full-screen bottom sheet overlay shown when a threat is detected.
 *
 * Contents:
 *  ┌─────────────────────────────────────────┐
 *  │  ⚠ MALICIOUS              [Risk Gauge]  │
 *  │  Phishing / Obfuscated Redirect         │
 *  │  ───────────────────────────────────    │
 *  │  [Screenshot Preview Thumbnail]         │
 *  │  ───────────────────────────────────    │
 *  │  Redirect Chain  (expandable)           │
 *  │  ───────────────────────────────────    │
 *  │  Threat Reasons                         │
 *  │  ───────────────────────────────────    │
 *  │  [Abort & Go Back]   [Proceed Anyway]   │
 *  └─────────────────────────────────────────┘
 */
class SecurityOverlayBottomSheet : BottomSheetDialogFragment() {

    companion object {
        const val TAG = "SecurityOverlayBottomSheet"
        private const val ARG_RESULT = "scan_result"

        fun newInstance(result: ScanResult) = SecurityOverlayBottomSheet().apply {
            arguments = Bundle().apply { putParcelable(ARG_RESULT, result) }
        }
    }

    private lateinit var scanResult: ScanResult

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, R.style.CipherScan_BottomSheetStyle)
        scanResult = arguments?.getParcelable(ARG_RESULT)
            ?: throw IllegalStateException("ScanResult required")
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View = inflater.inflate(R.layout.layout_security_overlay, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        bindRiskGauge(view)
        bindVerdictBadge(view)
        bindScreenshotPreview(view)
        bindRedirectChain(view)
        bindThreatReasons(view)
        bindActionButtons(view)
    }

    // ─────────────────────────────────────────────────────────
    // Binding
    // ─────────────────────────────────────────────────────────

    private fun bindRiskGauge(view: View) {
        val gauge = view.findViewById<RiskGaugeView>(R.id.riskGauge)
        gauge.setRiskScore(scanResult.riskScore)

        view.findViewById<TextView>(R.id.tvRiskScore).apply {
            text = "${scanResult.riskScore}"
            setTextColor(gaugeColor(scanResult.riskScore))
        }
    }

    private fun bindVerdictBadge(view: View) {
        val (label, color) = when (scanResult.verdict) {
            "malicious"  -> "MALICIOUS"  to Color.parseColor("#EF4444")
            "suspicious" -> "SUSPICIOUS" to Color.parseColor("#F59E0B")
            else         -> "SAFE"       to Color.parseColor("#10B981")
        }
        view.findViewById<TextView>(R.id.tvVerdictBadge).apply {
            text = label
            setBackgroundColor(color)
        }
        scanResult.threatCategory?.let { cat ->
            view.findViewById<TextView>(R.id.tvThreatCategory).apply {
                text = cat
                visibility = View.VISIBLE
            }
        }
    }

    private fun bindScreenshotPreview(view: View) {
        val imgPreview = view.findViewById<ImageView>(R.id.imgScreenshotPreview)
        val url = scanResult.previewImageUrl
        if (!url.isNullOrBlank()) {
            imgPreview.visibility = View.VISIBLE
            imgPreview.load(url) {
                crossfade(true)
                placeholder(R.drawable.ic_screenshot_placeholder)
                error(R.drawable.ic_screenshot_error)
            }
        } else {
            imgPreview.visibility = View.GONE
        }
    }

    private fun bindRedirectChain(view: View) {
        val container = view.findViewById<LinearLayout>(R.id.redirectChainContainer)
        scanResult.redirectChain.forEachIndexed { i, url ->
            layoutInflater.inflate(R.layout.item_redirect_hop, container, false).also {
                it.findViewById<TextView>(R.id.tvHopNumber).text = "${i + 1}"
                it.findViewById<TextView>(R.id.tvHopUrl).text = url
                container.addView(it)
            }
        }
        view.findViewById<TextView>(R.id.tvToggleChain).setOnClickListener {
            val visible = container.visibility == View.VISIBLE
            container.visibility = if (visible) View.GONE else View.VISIBLE
            (it as TextView).text = if (visible) "Show redirect chain ▼" else "Hide redirect chain ▲"
        }
    }

    private fun bindThreatReasons(view: View) {
        val container = view.findViewById<LinearLayout>(R.id.reasonsContainer)
        scanResult.reasons.forEach { reason ->
            container.addView(TextView(requireContext()).apply {
                text = "• $reason"
                setTextColor(Color.parseColor("#F9FAFB"))
                setPadding(0, 4, 0, 4)
            })
        }
    }

    private fun bindActionButtons(view: View) {
        view.findViewById<MaterialButton>(R.id.btnAbort).setOnClickListener {
            dismiss()
            activity?.finish()
        }
        view.findViewById<MaterialButton>(R.id.btnProceed).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(scanResult.finalUrl)).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
            dismiss()
            activity?.finish()
        }
    }

    // ─────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────

    private fun gaugeColor(score: Int): Int = when {
        score >= 70 -> Color.parseColor("#EF4444")
        score >= 30 -> Color.parseColor("#F59E0B")
        else        -> Color.parseColor("#10B981")
    }
}
