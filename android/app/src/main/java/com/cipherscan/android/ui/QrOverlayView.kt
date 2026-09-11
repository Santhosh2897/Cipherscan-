package com.cipherscan.android.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator

/**
 * QrOverlayView — Custom HUD viewfinder view that draws:
 *  1. A semi-transparent dark scrim over the camera preview
 *  2. A clear square viewfinder (the ONLY active scanning area)
 *  3. Animated cyan corner brackets
 *  4. An animated laser scanning beam sweeping inside the square portion
 *  5. Provides bounding box checking so ML Kit only triggers on QR codes inside the square
 */
class QrOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val scrimPaint = Paint().apply {
        color = Color.argb(150, 0, 0, 0)
    }

    private val clearPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
    }

    private val cornerPaint = Paint().apply {
        color = Color.parseColor("#00E5FF") // Cyan accent
        style = Paint.Style.STROKE
        strokeWidth = 8f
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
    }

    private val laserPaint = Paint().apply {
        color = Color.parseColor("#00E5FF")
        strokeWidth = 4f
        isAntiAlias = true
    }

    private val laserGlowPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.FILL
    }

    private val viewfinderRect = RectF()
    private val cornerLength = 64f

    private var laserProgress = 0f // 0f to 1f
    private var laserAnimator: ValueAnimator? = null
    private var isSuccessState = false

    init {
        startLaserAnimation()
    }

    private fun startLaserAnimation() {
        laserAnimator?.cancel()
        laserAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 2000L
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { anim ->
                laserProgress = anim.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (laserAnimator?.isRunning != true) {
            startLaserAnimation()
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        laserAnimator?.cancel()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        calculateViewfinderRect(w, h)
    }

    private fun calculateViewfinderRect(w: Int, h: Int) {
        if (w <= 0 || h <= 0) return
        val boxSize = minOf(w, h) * 0.68f
        val left = (w - boxSize) / 2f
        val top = (h - boxSize) / 2f
        viewfinderRect.set(left, top, left + boxSize, top + boxSize)
    }

    /**
     * Returns the exact bounding rectangle of the square viewfinder portion.
     */
    fun getViewfinderRect(): RectF {
        if (viewfinderRect.isEmpty) {
            val w = if (width > 0) width else resources.displayMetrics.widthPixels
            val h = if (height > 0) height else resources.displayMetrics.heightPixels
            calculateViewfinderRect(w, h)
        }
        return RectF(viewfinderRect)
    }

    /**
     * Checks if a barcode bounding box (in screen coordinates) is positioned
     * inside the square portion of the screen.
     *
     * Returns true ONLY if the barcode's center is within the square viewfinder,
     * or at least 50% of the barcode area overlaps with the viewfinder.
     */
    fun isInsideViewfinder(barcodeRect: RectF): Boolean {
        val rect = getViewfinderRect()
        if (rect.isEmpty) return true

        // Check if center point of the barcode is inside the square portion
        val cx = barcodeRect.centerX()
        val cy = barcodeRect.centerY()
        if (rect.contains(cx, cy)) {
            return true
        }

        // Check if substantial portion (>= 50%) overlaps
        val intersection = RectF()
        if (intersection.setIntersect(rect, barcodeRect)) {
            val barcodeArea = barcodeRect.width() * barcodeRect.height()
            val interArea = intersection.width() * intersection.height()
            if (barcodeArea > 0f && (interArea / barcodeArea) >= 0.5f) {
                return true
            }
        }

        return false
    }

    /**
     * Marks scan as successful — turns corner brackets and laser beam green (#10B981)
     */
    fun setScanSuccess(success: Boolean) {
        isSuccessState = success
        if (success) {
            cornerPaint.color = Color.parseColor("#10B981") // Emerald Green
            laserPaint.color = Color.parseColor("#10B981")
        } else {
            cornerPaint.color = Color.parseColor("#00E5FF") // Cyan
            laserPaint.color = Color.parseColor("#00E5FF")
        }
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        setLayerType(LAYER_TYPE_HARDWARE, null)

        if (viewfinderRect.isEmpty) {
            calculateViewfinderRect(width, height)
        }

        // 1. Draw dark scrim over entire screen
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), scrimPaint)

        // 2. Punch out the square viewfinder (clear the scrim in the scanning square)
        canvas.drawRect(viewfinderRect, clearPaint)

        // 3. Draw corner brackets around the square
        drawCornerBrackets(canvas)

        // 4. Draw animated laser line sweeping inside the square portion
        if (!isSuccessState) {
            drawLaserBeam(canvas)
        }
    }

    private fun drawCornerBrackets(canvas: Canvas) {
        val l = viewfinderRect.left
        val t = viewfinderRect.top
        val r = viewfinderRect.right
        val b = viewfinderRect.bottom
        val cl = cornerLength

        // Top-left
        canvas.drawLine(l, t + cl, l, t, cornerPaint)
        canvas.drawLine(l, t, l + cl, t, cornerPaint)

        // Top-right
        canvas.drawLine(r - cl, t, r, t, cornerPaint)
        canvas.drawLine(r, t, r, t + cl, cornerPaint)

        // Bottom-left
        canvas.drawLine(l, b - cl, l, b, cornerPaint)
        canvas.drawLine(l, b, l + cl, b, cornerPaint)

        // Bottom-right
        canvas.drawLine(r - cl, b, r, b, cornerPaint)
        canvas.drawLine(r, b - cl, r, b, cornerPaint)
    }

    private fun drawLaserBeam(canvas: Canvas) {
        val l = viewfinderRect.left + 8f
        val r = viewfinderRect.right - 8f
        val t = viewfinderRect.top + 8f
        val b = viewfinderRect.bottom - 8f
        val h = b - t
        if (h <= 0) return

        val laserY = t + h * laserProgress

        // Subtle gradient glow above laser line
        val glowHeight = 24f
        val glowColor = Color.argb(45, 0, 229, 255)
        laserGlowPaint.shader = LinearGradient(
            0f, laserY - glowHeight, 0f, laserY,
            Color.TRANSPARENT, glowColor,
            Shader.TileMode.CLAMP
        )
        canvas.drawRect(l, laserY - glowHeight, r, laserY, laserGlowPaint)

        // Laser line
        canvas.drawLine(l, laserY, r, laserY, laserPaint)
    }
}
