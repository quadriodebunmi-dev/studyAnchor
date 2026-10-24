import crypto from "crypto";
import express from "express";
import { ENV } from "../config/env.js";
import { runScheduledJobs } from "../utils/scheduler.js";

const router = express.Router();

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Runs the time-driven work (quiz opening/deadline/closing/release notifications,
// auto-submitting timed-out attempts). A long-running server also does this on
// a timer; on serverless (Vercel) point a Cron Job at this endpoint every minute:
//   vercel.json -> "crons": [{ "path": "/api/internal/cron", "schedule": "* * * * *" }]
// and set CRON_SECRET (Vercel sends it as "Authorization: Bearer <secret>").
async function cron(req, res, next) {
  try {
    if (!ENV.cronSecret) return res.status(503).json({ message: "CRON_SECRET isn't configured." });
    const given = (req.headers.authorization || "").replace(/^Bearer /, "") || req.headers["x-cron-secret"];
    if (!safeEqual(given, ENV.cronSecret)) return res.status(401).json({ message: "Unauthorised." });
    const result = await runScheduledJobs();
    res.json({ ok: true, result });
  } catch (err) { next(err); }
}
router.get("/cron", cron);
router.post("/cron", cron);

export default router;
