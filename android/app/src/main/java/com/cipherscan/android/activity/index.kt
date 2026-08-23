/**
 * CipherScan — activity package index
 *
 * Android Activities: entry points for OS intents and the main dashboard.
 *
 * Files in this package:
 *   LinkInterceptorActivity.kt — Transparent activity that intercepts http/https/upi://
 *                                intents, calls POST /api/analyze, then either forwards
 *                                the intent to the target app (safe) or shows the
 *                                SecurityOverlayBottomSheet (threat detected).
 */
package com.cipherscan.android.activity
