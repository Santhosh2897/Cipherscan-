package com.cipherscan.android.activity

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.cipherscan.android.R
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.model.ScanResult
import com.cipherscan.android.ui.BrowserLauncher
import com.cipherscan.android.ui.SecurityOverlayBottomSheet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LinkInterceptorActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "LinkInterceptor"
    }

    private var progressBar: ProgressBar? = null
    private var ivVerifiedBadge: ImageView? = null
    private var tvStatus: TextView? = null
    private var tvSubStatus: TextView? = null
    private var cardContainer: View? = null
    private var isProceeding = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_link_interceptor)

        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                finish()
            }
        })

        progressBar = findViewById(R.id.progressBar)
        ivVerifiedBadge = findViewById(R.id.ivVerifiedBadge)
        tvStatus = findViewById(R.id.tvStatus)
        tvSubStatus = findViewById(R.id.tvSubStatus)
        cardContainer = findViewById(R.id.cardContainer)

        val targetUrl = intent?.dataString
        if (targetUrl.isNullOrBlank()) {
            Toast.makeText(this, "No valid URL received", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val lowerUrl = targetUrl.lowercase()
        val isValidScheme = lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://") || lowerUrl.startsWith("upi://")
        if (!isValidScheme) {
            Log.d(TAG, "Ignoring non-web scheme intent: $targetUrl")
            finish()
            return
        }

        analyzeAndDisplay(targetUrl)
    }

    private fun analyzeAndDisplay(url: String) {
        progressBar?.visibility = View.VISIBLE
        ivVerifiedBadge?.visibility = View.GONE
        tvSubStatus?.visibility = View.GONE
        tvStatus?.text = "Verifying link safety…"

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val devId = com.cipherscan.android.util.DeviceUtils.getDeviceId(this@LinkInterceptorActivity)
                val devName = com.cipherscan.android.util.DeviceUtils.getDeviceName()
                val triggerType = intent?.getStringExtra("triggerType") ?: "link"
                val request = AnalyzeRequest(
                    targetUrl = url,
                    triggerType = triggerType,
                    deviceId = devId,
                    deviceName = devName
                )
                val response = RetrofitClient.instance.analyzeUrl(request)

                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext

                    if (response.isSuccessful && response.body() != null) {
                        val scanResult = response.body()!!
                        handleScanResult(scanResult)
                    } else {
                        // If it's a UPI URL, we can still perform full local on-device VPA analysis
                        if (url.lowercase().startsWith("upi://")) {
                            val upiResult = com.cipherscan.android.util.UpiVpaValidator.analyze(url)
                            val fallbackResult = ScanResult(
                                originalUrl = url,
                                finalUrl = url,
                                isSafe = !upiResult.isSuspicious,
                                verdict = if (upiResult.isSuspicious) "suspicious" else "safe",
                                riskScore = if (upiResult.isSuspicious) 75 else 5,
                                threatCategory = if (upiResult.isSuspicious) "UPI Typosquatting / Fraud" else "UPI Payment",
                                reasons = if (upiResult.isSuspicious) listOf(upiResult.warning ?: "Suspicious VPA detected") else listOf("Verified UPI Payment Intent"),
                                triggerType = triggerType,
                                deviceId = devId,
                                deviceName = devName
                            )
                            handleScanResult(fallbackResult)
                            return@withContext
                        }

                        val errBody = response.errorBody()?.string()
                        Log.e(TAG, "Analysis failed [HTTP ${response.code()}]: $errBody")
                        progressBar?.visibility = View.GONE

                        AlertDialog.Builder(this@LinkInterceptorActivity)
                            .setTitle("Scan Failed (${response.code()})")
                            .setMessage(errBody ?: "Server returned error")
                            .setPositiveButton("Open URL Anyway") { _, _ -> fallbackOpenUrl(url) }
                            .setNegativeButton("Dismiss") { _, _ -> finish() }
                            .setCancelable(false)
                            .show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Connection error: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext

                    // Local UPI fallback on connection failure
                    if (url.lowercase().startsWith("upi://")) {
                        val upiResult = com.cipherscan.android.util.UpiVpaValidator.analyze(url)
                        val fallbackResult = ScanResult(
                            originalUrl = url,
                            finalUrl = url,
                            isSafe = !upiResult.isSuspicious,
                            verdict = if (upiResult.isSuspicious) "suspicious" else "safe",
                            riskScore = if (upiResult.isSuspicious) 75 else 5,
                            threatCategory = if (upiResult.isSuspicious) "UPI Typosquatting / Fraud" else "UPI Payment",
                            reasons = if (upiResult.isSuspicious) listOf(upiResult.warning ?: "Suspicious VPA detected") else listOf("Verified UPI Payment Intent"),
                            triggerType = intent?.getStringExtra("triggerType") ?: "link"
                        )
                        handleScanResult(fallbackResult)
                        return@withContext
                    }

                    progressBar?.visibility = View.GONE

                    AlertDialog.Builder(this@LinkInterceptorActivity)
                        .setTitle("Connection Error")
                        .setMessage(e.localizedMessage ?: "Unable to contact scanning server.")
                        .setPositiveButton("Open URL Anyway") { _, _ -> fallbackOpenUrl(url) }
                        .setNegativeButton("Dismiss") { _, _ -> finish() }
                        .setCancelable(false)
                        .show()
                }
            }
        }
    }

    private fun handleScanResult(scanResult: ScanResult) {
        val isSafe = scanResult.isSafe && scanResult.verdict == "safe"
        val destinationUrl = scanResult.finalUrl ?: scanResult.originalUrl ?: ""

        if (isSafe && destinationUrl.isNotBlank()) {
            // For SAFE links: show Verified Safe with green symbol and auto-proceed without popup
            showVerifiedAndProceed(destinationUrl)
        } else {
            // For SUSPICIOUS or MALICIOUS links: show the security bottom sheet warning popup
            progressBar?.visibility = View.GONE
            cardContainer?.visibility = View.GONE
            val bottomSheet = SecurityOverlayBottomSheet.newInstance(scanResult)
            bottomSheet.show(supportFragmentManager, "SecurityOverlayBottomSheet")
        }
    }

    private fun showVerifiedAndProceed(destinationUrl: String) {
        if (isProceeding) return
        isProceeding = true

        progressBar?.visibility = View.GONE
        ivVerifiedBadge?.apply {
            visibility = View.VISIBLE
            alpha = 0f
            scaleX = 0.5f
            scaleY = 0.5f
            animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(220)
                .start()
        }

        tvStatus?.apply {
            text = "Verified Safe ✓"
            setTextColor(ContextCompat.getColor(this@LinkInterceptorActivity, R.color.safe_green))
        }

        tvSubStatus?.apply {
            visibility = View.VISIBLE
            text = if (destinationUrl.lowercase().startsWith("upi://")) {
                "Opening payment app…"
            } else {
                "Proceeding to website…"
            }
        }

        // Tactile confirmation
        window.decorView.performHapticFeedback(HapticFeedbackConstants.CONFIRM)

        // Instant proceed on user tap
        cardContainer?.setOnClickListener {
            proceedNow(destinationUrl)
        }
        findViewById<View>(R.id.rootLayout)?.setOnClickListener {
            proceedNow(destinationUrl)
        }

        lifecycleScope.launch {
            delay(650)
            proceedNow(destinationUrl)
        }
    }

    private fun proceedNow(destinationUrl: String) {
        if (isFinishing || isDestroyed) return
        try {
            BrowserLauncher.openUrl(this@LinkInterceptorActivity, destinationUrl)
        } catch (_: Exception) {
            Toast.makeText(this@LinkInterceptorActivity, "Unable to open browser", Toast.LENGTH_SHORT).show()
        } finally {
            finish()
        }
    }

    private fun fallbackOpenUrl(url: String) {
        try {
            BrowserLauncher.openUrl(this, url)
        } catch (_: Exception) {
            Toast.makeText(this, "Unable to open browser", Toast.LENGTH_SHORT).show()
        } finally {
            finish()
        }
    }
}
