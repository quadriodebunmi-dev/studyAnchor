import express from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, studyAiLimiter, snapUploadLimiter, quizSaveLimiter } from "../middleware/rateLimitMiddleware.js";
import { requireAIFeature } from "../utils/aiGuard.js";
import { PLATFORM } from "../config/platform.js";
import { extractQuestion, answerQuestion, answerTyped, snapHistory, deleteSnap } from "../controllers/snapController.js";
import {
  materialTopics, generateDeck, listDecks, getDeck, renameDeck, deleteDeck, addCard, updateCard, deleteCard,
} from "../controllers/flashcardController.js";
import {
  generateExam, listExams, getExam, deleteExam, startExamAttempt, saveExamAnswers, checkAnswer,
  submitExamAttempt, getExamAttempt, adjustTheoryMarks, examHistory, examAnalytics,
} from "../controllers/mockExamController.js";

// Snap photos are held in memory only, capped well below the material upload limit.
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PLATFORM.ai.maxImageBytes, files: 1 } });
const oneImage = (req, res, next) => photoUpload.single("image")(req, res, (err) => {
  if (!err) return next();
  const tooBig = err.code === "LIMIT_FILE_SIZE";
  res.status(400).json({ message: tooBig ? "That image is too large." : "Couldn't read that upload." });
});

const router = express.Router();
router.use(authMiddleware, userLimiter);

const snapAI = requireAIFeature({ entitlement: "snap", usage: "snap" });
const cardsAI = requireAIFeature({ entitlement: "flashcards", usage: "flashcards" });
const examAI = requireAIFeature({ entitlement: "mockExams", usage: "exams" });

// ---- Snap a Question
router.post("/snap/extract", snapUploadLimiter, snapAI, oneImage, extractQuestion);
router.post("/snap/answer-text", studyAiLimiter, snapAI, answerTyped);
router.post("/snap/:snapId/answer", studyAiLimiter, snapAI, answerQuestion);
router.get("/snap/history", snapHistory);
router.delete("/snap/:snapId", deleteSnap);

// ---- Flashcards
router.get("/flashcards", listDecks);
router.post("/flashcards/topics", studyAiLimiter, cardsAI, materialTopics);
router.post("/flashcards/generate", studyAiLimiter, cardsAI, generateDeck);
router.get("/flashcards/:deckId", getDeck);
router.put("/flashcards/:deckId", renameDeck);
router.delete("/flashcards/:deckId", deleteDeck);
router.post("/flashcards/:deckId/cards", addCard);
router.put("/flashcards/:deckId/cards/:cardId", updateCard);
router.delete("/flashcards/:deckId/cards/:cardId", deleteCard);

// ---- Mock exams (static paths before :examId)
router.get("/exams", listExams);
router.post("/exams/generate", studyAiLimiter, examAI, generateExam);
router.get("/exams/attempts", examHistory);
router.get("/exams/analytics", examAnalytics);
router.get("/exams/attempts/:attemptId", getExamAttempt);
router.put("/exams/attempts/:attemptId/answers", quizSaveLimiter, saveExamAnswers);
router.post("/exams/attempts/:attemptId/check", checkAnswer);
router.post("/exams/attempts/:attemptId/submit", submitExamAttempt);
router.put("/exams/attempts/:attemptId/theory-marks", adjustTheoryMarks);
router.get("/exams/:examId", getExam);
router.delete("/exams/:examId", deleteExam);
router.post("/exams/:examId/attempts", startExamAttempt);

export default router;
