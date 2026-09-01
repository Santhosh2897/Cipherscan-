import { Router } from "express";
import { db } from "@workspace/db";
import { scansTable } from "@workspace/db";
import { and, eq, gte, desc } from "drizzle-orm";
import { AnalyzeUrlBody } from "@workspace/api-zod";
import { analyzeSandbox } from "../lib/sandboxService";
import { analyzeReputation } from "../lib/reputationService";
import { assertUrlIsSafe, UnsafeUrlError } from "../lib/urlSafety";

const router = Router();

function safeParseJsonArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

router.post("/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { targetUrl, triggerType } = parsed.data;
  const rawBody = req.body as { deviceId?: string; deviceName?: string };
  const deviceId = typeof rawBody?.deviceId === 'string' && rawBody.deviceId.trim() !== '' ? rawBody.deviceId.trim() : null;
  const deviceName = typeof rawBody?.deviceName === 'string' && rawBody.deviceName.trim() !== '' ? rawBody.deviceName.trim() : null;

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

  // Check if link was recently scanned (cached within 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingScans = await db
    .select()
    .from(scansTable)
    .where(and(eq(scansTable.originalUrl, targetUrl), gte(scansTable.createdAt, twentyFourHoursAgo)))
    .orderBy(desc(scansTable.createdAt))
    .limit(1);

  if (existingScans.length > 0) {
    const cached = existingScans[0];
    res.json({
      id: cached.id,
      originalUrl: cached.originalUrl,
      finalUrl: cached.finalUrl,
      isSafe: cached.isSafe,
      riskScore: cached.riskScore,
      verdict: cached.verdict,
      threatCategory: cached.threatCategory,
      redirectChain: safeParseJsonArray(cached.redirectChain),
      reasons: safeParseJsonArray(cached.reasons),
      previewImageUrl: cached.previewImageUrl,
      triggerType: cached.triggerType,
      deviceId: cached.deviceId,
      deviceName: cached.deviceName,
      virusTotalScore: cached.virusTotalScore,
      googleSafeBrowsing: cached.googleSafeBrowsing,
      createdAt: cached.createdAt.toISOString(),
    });
    return;
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
      deviceId: deviceId,
      deviceName: deviceName,
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
    deviceId: inserted.deviceId,
    deviceName: inserted.deviceName,
    virusTotalScore: inserted.virusTotalScore,
    googleSafeBrowsing: inserted.googleSafeBrowsing,
    createdAt: inserted.createdAt.toISOString(),
  });
});

export default router;
