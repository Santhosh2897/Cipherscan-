import { Router } from "express";
import { db } from "@workspace/db";
import { scansTable } from "@workspace/db";
import { AnalyzeUrlBody } from "@workspace/api-zod";
import { analyzeSandbox } from "../lib/sandboxService";
import { analyzeReputation } from "../lib/reputationService";
import { assertUrlIsSafe, UnsafeUrlError } from "../lib/urlSafety";

const router = Router();

router.post("/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { targetUrl, triggerType } = parsed.data;

  // SSRF guard: reject URLs pointing at localhost, private IP ranges, or
  // cloud metadata endpoints before Playwright ever touches them.
  try {
    await assertUrlIsSafe(targetUrl);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      res.status(400).json({ error: "URL not allowed" });
      return;
    }
    throw err;
  }

  // Determine server base URL for preview image URLs
  const serverBaseUrl = process.env["SERVER_BASE_URL"] ??
    `${req.protocol}://${req.get("host")}`;

  // Run sandbox analysis and reputation checks concurrently
  const [sandboxSettled, reputationSettled] = await Promise.allSettled([
    analyzeSandbox(targetUrl, serverBaseUrl),
    Promise.resolve(null), // reputation needs finalUrl from sandbox
  ]);

  const sandbox = sandboxSettled.status === "fulfilled"
    ? sandboxSettled.value
    : { finalUrl: targetUrl, redirectChain: [targetUrl], previewImageUrl: null };

  // Now run reputation with resolved finalUrl
  const reputation = await analyzeReputation(targetUrl, sandbox.finalUrl, sandbox.redirectChain).catch(() => ({
    riskScore: 0,
    verdict: "safe" as const,
    threatCategory: null,
    reasons: ["Analysis service temporarily unavailable"],
    virusTotalScore: null,
    googleSafeBrowsing: false,
  }));

  // Persist scan to DB
  const [inserted] = await db
    .insert(scansTable)
    .values({
      originalUrl: targetUrl,
      finalUrl: sandbox.finalUrl,
      isSafe: reputation.verdict === "safe",
      riskScore: reputation.riskScore,
      verdict: reputation.verdict,
      threatCategory: reputation.threatCategory,
      redirectChain: JSON.stringify(sandbox.redirectChain),
      reasons: JSON.stringify(reputation.reasons),
      previewImageUrl: sandbox.previewImageUrl,
      triggerType: triggerType,
      virusTotalScore: reputation.virusTotalScore,
      googleSafeBrowsing: reputation.googleSafeBrowsing,
    })
    .returning();

  res.json({
    id: inserted.id,
    originalUrl: inserted.originalUrl,
    finalUrl: inserted.finalUrl,
    isSafe: inserted.isSafe,
    riskScore: inserted.riskScore,
    verdict: inserted.verdict,
    threatCategory: inserted.threatCategory,
    redirectChain: JSON.parse(inserted.redirectChain),
    reasons: JSON.parse(inserted.reasons),
    previewImageUrl: inserted.previewImageUrl,
    triggerType: inserted.triggerType,
    virusTotalScore: inserted.virusTotalScore,
    googleSafeBrowsing: inserted.googleSafeBrowsing,
    createdAt: inserted.createdAt.toISOString(),
  });
});

export default router;
