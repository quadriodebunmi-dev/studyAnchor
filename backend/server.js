import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { generalLimiter } from "./middleware/rateLimitMiddleware.js";
import { trimInputs } from "./middleware/trimInputs.js";

import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import materialRoutes from "./routes/materialRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import studyRoutes from "./routes/studyRoutes.js";
import internalRoutes from "./routes/internalRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import { settingsMiddleware, refreshSettings } from "./utils/settings.js";
import { runScheduledJobs } from "./utils/scheduler.js";
import { initRealtime } from "./utils/realtime.js";

const app = express();

// Behind Vercel/Netlify-style proxies every request would otherwise appear to
// come from the proxy's IP, so the IP-keyed rate limiters (login, school
// requests) would throttle ALL users together.
if (ENV.nodeEnv === "production") app.set("trust proxy", 1);

// Multi-tenant CORS (Stage 1.3): a comma-separated allow-list instead of one
// hardcoded origin, since every school now has its own frontend domain.
// e.g. ALLOWED_ORIGINS="https://lenspdf.netlify.app,https://another-school.app"
const allowedOrigins = ENV.allowedOrigins;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  // Let the browser read the rate-limit headers so the app can tell people how
  // long to wait when they hit a limit.
  exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "Retry-After"],
}));
// Keep the raw bytes for the Paystack webhook: its HMAC signature is computed over them.
app.use(express.json({ verify: (req, res, buf) => { if (req.originalUrl.startsWith("/api/billing/webhook")) req.rawBody = buf; } }));
app.use(cookieParser());
app.use(trimInputs); // trim every string in body + query (passwords excluded)

// Stage 1.1 — coarse, catch-all rate limit applied to every request. More
// precise limits (auth, feeds, search, zip download, upload, AI...) are
// applied on the routes themselves — see middleware/rateLimitMiddleware.js.
app.use(generalLimiter);
app.use(settingsMiddleware); // admin-editable settings, refreshed at most once a minute

app.get("/api/health", (req, res) => res.json({ status: "ok", app: ENV.appName }));

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/study", studyRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/calendar", calendarRoutes);

app.use(notFound);
app.use(errorHandler);

connectDB().then(async () => {
  // An http.Server (not app.listen) so Socket.IO can share the port.
  const server = http.createServer(app);
  await refreshSettings(true);
  await initRealtime(server);
  server.listen(ENV.port, () => console.log(`🚀 ${ENV.appName} API running on port ${ENV.port}`));

  // Time-driven quiz work. Skipped on serverless, where /api/internal/cron does it.
  if (!process.env.VERCEL) {
    setInterval(() => runScheduledJobs().catch((err) => console.error("scheduled jobs failed:", err.message)), 60 * 1000).unref();
  }
});
