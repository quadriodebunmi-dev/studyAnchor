import mongoose from "mongoose";
import Room from "../models/Room.js";
import RoomMember from "../models/RoomMember.js";
import RoomQuiz from "../models/RoomQuiz.js";
import { can, isActive, canManageQuiz, isQuizCreator } from "../utils/roomPermissions.js";

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
export const requireRoomOwner = (req, res, next) => (can.manageRoom(req.membership) ? next() : deny(res, "Only the room owner can do that."));

// Any active member may create a quiz in the room.
export const requireQuizCreator = (req, res, next) => (can.createQuiz(req.membership) ? next() : deny(res, "Join this room to create a quiz."));

// Per-quiz management: room owners/moderators for any quiz, otherwise only the
// quiz's own creator. Loads the quiz once and hands it to the controller.
export async function requireQuizManager(req, res, next) {
  try {
    if (!can.viewContent(req.membership)) return deny(res, "Join this room to see its content.");
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(404).json({ message: "Quiz not found." });
    const quiz = await RoomQuiz.findOne({ _id: req.params.quizId, room: req.room._id });
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });
    if (!canManageQuiz(req.membership, quiz, req.user._id)) return deny(res, "Only the quiz creator or a room moderator can manage this quiz.");
    req.quizDoc = quiz;
    next();
  } catch (err) { next(err); }
}

// Deleting: the room owner, or the quiz's own creator.
export async function requireQuizDeleter(req, res, next) {
  try {
    if (!can.viewContent(req.membership)) return deny(res, "Join this room to see its content.");
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(404).json({ message: "Quiz not found." });
    const quiz = await RoomQuiz.findOne({ _id: req.params.quizId, room: req.room._id });
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });
    if (!(can.deleteQuiz(req.membership) || isQuizCreator(quiz, req.user._id))) return deny(res, "Only the room owner or the quiz creator can delete this quiz.");
    req.quizDoc = quiz;
    next();
  } catch (err) { next(err); }
}
