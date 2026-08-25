package com.cipherscan.android.activity

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.Toast
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

        analyzeAndDisplay(targetUrl)
    }

    private fun analyzeAndDisplay(url: String) {
        progressBar?.visibility = View.VISIBLE

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val request = AnalyzeRequest(url = url)
                val response = RetrofitClient.instance.analyzeUrl(request)

                withContext(Dispatchers.Main) {
                    progressBar?.visibility = View.GONE
                    if (response.isSuccessful && response.body() != null) {
                        val scanResult = response.body()!!
                        val bottomSheet = SecurityOverlayBottomSheet.newInstance(scanResult)
                        bottomSheet.show(supportFragmentManager, "SecurityOverlayBottomSheet")
                    } else {
                        Log.e(TAG, "Analysis failed with code: ${response.code()}")
                        fallbackOpenUrl(url)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error connecting to backend: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    progressBar?.visibility = View.GONE
                    Toast.makeText(
                        this@LinkInterceptorActivity,
                        "CipherScan service unreachable, opening link...",
                        Toast.LENGTH_SHORT
                    ).show()
                    fallbackOpenUrl(url)
                }
            }
        }
    }

    private fun fallbackOpenUrl(url: String) {
        try {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(browserIntent)
        } catch (_: Exception) {
            Toast.makeText(this, "Unable to open browser", Toast.LENGTH_SHORT).show()
        } finally {
            finish()
        }
    }
}