import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { generalLimiter } from "./middleware/rateLimitMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import materialRoutes from "./routes/materialRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";

const app = express();

// Behind Vercel/Netlify-style proxies every request would otherwise appear to
// come from the proxy's IP, so the IP-keyed rate limiters (login, school
// requests) would throttle ALL users together.
if (ENV.nodeEnv === "production") app.set("trust proxy", 1);

// Multi-tenant CORS (Stage 1.3): a comma-separated allow-list instead of one
// hardcoded origin, since every school now has its own frontend domain.
// e.g. ALLOWED_ORIGINS="https://lenspdf.netlify.app,https://another-school.app"
const allowedOrigins = (process.env.ALLOWED_ORIGINS || ENV.clientUrl).split(",").map((o) => o.trim());
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
app.use(express.json());
app.use(cookieParser());

// Stage 1.1 — coarse, catch-all rate limit applied to every request. More
// precise limits (auth, feeds, search, zip download, upload, AI...) are
// applied on the routes themselves — see middleware/rateLimitMiddleware.js.
app.use(generalLimiter);

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

app.use(notFound);
app.use(errorHandler);

connectDB().then(() => {
  app.listen(ENV.port, () => console.log(`🚀 ${ENV.appName} API running on port ${ENV.port}`));
});
