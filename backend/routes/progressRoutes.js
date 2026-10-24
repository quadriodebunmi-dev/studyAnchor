import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, roomWriteLimiter } from "../middleware/rateLimitMiddleware.js";
import { listGoals, createGoal, updateGoal, deleteGoal, completeGoal, logSession, recentSessions } from "../controllers/goalController.js";
import { studyAnalytics } from "../controllers/analyticsController.js";
import { summary, pointsHistory, pointRules, leaderboard, updatePreferences, getPreferences, pushConfig, savePushSubscription, removePushSubscription } from "../controllers/progressController.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);

// goals & sessions (static paths before :id)
router.get("/goals", listGoals);
router.post("/goals", roomWriteLimiter, createGoal);
router.get("/goals/sessions", recentSessions);
router.post("/goals/sessions", roomWriteLimiter, logSession);
router.put("/goals/:id", updateGoal);
router.delete("/goals/:id", deleteGoal);
router.post("/goals/:id/complete", completeGoal);

// progress, points, leaderboard (mounted at /api/progress)
router.get("/summary", summary);
router.get("/analytics", studyAnalytics);
router.get("/points", pointsHistory);
router.get("/rules", pointRules);
router.get("/leaderboard", leaderboard);

// preferences + push
router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);
router.get("/push-config", pushConfig);
router.post("/push", savePushSubscription);
router.delete("/push", removePushSubscription);

export default router;
