import express from "express";
import { generateQuiz, generateTheoryQuiz, getQuiz, submitQuiz, myAttempts, myAnalytics } from "../controllers/quizController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, aiLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);

router.post("/generate", aiLimiter, generateQuiz);
router.post("/generate-theory", aiLimiter, generateTheoryQuiz);
router.get("/attempts/mine", myAttempts);
router.get("/analytics/mine", myAnalytics);
router.get("/:id", getQuiz);
router.post("/:id/submit", submitQuiz);

export default router;
