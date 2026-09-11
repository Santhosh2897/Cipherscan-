package com.cipherscan.android.activity

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.widget.ImageButton
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.cipherscan.android.R
import com.cipherscan.android.ui.QrOverlayView
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * QrScannerActivity — Camera-based QR code scanner activity.
 *
 * Scans QR codes ONLY within the square portion (viewfinder reticle) of the screen.
 * Barcodes outside the square frame are completely ignored.
 * Once a valid URL or UPI QR code is aligned inside the square, it triggers
 * haptic feedback, flashes the HUD green, and routes to LinkInterceptorActivity
 * with triggerType="camera".
 */
class QrScannerActivity : AppCompatActivity() {

    private lateinit var cameraExecutor: ExecutorService
    private var qrDetected = false

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startCamera()
        } else {
            Toast.makeText(this, "Camera permission is required to scan QR codes", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_qr_scanner)

        cameraExecutor = Executors.newSingleThreadExecutor()

        // Close button (X in top right)
        findViewById<ImageButton>(R.id.btnClose)?.setOnClickListener {
            finish()
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }

        // Back press: close scanner
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                finish()
            }
        })
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            bindCameraUseCases(cameraProvider)
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCameraUseCases(cameraProvider: ProcessCameraProvider) {
        val previewView = findViewById<PreviewView>(R.id.viewFinder)
        val qrOverlay = findViewById<QrOverlayView>(R.id.qrOverlay)

        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        val imageAnalyzer = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { analysis ->
                analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                    if (qrDetected) {
                        imageProxy.close()
                        return@setAnalyzer
                    }

                    val mediaImage = imageProxy.image
                    if (mediaImage != null) {
                        val rotation = imageProxy.imageInfo.rotationDegrees
                        val inputImage = InputImage.fromMediaImage(mediaImage, rotation)

                        // Calculate coordinate mapping from InputImage to PreviewView screen coordinates
                        val imgW = if (rotation == 90 || rotation == 270) imageProxy.height.toFloat() else imageProxy.width.toFloat()
                        val imgH = if (rotation == 90 || rotation == 270) imageProxy.width.toFloat() else imageProxy.height.toFloat()

                        val viewW = if (previewView.width > 0) previewView.width.toFloat() else resources.displayMetrics.widthPixels.toFloat()
                        val viewH = if (previewView.height > 0) previewView.height.toFloat() else resources.displayMetrics.heightPixels.toFloat()

                        val scale = maxOf(viewW / imgW, viewH / imgH)
                        val scaledW = imgW * scale
                        val scaledH = imgH * scale
                        val dx = (viewW - scaledW) / 2f
                        val dy = (viewH - scaledH) / 2f

                        val scanner = BarcodeScanning.getClient()
                        scanner.process(inputImage)
                            .addOnSuccessListener { barcodes ->
                                if (qrDetected) return@addOnSuccessListener

                                for (barcode in barcodes) {
                                    val rawValue = barcode.rawValue ?: continue
                                    if (!isValidUrl(rawValue) && !isUpiString(rawValue)) continue

                                    val bbox = barcode.boundingBox ?: continue

                                    // Transform barcode bounding box to screen coordinates
                                    val barcodeScreenRect = RectF(
                                        bbox.left * scale + dx,
                                        bbox.top * scale + dy,
                                        bbox.right * scale + dx,
                                        bbox.bottom * scale + dy
                                    )

                                    // CRITICAL: Only scan if barcode is positioned inside the square portion of the screen
                                    if (!qrOverlay.isInsideViewfinder(barcodeScreenRect)) {
                                        // Barcode is outside the square viewfinder reticle — ignore it!
                                        continue
                                    }

                                    qrDetected = true
                                    runOnUiThread {
                                        qrOverlay.setScanSuccess(true)
                                        previewView.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                                        handleQrResult(rawValue)
                                    }
                                    break
                                }
                            }
                            .addOnCompleteListener {
                                imageProxy.close()
                            }
                    } else {
                        imageProxy.close()
                    }
                }
            }

        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                this,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                imageAnalyzer
            )
        } catch (exc: Exception) {
            Toast.makeText(this, "Failed to start camera: ${exc.message}", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun isValidUrl(text: String): Boolean {
        val lower = text.lowercase()
        return lower.startsWith("http://") || lower.startsWith("https://")
    }

    private fun isUpiString(text: String): Boolean {
        return text.lowercase().startsWith("upi://")
    }

    private fun handleQrResult(url: String) {
        Toast.makeText(this, "QR Code detected in viewfinder — Analyzing...", Toast.LENGTH_SHORT).show()

        // Launch LinkInterceptorActivity with camera trigger type
        val intent = Intent(this, LinkInterceptorActivity::class.java).apply {
            data = Uri.parse(url)
            putExtra("triggerType", "camera")
        }
        startActivity(intent)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
