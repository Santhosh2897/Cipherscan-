import { Router } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import scansRouter from "./scans";
import statsRouter from "./stats";

const router = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(scansRouter);
router.use(statsRouter);

export default router;
