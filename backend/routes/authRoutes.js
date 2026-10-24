import express from "express";
import multer from "multer";
import { signup, repSignup, login, googleLogin, me, updateProfile, logout, forgotPassword, resetPassword, setAvatar, removeAvatar } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { authLimiter, loginLimiter, signupLimiter, googleLimiter, userLimiter, avatarLimiter } from "../middleware/rateLimitMiddleware.js";
import { PLATFORM } from "../config/platform.js";

// Profile pictures are held in memory only and capped small: the app sends a cropped ~100 KB JPEG.
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PLATFORM.profile.avatarMaxBytes, files: 1 } });
const oneAvatar = (req, res, next) => avatarUpload.single("avatar")(req, res, (err) => {
  if (!err) return next();
  res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "That picture is too large. Crop it in the editor and try again." : "Couldn't read that upload." });
});

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
router.put("/me/avatar", authMiddleware, userLimiter, avatarLimiter, oneAvatar, setAvatar);
router.delete("/me/avatar", authMiddleware, userLimiter, removeAvatar);

export default router;
