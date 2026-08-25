package com.cipherscan.android.activity

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.ui.SecurityOverlayBottomSheet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LinkInterceptorActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val targetUrl = intent?.dataString
        if (targetUrl.isNullOrBlank()) {
            Toast.makeText(this, "No URL provided", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        analyzeLink(targetUrl)
    }

    private fun analyzeLink(url: String) {
        lifecycleScope.launch {
            try {
                val scanResult = withContext(Dispatchers.IO) {
                    RetrofitClient.apiService.analyzeUrl(
                        AnalyzeRequest(
                            url = url,
                            targetUrl = url,
                            triggerType = "CLICK"
                        )
                    )
                }

                val bottomSheet = SecurityOverlayBottomSheet.newInstance(scanResult)
                bottomSheet.show(supportFragmentManager, SecurityOverlayBottomSheet.TAG)
            } catch (e: Exception) {
                showBackendTimeoutDialog(url, e.localizedMessage ?: "Network connection error")
            }
        }
    }

    private fun showBackendTimeoutDialog(url: String, reason: String) {
        AlertDialog.Builder(this)
            .setTitle("Scan Timeout / Service Unavailable")
            .setMessage("CipherScan could not verify this link in real time ($reason).\n\nDo you still want to proceed to open the URL?")
            .setPositiveButton("Open Anyway") { _, _ ->
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(browserIntent)
                finish()
            }
            .setNegativeButton("Cancel") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }
}