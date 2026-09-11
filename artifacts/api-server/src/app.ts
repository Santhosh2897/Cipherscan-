import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";
import { requireApiKey } from "./middlewares/apiKey";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigin = process.env["ALLOWED_ORIGIN"];
app.use(
  cors({
    origin: (origin, callback) => {
      // Mobile clients, curl, server-to-server have no origin header
      if (!origin) return callback(null, true);
      // Explicit allowed origin
      if (allowedOrigin && (allowedOrigin === "*" || allowedOrigin === origin)) {
        return callback(null, true);
      }
      // Allow any localhost / 127.0.0.1 port in dev
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }
      // Default to allowed in dev if not production
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit: each request may launch a full headless Chromium instance
// and call paid third-party APIs (VirusTotal, Google Safe Browsing), so
// this endpoint is expensive to abuse without a limit.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/analyze", analyzeLimiter);

// Serve screenshot previews captured by sandboxService. Locked behind the
// same API key as everything else, since filenames are guessable enough
// (md5 of url + timestamp) that "unguessable URL" alone isn't real access
// control.
app.use("/previews", requireApiKey, express.static("public/previews"));

// Ensure API responses are never cached by browsers or proxies so live stats stay current
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// /api/healthz stays public — load balancers and uptime monitors need to
// reach it without a key. Everything else under /api requires one.
app.use("/api", healthRouter);
app.use("/api", requireApiKey, router);

export default app;
