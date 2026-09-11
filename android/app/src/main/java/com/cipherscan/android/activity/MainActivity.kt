package com.cipherscan.android.activity

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import com.cipherscan.android.R
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.ui.BrowserLauncher

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize RetrofitClient with the device ID so every outgoing request
        // carries X-Device-Id and the backend can do per-user scan isolation.
        RetrofitClient.init(this)

        val cardWebDashboard = findViewById<CardView>(R.id.cardOpenWebDashboard)
        val btnLaunchDashboard = findViewById<Button>(R.id.btnLaunchDashboard)
        val etTargetUrl = findViewById<EditText>(R.id.etTargetUrl)
        val btnScanNow = findViewById<Button>(R.id.btnScanNow)
        val btnTestSafe = findViewById<Button>(R.id.btnTestSafe)
        val btnTestMalware = findViewById<Button>(R.id.btnTestMalware)
        val btnScanQr = findViewById<Button?>(R.id.btnScanQr)

        // Open live web dashboard
        val openDashboardAction = {
            BrowserLauncher.openUrl(this, "https://cipherscan-dashboard.vercel.app")
        }
        cardWebDashboard?.setOnClickListener { openDashboardAction() }
        btnLaunchDashboard?.setOnClickListener { openDashboardAction() }

        // Manual scan button
        btnScanNow?.setOnClickListener {
            val inputUrl = etTargetUrl?.text?.toString()?.trim()
            if (inputUrl.isNullOrBlank()) {
                Toast.makeText(this, "Please enter a URL or UPI payment string", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            startScan(inputUrl)
        }

        // Quick test buttons
        btnTestSafe?.setOnClickListener {
            startScan("https://example.com")
        }

        btnTestMalware?.setOnClickListener {
            startScan("https://testsafebrowsing.appspot.com/s/malware.html")
        }

        // QR Code scan button — hide if device has no camera
        if (btnScanQr != null) {
            val hasCamera = packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
            if (hasCamera) {
                btnScanQr.visibility = View.VISIBLE
                btnScanQr.setOnClickListener {
                    startActivity(Intent(this, QrScannerActivity::class.java))
                }
            } else {
                btnScanQr.visibility = View.GONE
            }
        }
    }

    private fun startScan(url: String) {
        val scanIntent = Intent(this, LinkInterceptorActivity::class.java).apply {
            data = Uri.parse(url)
        }
        startActivity(scanIntent)
    }
}