// One-off: builds the indexes for the Phase B–E collections (and drops none).
//   npm run sync-indexes
// Mongoose also creates missing indexes automatically at startup; run this
// after deploying if you've disabled autoIndex in production.
import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import "../models/User.js";
import "../models/Material.js";
import Room from "../models/Room.js";
import RoomMember from "../models/RoomMember.js";
import RoomPost from "../models/RoomPost.js";
import RoomReport from "../models/RoomReport.js";
import RoomEvent from "../models/RoomEvent.js";
import RoomQuiz from "../models/RoomQuiz.js";
import RoomQuizQuestion from "../models/RoomQuizQuestion.js";
import RoomQuizAttempt from "../models/RoomQuizAttempt.js";
import Notification from "../models/Notification.js";
import PointTransaction from "../models/PointTransaction.js";
import AIUsage from "../models/AIUsage.js";
import FlashcardDeck from "../models/FlashcardDeck.js";
import MockExam from "../models/MockExam.js";
import MockExamAttempt from "../models/MockExamAttempt.js";
import SnapQuestion from "../models/SnapQuestion.js";
import CalendarEvent from "../models/CalendarEvent.js";

await mongoose.connect(ENV.mongoUri);
for (const M of [Room, RoomMember, RoomPost, RoomReport, RoomEvent, RoomQuiz, RoomQuizQuestion, RoomQuizAttempt, Notification, PointTransaction, AIUsage, FlashcardDeck, MockExam, MockExamAttempt, SnapQuestion, CalendarEvent, mongoose.model("Material")]) {
  await M.createIndexes();
  console.log("indexes ready:", M.modelName);
}
await mongoose.disconnect();
