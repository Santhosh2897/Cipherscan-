import { Router } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import scansRouter from "./scans";
import statsRouter from "./stats";

const router = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(statsRouter);   // must come before scansRouter
router.use(scansRouter);   // has the catch-all /:id — mount last

export default router;