import express from "express";
import { getDashboard, getFeedMaterials, getExploreFeed, getStudyTip } from "../controllers/feedController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, feedLimiter, tipLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);

router.get("/dashboard", getDashboard);
// The two infinite-scroll feeds — one request per screenful, so they get their own limit.
router.get("/materials", feedLimiter, getFeedMaterials);
router.get("/explore", feedLimiter, getExploreFeed);
router.get("/study-tip", tipLimiter, getStudyTip);

export default router;
