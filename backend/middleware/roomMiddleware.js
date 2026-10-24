import mongoose from "mongoose";
import Room from "../models/Room.js";
import RoomMember from "../models/RoomMember.js";
import { can, isActive } from "../utils/roomPermissions.js";

// Loads :roomId plus the caller's membership onto the request. Admins get a
// synthetic moderator-level membership so they can moderate any room; they are
// never an owner and (see quiz rules) can't take quizzes.
export async function loadRoom(req, res, next) {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) return res.status(404).json({ message: "Room not found." });
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found." });
    let membership = await RoomMember.findOne({ room: room._id, user: req.user._id });
    if (!isActive(membership) && req.user.role === "admin") {
      membership = { status: "active", role: "moderator", user: req.user._id, synthetic: true };
    }
    req.room = room;
    req.membership = membership;
    next();
  } catch (err) { next(err); }
}

const deny = (res, message = "You don't have access to this room.") => res.status(403).json({ message });

export const requireRoomMember = (req, res, next) => (can.viewContent(req.membership) ? next() : deny(res, "Join this room to see its content."));
export const requireRoomModerator = (req, res, next) => (can.moderate(req.membership) ? next() : deny(res, "Only room owners and moderators can do that."));
export const requireQuizManager = (req, res, next) => (can.manageQuizzes(req.membership) ? next() : deny(res, "Only room owners and moderators can manage quizzes."));
export const requireRoomOwner = (req, res, next) => (can.manageRoom(req.membership) ? next() : deny(res, "Only the room owner can do that."));
