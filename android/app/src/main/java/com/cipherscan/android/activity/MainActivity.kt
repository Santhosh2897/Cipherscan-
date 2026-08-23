package com.cipherscan.android.activity

import android.os.Bundle
import android.widget.TextView
import android.widget.LinearLayout
import android.view.Gravity
import androidx.appcompat.app.AppCompatActivity
import com.cipherscan.android.BuildConfig

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }
        root.addView(TextView(this).apply {
            text = "CipherScan is active"
            textSize = 20f
            gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = "Backend: ${BuildConfig.CIPHERSCAN_SERVER_URL}"
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 0)
        })
        setContentView(root)
    }
}
