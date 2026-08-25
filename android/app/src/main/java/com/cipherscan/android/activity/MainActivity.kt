package com.cipherscan.android.activity

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.cipherscan.android.R

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_link_interceptor)

        val titleView = findViewById<TextView?>(R.id.titleText)
        val testButton = findViewById<Button?>(R.id.testScanButton)

        titleView?.text = "CipherScan Active Protection is Enabled"

        testButton?.setOnClickListener {
            val sampleIntent = Intent(this, LinkInterceptorActivity::class.java).apply {
                data = Uri.parse("https://testsafebrowsing.appspot.com/s/malware.html")
            }
            startActivity(sampleIntent)
        }
    }
}