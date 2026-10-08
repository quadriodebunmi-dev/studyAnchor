import express from "express";
import { signup, repSignup, login, googleLogin, me, updateProfile, logout, forgotPassword, resetPassword } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { authLimiter, loginLimiter, signupLimiter, googleLimiter, userLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/signup", signupLimiter, signup);
router.post("/rep-signup", signupLimiter, repSignup);
router.post("/login", loginLimiter, login);
router.post("/google", googleLimiter, googleLogin);
router.post("/logout", logout);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", authMiddleware, userLimiter, me);
router.put("/me", authMiddleware, userLimiter, updateProfile);

export default router;
