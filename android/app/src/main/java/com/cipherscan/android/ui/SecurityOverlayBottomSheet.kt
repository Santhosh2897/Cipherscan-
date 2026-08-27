package com.cipherscan.android.ui

import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.cipherscan.android.R
import com.cipherscan.android.model.ScanResult
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import coil.load

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
        scanResult = arguments?.getSerializable(ARG_SCAN_RESULT) as? ScanResult
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

        tvUrl?.text = result.originalUrl ?: result.finalUrl ?: "Unknown URL"
        tvScore?.text = "Risk Score: ${result.riskScore}/100"

        val verdictUpper = result.verdict.uppercase()
        tvVerdict?.text = verdictUpper
        when (verdictUpper) {
            "MALICIOUS" -> {
                tvVerdict?.setTextColor(Color.parseColor("#EF4444"))
                tvVerdict?.setBackgroundColor(Color.parseColor("#33EF4444"))
            }
            "SUSPICIOUS" -> {
                tvVerdict?.setTextColor(Color.parseColor("#F59E0B"))
                tvVerdict?.setBackgroundColor(Color.parseColor("#33F59E0B"))
            }
            else -> {
                tvVerdict?.setTextColor(Color.parseColor("#10B981"))
                tvVerdict?.setBackgroundColor(Color.parseColor("#3310B981"))
            }
        }

        containerReasons?.removeAllViews()
        val reasonsList = result.reasons ?: emptyList()
        if (reasonsList.isEmpty()) {
            val tvEmpty = TextView(context).apply {
                text = if (verdictUpper == "SAFE") "• No malicious signatures detected." else "• Flagged by threat intelligence scanners."
                setTextColor(Color.LTGRAY)
                textSize = 13f
            }
            containerReasons?.addView(tvEmpty)
        } else {
            for (reason in reasonsList) {
                val tvReason = TextView(context).apply {
                    text = "• $reason"
                    setTextColor(Color.WHITE)
                    textSize = 13f
                    setPadding(0, 4, 0, 4)
                }
                containerReasons?.addView(tvReason)
            }
        }

        result.previewImageUrl?.let { imgUrl ->
            if (imgUrl.isNotBlank()) {
                if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
                    ivScreenshot?.visibility = View.VISIBLE
                    ivScreenshot?.load(imgUrl) {
                        crossfade(true)
                        listener(
                            onError = { _, _ -> ivScreenshot.visibility = View.GONE }
                        )
                    }
                } else if (imgUrl.startsWith("data:image") || imgUrl.length > 100) {
                    try {
                        val cleanBase64 = if (imgUrl.contains(",")) imgUrl.substringAfter(",") else imgUrl
                        val decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                        val bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
                        if (bitmap != null) {
                            ivScreenshot?.setImageBitmap(bitmap)
                            ivScreenshot?.visibility = View.VISIBLE
                        }
                    } catch (_: Exception) {
                        ivScreenshot?.visibility = View.GONE
                    }
                } else {
                    ivScreenshot?.visibility = View.GONE
                }
            } else {
                ivScreenshot?.visibility = View.GONE
            }
        } ?: run {
            ivScreenshot?.visibility = View.GONE
        }

        btnBlock?.setOnClickListener {
            dismiss()
            activity?.finish()
        }

        btnProceed?.setOnClickListener {
            val destination = result.finalUrl ?: result.originalUrl ?: "https://google.com"
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(destination)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(browserIntent)
            dismiss()
            activity?.finish()
        }
    }
}