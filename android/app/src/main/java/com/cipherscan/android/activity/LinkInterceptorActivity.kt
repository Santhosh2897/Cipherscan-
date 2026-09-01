package com.cipherscan.android.activity

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.cipherscan.android.R
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.ui.SecurityOverlayBottomSheet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LinkInterceptorActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "LinkInterceptor"
    }

    private var progressBar: ProgressBar? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_link_interceptor)

        progressBar = findViewById(R.id.progressBar)

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

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val devId = com.cipherscan.android.util.DeviceUtils.getDeviceId(this@LinkInterceptorActivity)
                val devName = com.cipherscan.android.util.DeviceUtils.getDeviceName()
                val request = AnalyzeRequest(
                    targetUrl = url,
                    triggerType = "link",
                    deviceId = devId,
                    deviceName = devName
                )
                val response = RetrofitClient.instance.analyzeUrl(request)

                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    progressBar?.visibility = View.GONE

                    if (response.isSuccessful && response.body() != null) {
                        val scanResult = response.body()!!
                        val bottomSheet = SecurityOverlayBottomSheet.newInstance(scanResult)
                        bottomSheet.show(supportFragmentManager, "SecurityOverlayBottomSheet")
                    } else {
                        val errBody = response.errorBody()?.string()
                        Log.e(TAG, "Analysis failed [HTTP ${response.code()}]: $errBody")

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

    private fun fallbackOpenUrl(url: String) {
        try {
            com.cipherscan.android.ui.BrowserLauncher.openUrl(this, url)
        } catch (_: Exception) {
            Toast.makeText(this, "Unable to open browser", Toast.LENGTH_SHORT).show()
        } finally {
            finish()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        super.onBackPressed()
        finish()
    }
}
