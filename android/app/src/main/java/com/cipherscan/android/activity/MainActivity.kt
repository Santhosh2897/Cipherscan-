package com.cipherscan.android.activity

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.cipherscan.android.databinding.ActivityLinkInterceptorBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLinkInterceptorBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLinkInterceptorBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Launch a sample test scan when MainActivity is opened
        val sampleIntent = Intent(this, LinkInterceptorActivity::class.java).apply {
            data = Uri.parse("https://testsafebrowsing.appspot.com/s/malware.html")
        }
        startActivity(sampleIntent)
        finish()
    }
}