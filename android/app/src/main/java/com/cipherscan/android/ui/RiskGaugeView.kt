package com.cipherscan.android.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import android.view.animation.DecelerateInterpolator

/**
 * CipherScan — RiskGaugeView
 *
 * Custom View: a semicircular arc gauge visualising a 0–100 risk score.
 *
 * Color zones:
 *   0–30  → Safe    #10B981 (emerald)
 *   31–69 → Warning #F59E0B (amber)
 *   70–100→ Danger  #EF4444 (red)
 *
 * Usage (XML):
 *   <com.cipherscan.android.ui.RiskGaugeView
 *       android:id="@+id/riskGauge"
 *       android:layout_width="80dp"
 *       android:layout_height="80dp" />
 *
 * Usage (Kotlin):
 *   gauge.setRiskScore(88)   // animates the needle to 88
 */
class RiskGaugeView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {

    private var currentScore = 0
    private var animatedScore = 0f

    // ─── Paints ───────────────────────────────────────────────
    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style     = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        color     = Color.parseColor("#1F2937")
    }

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style     = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }

    private val centerTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface  = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        color     = Color.parseColor("#F9FAFB")
    }

    private val arcRect = RectF()

    // Sweep: 180° arc, starting from 180° (left) → 0° (right)
    private val START_ANGLE = 180f
    private val SWEEP_MAX   = 180f

    // ─── Public API ───────────────────────────────────────────

    fun setRiskScore(score: Int, animate: Boolean = true) {
        currentScore = score.coerceIn(0, 100)
        if (animate) {
            ValueAnimator.ofFloat(0f, currentScore.toFloat()).apply {
                duration    = 700
                interpolator = DecelerateInterpolator()
                addUpdateListener { animator ->
                    animatedScore = animator.animatedValue as Float
                    invalidate()
                }
                start()
            }
        } else {
            animatedScore = currentScore.toFloat()
            invalidate()
        }
    }

    // ─── Drawing ──────────────────────────────────────────────

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val strokeW = width * 0.12f
        val padding = strokeW / 2f + 4f
        arcRect.set(padding, padding, width - padding, height - padding)

        trackPaint.strokeWidth = strokeW
        fillPaint.strokeWidth  = strokeW
        fillPaint.color        = gaugeColor(animatedScore)

        // Background track (full arc)
        canvas.drawArc(arcRect, START_ANGLE, SWEEP_MAX, false, trackPaint)

        // Filled arc proportional to score
        val sweep = (animatedScore / 100f) * SWEEP_MAX
        if (sweep > 0f) canvas.drawArc(arcRect, START_ANGLE, sweep, false, fillPaint)

        // Score label (centre-bottom of arc)
        centerTextPaint.textSize = width * 0.26f
        canvas.drawText(
            animatedScore.toInt().toString(),
            width / 2f,
            height * 0.88f,
            centerTextPaint,
        )
    }

    // ─── Helpers ──────────────────────────────────────────────

    private fun gaugeColor(score: Float): Int = when {
        score >= 70 -> Color.parseColor("#EF4444")
        score >= 30 -> Color.parseColor("#F59E0B")
        else        -> Color.parseColor("#10B981")
    }
}
