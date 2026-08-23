package com.cipherscan.android.activity

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.cipherscan.android.R
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.model.ScanResult
import com.cipherscan.android.ui.SecurityOverlayBottomSheet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * CipherScan — LinkInterceptorActivity
 *
 * A transparent, non-blocking activity that intercepts http, https, and upi://
 * intents fired by the OS (camera scans, tapped links, QR payment codes).
 *
 * Workflow:
 *  1. Capture the incoming URI from the intent.
 *  2. Show a micro-loading indicator ("Verifying link safety…").
 *  3. POST to /api/analyze on the CipherScan backend via Retrofit.
 *  4a. isSafe == true  → resolve target app intent and forward seamlessly.
 *  4b. isSafe == false → show SecurityOverlayBottomSheet over the current screen.
 */
class LinkInterceptorActivity : AppCompatActivity() {

    private val apiService by lazy { RetrofitClient.instance }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_link_interceptor)

        val targetUri = intent.data ?: run {
            finish()
            return
        }

        showVerifyingIndicator()
        analyzeLink(targetUri)
    }

    // ─────────────────────────────────────────────────────────
    // UI helpers
    // ─────────────────────────────────────────────────────────

    private fun showVerifyingIndicator() {
        findViewById<View>(R.id.progressBar).visibility = View.VISIBLE
        findViewById<TextView>(R.id.tvStatus).text = "Verifying link safety…"
    }

    private fun hideVerifyingIndicator() {
        findViewById<View>(R.id.progressBar).visibility = View.GONE
    }

    // ─────────────────────────────────────────────────────────
    // Analysis
    // ─────────────────────────────────────────────────────────

    private fun analyzeLink(uri: Uri) {
        val triggerType = when {
            uri.scheme == "upi"                    -> "camera"
            intent.hasExtra("trigger_camera")      -> "camera"
            else                                   -> "link"
        }

        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    apiService.analyzeUrl(
                        AnalyzeRequest(
                            targetUrl   = uri.toString(),
                            triggerType = triggerType,
                        )
                    )
                }
                hideVerifyingIndicator()
                handleResult(uri, result)
            } catch (e: Exception) {
                // Network failure → fail open, forward to target app
                hideVerifyingIndicator()
                forwardToTargetApp(uri)
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // Routing
    // ─────────────────────────────────────────────────────────

    private fun handleResult(originalUri: Uri, result: ScanResult) {
        if (result.isSafe) forwardToTargetApp(originalUri)
        else               showSecurityOverlay(result)
    }

    /** Resolves the correct target app and launches it, avoiding redirect loops. */
    private fun forwardToTargetApp(uri: Uri) {
        val targetIntent = buildTargetIntent(uri) ?: Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.android.chrome")
        }

        try {
            startActivity(targetIntent)
        } catch (e: Exception) {
            startActivity(Intent.createChooser(Intent(Intent.ACTION_VIEW, uri), "Open with"))
        }

        finish()
    }

    /**
     * Builds an explicit intent for the target application:
     *  - upi://      → GPay → PhonePe → Paytm → system default
     *  - http/https  → Google Chrome
     */
    private fun buildTargetIntent(uri: Uri): Intent? = when (uri.scheme?.lowercase()) {
        "upi"            -> resolveUpiApp(uri)
        "http", "https"  -> Intent(Intent.ACTION_VIEW, uri).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
            setPackage("com.android.chrome")
        }
        else             -> null
    }

    private fun resolveUpiApp(uri: Uri): Intent {
        val upiPackages = listOf(
            "com.google.android.apps.nbu.paisa.user",   // GPay
            "com.phonepe.app",                           // PhonePe
            "net.one97.paytm",                           // Paytm
        )
        for (pkg in upiPackages) {
            if (isPackageInstalled(pkg)) return Intent(Intent.ACTION_VIEW, uri).apply { setPackage(pkg) }
        }
        return Intent(Intent.ACTION_VIEW, uri)
    }

    private fun isPackageInstalled(packageName: String): Boolean = try {
        packageManager.getPackageInfo(packageName, 0)
        true
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    // ─────────────────────────────────────────────────────────
    // Security Overlay
    // ─────────────────────────────────────────────────────────

    private fun showSecurityOverlay(result: ScanResult) {
        val sheet = SecurityOverlayBottomSheet.newInstance(result)
        sheet.show(supportFragmentManager, SecurityOverlayBottomSheet.TAG)
        // DO NOT finish() — the bottom sheet lives on top of this activity
    }
}
