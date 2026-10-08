import express from "express";
import { listCourses, getCourse, createCourse, updateCourse, deleteCourse } from "../controllers/courseController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();
router.use(authMiddleware, userLimiter);

// Admins can always manage courses. Any approved Rep — Course Rep or Class
// Rep — can add, edit, and delete courses too.
function adminOrRep(req, res, next) {
  if (req.user?.role === "admin") return next();
  if (req.user?.role === "rep" && req.user?.repStatus === "active") return next();
  return res.status(403).json({ message: "Admin or Rep access required." });
}

router.get("/", listCourses);
router.get("/:id", getCourse);
router.post("/", adminOrRep, createCourse);
router.put("/:id", adminOrRep, updateCourse);
router.delete("/:id", adminOrRep, deleteCourse);

export default router;
