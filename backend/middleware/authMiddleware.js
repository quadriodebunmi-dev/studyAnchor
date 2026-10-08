import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import User from "../models/User.js";

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Not authenticated. Please log in." });

    const decoded = jwt.verify(token, ENV.jwtSecret);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User no longer exists." });
    if (user.suspended) return res.status(403).json({ message: "Your account has been suspended." });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
  }
}
