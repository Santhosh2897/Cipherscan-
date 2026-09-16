package com.cipherscan.android.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.cipherscan.android.R
import com.cipherscan.android.activity.LinkInterceptorActivity

object NotificationHelper {
    const val CHANNEL_ID = "cipherscan_threat_alerts"
    private const val CHANNEL_NAME = "CipherScan Threat Alerts"
    private const val CHANNEL_DESC = "Real-time alerts when malicious SMS links or phishing threats are detected."

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = CHANNEL_DESC
                enableVibration(true)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showPhishingAlert(
        context: Context,
        sender: String,
        url: String,
        threatCategory: String?,
        riskScore: Int
    ) {
        createNotificationChannel(context)

        val intent = Intent(context, LinkInterceptorActivity::class.java).apply {
            data = Uri.parse(url)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            url.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val categoryText = if (!threatCategory.isNullOrBlank()) " ($threatCategory)" else ""
        val contentText = "Dangerous link from $sender: $url$categoryText. Risk Score: $riskScore/100. Tap to inspect."

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⚠️ Phishing Alert: Dangerous SMS Link")
            .setContentText(contentText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(contentText))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_ALARM)

        try {
            val notificationManager = NotificationManagerCompat.from(context)
            notificationManager.notify(url.hashCode(), builder.build())
        } catch (e: SecurityException) {
            // Notifications permission not granted on Android 13+
        }
    }
}
