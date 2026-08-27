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

        val previewUrl = result.previewImageUrl
        if (!previewUrl.isNullOrBlank()) {
            if (previewUrl.startsWith("http://") || previewUrl.startsWith("https://")) {
                ivScreenshot?.visibility = View.VISIBLE
                ivScreenshot?.load(previewUrl)
            } else if (previewUrl.startsWith("data:image") || previewUrl.length > 100) {
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
                        ivScreenshot?.visibility = View.VISIBLE
                    } else {
                        ivScreenshot?.visibility = View.GONE
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

        btnBlock?.setOnClickListener {
            dismiss()
            activity?.finish()
        }

        btnProceed?.setOnClickListener {
            val destination = result.finalUrl ?: result.originalUrl ?: "https://google.com"
            val uri = Uri.parse(destination)
            val ctx = context
            if (ctx != null) {
                try {
                    val baseIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                        addCategory(Intent.CATEGORY_BROWSABLE)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    val resolveInfos = ctx.packageManager.queryIntentActivities(baseIntent, 0)
                    val target = resolveInfos.firstOrNull { it.activityInfo.packageName != ctx.packageName }

                    if (target != null) {
                        val launchIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                            setClassName(target.activityInfo.packageName, target.activityInfo.name)
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(launchIntent)
                    } else {
                        startActivity(baseIntent)
                    }
                } catch (_: Exception) {
                    val fallback = Intent(Intent.ACTION_VIEW, uri).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(fallback)
                }
            }
            dismiss()
            activity?.finish()
        }
    }
}