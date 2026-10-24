import RoomEvent from "../models/RoomEvent.js";
import { emitToRoom } from "./realtime.js";

/** Writes an entry to the room's activity feed and nudges connected members. Never throws. */
export function logRoomEvent(roomId, type, { actor, subject, quiz, text } = {}) {
  RoomEvent.create({ room: roomId, type, actor, subject, quiz, text })
    .then((ev) => emitToRoom(String(roomId), "event:new", { _id: ev._id, type, text, createdAt: ev.createdAt }))
    .catch((err) => console.error("logRoomEvent failed:", err.message));
}
