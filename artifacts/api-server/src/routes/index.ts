import { Router } from "express";
import healthRouter from "./health.js";
import analyzeRouter from "./analyze.js";
import scansRouter from "./scans.js";
import statsRouter from "./stats.js";
import communityRouter from "./community.js";

const router = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(statsRouter);      // must come before scansRouter
router.use(communityRouter);  // community + user intelligence endpoints
router.use(scansRouter);      // has the catch-all /:id — mount last

export default router;