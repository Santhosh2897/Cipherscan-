package com.cipherscan.android

import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.model.ScanResult
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for CipherScan Android models and serialization.
 */
class ExampleUnitTest {

    private val gson = Gson()

    @Test
    fun addition_isCorrect() {
        assertEquals(4, 2 + 2)
    }

    @Test
    fun analyzeRequest_defaultTriggerTypeIsLink() {
        val req = AnalyzeRequest(targetUrl = "https://malware-test.com")
        assertEquals("https://malware-test.com", req.targetUrl)
        assertEquals("link", req.triggerType)
        assertNull(req.deviceId)
        assertNull(req.deviceName)
    }

    @Test
    fun scanResult_jsonDeserialization() {
        val json = """
            {
                "id": "scan-123",
                "originalUrl": "https://example.com",
                "finalUrl": "https://example.com/dest",
                "isSafe": false,
                "riskScore": 85,
                "verdict": "malicious",
                "reasons": ["Phishing domain pattern", "Suspicious TLD"],
                "redirectChain": ["https://example.com", "https://example.com/dest"],
                "triggerType": "link"
            }
        """.trimIndent()

        val result = gson.fromJson(json, ScanResult::class.java)
        assertEquals("scan-123", result.id)
        assertEquals("https://example.com", result.originalUrl)
        assertEquals("https://example.com/dest", result.finalUrl)
        assertFalse(result.isSafe)
        assertEquals(85, result.riskScore)
        assertEquals("malicious", result.verdict)
        assertEquals(2, result.reasons?.size)
        assertEquals(2, result.redirectChain?.size)
    }

    @Test
    fun scanResult_defaults() {
        val defaultResult = ScanResult()
        assertTrue(defaultResult.isSafe)
        assertEquals(0, defaultResult.riskScore)
        assertEquals("safe", defaultResult.verdict)
        assertNull(defaultResult.previewImageUrl)
    }
}
