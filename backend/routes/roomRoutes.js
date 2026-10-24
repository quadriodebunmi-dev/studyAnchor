import express from "express";
import multer from "multer";
import { PLATFORM } from "../config/platform.js";
import { trimInputs } from "../middleware/trimInputs.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, roomWriteLimiter, postLimiter, quizSaveLimiter, studyAiLimiter } from "../middleware/rateLimitMiddleware.js";
import { loadRoom, requireRoomMember, requireRoomModerator, requireRoomOwner, requireQuizManager } from "../middleware/roomMiddleware.js";
import { requireAIFeature } from "../utils/aiGuard.js";
import { requireFeature } from "../middleware/featureMiddleware.js";
import {
  discoverRooms, myRooms, myInvitations, createRoom, previewByCode, getRoom, updateRoom, deleteRoom,
  joinRoom, leaveRoom, respondToInvitation, inviteToRoom, listRequests, decideRequest,
  listMembers, setMemberRole, removeMember, roomActivity,
} from "../controllers/roomController.js";
import {
  listPosts, listReplies, createPost, editPost, removePost, reportPost, listReports, dismissReport,
} from "../controllers/roomPostController.js";
import {
  createQuiz, updateQuiz, deleteQuiz, getQuizForManager, addQuestion, updateQuestion, approveQuestions, deleteQuestion,
  generateQuizQuestions, publishQuiz, unpublishQuiz, closeQuiz, releaseResults, listQuizzes, getQuiz,
  participation, leaderboard, getAttemptForGrading, gradeAttempt, aiGradeAttempt, confirmAiGrades,
} from "../controllers/roomQuizController.js";
import { startAttempt, saveAnswers, submitAttempt, myResult, previewQuiz } from "../controllers/roomQuizAttemptController.js";

// Chat attachments (one photo or sound) are held in memory just long enough to
// be validated and sent to Cloudinary. Multer only parses multipart requests,
// so plain JSON messages pass straight through.
const chatUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PLATFORM.rooms.attachmentMaxBytes, files: 1, fields: 6 } });
const oneAttachment = (req, res, next) => chatUpload.single("file")(req, res, (err) => {
  if (!err) return next();
  const tooBig = err.code === "LIMIT_FILE_SIZE";
  res.status(tooBig ? 413 : 400).json({ message: tooBig ? `That file is too large (max ${Math.round(PLATFORM.rooms.attachmentMaxBytes / (1024 * 1024))} MB).` : "Couldn't read that upload." });
});

const router = express.Router();
router.use(authMiddleware, userLimiter);

// ---- collection-level (no :roomId) — declared first so they aren't read as ids
router.get("/", discoverRooms);
router.get("/mine", myRooms);
router.get("/invitations", myInvitations);
router.get("/code/:code", previewByCode);
router.post("/", roomWriteLimiter, requireFeature("rooms"), createRoom);

// ---- one room
router.get("/:roomId", loadRoom, getRoom);
router.put("/:roomId", roomWriteLimiter, loadRoom, requireRoomOwner, updateRoom);
router.delete("/:roomId", roomWriteLimiter, loadRoom, requireRoomOwner, deleteRoom);

router.post("/:roomId/join", roomWriteLimiter, loadRoom, joinRoom);
router.post("/:roomId/leave", loadRoom, leaveRoom);
router.post("/:roomId/invitation", loadRoom, respondToInvitation);
router.post("/:roomId/invite", roomWriteLimiter, loadRoom, requireRoomModerator, inviteToRoom);
router.get("/:roomId/requests", loadRoom, requireRoomModerator, listRequests);
router.post("/:roomId/requests/:userId/:decision", roomWriteLimiter, loadRoom, requireRoomModerator, decideRequest);

router.get("/:roomId/members", loadRoom, requireRoomMember, listMembers);
router.put("/:roomId/members/:userId", roomWriteLimiter, loadRoom, requireRoomOwner, setMemberRole);
router.delete("/:roomId/members/:userId", roomWriteLimiter, loadRoom, requireRoomModerator, removeMember);
router.get("/:roomId/activity", loadRoom, requireRoomMember, roomActivity);

// ---- discussion
router.get("/:roomId/posts", loadRoom, requireRoomMember, listPosts);
router.post("/:roomId/posts", postLimiter, loadRoom, requireRoomMember, oneAttachment, trimInputs, createPost);
router.get("/:roomId/posts/:postId/replies", loadRoom, requireRoomMember, listReplies);
router.put("/:roomId/posts/:postId", postLimiter, loadRoom, requireRoomMember, editPost);
router.delete("/:roomId/posts/:postId", loadRoom, requireRoomMember, removePost);
router.post("/:roomId/posts/:postId/report", roomWriteLimiter, loadRoom, requireRoomMember, reportPost);
router.get("/:roomId/reports", loadRoom, requireRoomModerator, listReports);
router.post("/:roomId/reports/:reportId/dismiss", loadRoom, requireRoomModerator, dismissReport);

// ---- quizzes (members)
const memberOnly = [loadRoom, requireRoomMember];
const manager = [loadRoom, requireRoomMember, requireQuizManager];
const aiGen = requireAIFeature({ entitlement: "roomQuizzes", usage: "roomQuizGeneration" });
const aiGrade = requireAIFeature({ entitlement: "roomQuizzes", usage: "theoryGrading" });

router.get("/:roomId/quizzes", ...memberOnly, listQuizzes);
router.post("/:roomId/quizzes", roomWriteLimiter, ...manager, requireFeature("roomQuizzes"), createQuiz);
router.get("/:roomId/quizzes/:quizId", ...memberOnly, getQuiz);
router.put("/:roomId/quizzes/:quizId", ...manager, updateQuiz);
router.delete("/:roomId/quizzes/:quizId", loadRoom, requireRoomMember, requireRoomOwner, deleteQuiz);

// questions & lifecycle (managers)
router.get("/:roomId/quizzes/:quizId/manage", ...manager, getQuizForManager);
router.get("/:roomId/quizzes/:quizId/preview", ...manager, previewQuiz);
router.post("/:roomId/quizzes/:quizId/questions", ...manager, addQuestion);
router.post("/:roomId/quizzes/:quizId/questions/generate", studyAiLimiter, ...manager, aiGen, generateQuizQuestions);
router.post("/:roomId/quizzes/:quizId/questions/:qid/approve", ...manager, approveQuestions);
router.put("/:roomId/quizzes/:quizId/questions/:qid", ...manager, updateQuestion);
router.delete("/:roomId/quizzes/:quizId/questions/:qid", ...manager, deleteQuestion);
router.post("/:roomId/quizzes/:quizId/publish", ...manager, publishQuiz);
router.post("/:roomId/quizzes/:quizId/unpublish", ...manager, unpublishQuiz);
router.post("/:roomId/quizzes/:quizId/close", ...manager, closeQuiz);
router.post("/:roomId/quizzes/:quizId/release", ...manager, releaseResults);
router.get("/:roomId/quizzes/:quizId/participation", ...manager, participation);
router.get("/:roomId/quizzes/:quizId/attempts/:attemptId", ...manager, getAttemptForGrading);
router.put("/:roomId/quizzes/:quizId/attempts/:attemptId/grade", ...manager, gradeAttempt);
router.post("/:roomId/quizzes/:quizId/attempts/:attemptId/ai-grade", studyAiLimiter, ...manager, aiGrade, aiGradeAttempt);
router.post("/:roomId/quizzes/:quizId/attempts/:attemptId/confirm-ai", ...manager, confirmAiGrades);

// taking a quiz (members)
router.post("/:roomId/quizzes/:quizId/attempts", ...memberOnly, startAttempt);
router.put("/:roomId/quizzes/:quizId/attempts/mine/answers", quizSaveLimiter, ...memberOnly, saveAnswers);
router.post("/:roomId/quizzes/:quizId/attempts/mine/submit", ...memberOnly, submitAttempt);
router.get("/:roomId/quizzes/:quizId/results/mine", ...memberOnly, myResult);
router.get("/:roomId/quizzes/:quizId/leaderboard", ...memberOnly, leaderboard);

export default router;
