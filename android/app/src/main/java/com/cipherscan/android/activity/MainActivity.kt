package com.cipherscan.android.activity

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.cipherscan.android.R
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.ui.BrowserLauncher
import com.cipherscan.android.util.ClipboardMonitor
import com.cipherscan.android.util.DeviceUtils
import com.cipherscan.android.util.NotificationHelper

class MainActivity : AppCompatActivity() {

    companion object {
        private const val PERMISSION_REQ_SMS = 101
    }

    private var tvSmsStatusBadge: TextView? = null
    private var btnToggleSmsProtection: Button? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize RetrofitClient with the device ID so every outgoing request
        // carries X-Device-Id and the backend can do per-user scan isolation.
        RetrofitClient.init(this)

        // Ensure notification channel is initialized for threat alerts
        NotificationHelper.createNotificationChannel(this)

        // Start background clipboard URL protection monitor
        ClipboardMonitor.start(this)

        val cardWebDashboard = findViewById<CardView>(R.id.cardOpenWebDashboard)
        val btnLaunchDashboard = findViewById<Button>(R.id.btnLaunchDashboard)
        val tvDisplayDeviceId = findViewById<TextView>(R.id.tvDisplayDeviceId)
        val btnCopyDeviceId = findViewById<Button>(R.id.btnCopyDeviceId)
        val etTargetUrl = findViewById<EditText>(R.id.etTargetUrl)
        val btnScanNow = findViewById<Button>(R.id.btnScanNow)
        val btnTestSafe = findViewById<Button>(R.id.btnTestSafe)
        val btnTestMalware = findViewById<Button>(R.id.btnTestMalware)
        val btnScanQr = findViewById<Button?>(R.id.btnScanQr)

        tvSmsStatusBadge = findViewById(R.id.tvSmsStatusBadge)
        btnToggleSmsProtection = findViewById(R.id.btnToggleSmsProtection)

        val currentDeviceId = DeviceUtils.getDeviceId(this)
        tvDisplayDeviceId?.text = currentDeviceId

        btnCopyDeviceId?.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("CipherScan Device ID", currentDeviceId)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "Device ID copied to clipboard!", Toast.LENGTH_SHORT).show()
        }

        // Open live web dashboard with this device's ID for seamless auto-login
        val openDashboardAction = {
            val dashboardBase = "https://cipherscan-dashboard.vercel.app"
            val targetUrl = "$dashboardBase/?deviceId=$currentDeviceId"
            BrowserLauncher.openUrl(this, targetUrl)
        }
        cardWebDashboard?.setOnClickListener { openDashboardAction() }
        btnLaunchDashboard?.setOnClickListener { openDashboardAction() }

        // SMS Phishing Protection setup
        btnToggleSmsProtection?.setOnClickListener {
            requestSmsPermissions()
        }
        updateSmsProtectionUi()

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

    override fun onResume() {
        super.onResume()
        updateSmsProtectionUi()

        // Auto-check clipboard on return: inspects links copied from WhatsApp, Telegram, etc.
        val etTargetUrl = findViewById<EditText>(R.id.etTargetUrl)
        ClipboardMonitor.checkClipboardNow(this) { foundUrl ->
            runOnUiThread {
                if (etTargetUrl?.text.isNullOrBlank()) {
                    etTargetUrl?.setText(foundUrl)
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        ClipboardMonitor.stop(this)
    }

    private fun hasSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun updateSmsProtectionUi() {
        if (hasSmsPermission()) {
            tvSmsStatusBadge?.text = "ACTIVE"
            tvSmsStatusBadge?.setBackgroundColor(Color.parseColor("#10B981"))
            btnToggleSmsProtection?.text = "✓ SMS Shield Active"
            btnToggleSmsProtection?.isEnabled = false
            btnToggleSmsProtection?.setBackgroundColor(Color.parseColor("#0F2F24"))
        } else {
            tvSmsStatusBadge?.text = "DISABLED"
            tvSmsStatusBadge?.setBackgroundColor(Color.parseColor("#64748B"))
            btnToggleSmsProtection?.text = "Enable SMS Protection"
            btnToggleSmsProtection?.isEnabled = true
            btnToggleSmsProtection?.setBackgroundColor(Color.parseColor("#0284C7"))
        }
    }

    private fun requestSmsPermissions() {
        val permissions = mutableListOf(Manifest.permission.RECEIVE_SMS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        ActivityCompat.requestPermissions(
            this,
            permissions.toTypedArray(),
            PERMISSION_REQ_SMS
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQ_SMS) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "SMS Phishing Protection Activated!", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "SMS permission is required to detect phishing links in incoming text messages.", Toast.LENGTH_LONG).show()
            }
            updateSmsProtectionUi()
        }
    }

    private fun startScan(url: String) {
        val scanIntent = Intent(this, LinkInterceptorActivity::class.java).apply {
            data = Uri.parse(url)
        }
        startActivity(scanIntent)
    }
}