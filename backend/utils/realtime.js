import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import User from "../models/User.js";
import RoomMember from "../models/RoomMember.js";

// Socket.IO layer. REST stays the source of truth: every event here is a
// "something changed" nudge whose data the client could equally fetch over HTTP.
// That is also what keeps the app working on serverless hosts (Vercel), where a
// persistent socket isn't possible — initRealtime() simply isn't called there
// and every emit below becomes a no-op.
//
// Security model
//  - A socket must present a valid JWT, belong to a non-suspended user.
//  - A socket joins `room:<id>` ONLY after the server confirms an ACTIVE
//    RoomMember row. Private-room events therefore only ever reach members.
//  - Removing/banning a member evicts their sockets from the room immediately.

let io = null;

export const isRealtimeActive = () => io !== null;

export async function initRealtime(httpServer) {
  if (!ENV.realtimeEnabled) {
    console.log("ℹ️  Realtime disabled (serverless host or REALTIME_ENABLED=false) — clients will poll.");
    return null;
  }
  let Server;
  try {
    ({ Server } = await import("socket.io"));
  } catch {
    console.warn("⚠️  socket.io isn't installed (run `npm install` in backend/) — realtime disabled, REST polling still works.");
    return null;
  }

  io = new Server(httpServer, {
    cors: { origin: ENV.allowedOrigins, credentials: true },
    // Small messages only; nothing here should ever carry a file.
    maxHttpBufferSize: 1e5,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthenticated"));
      const decoded = jwt.verify(token, ENV.jwtSecret);
      const user = await User.findById(decoded.id).select("name suspended");
      if (!user || user.suspended) return next(new Error("unauthorised"));
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error("unauthenticated"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on("room:join", async (payload, ack) => {
      try {
        const roomId = String(payload?.roomId || "");
        if (!/^[a-f0-9]{24}$/i.test(roomId)) return ack?.({ ok: false });
        const member = await RoomMember.findOne({ room: roomId, user: socket.data.userId, status: "active" }).select("_id");
        if (!member) return ack?.({ ok: false, message: "Not a member of this room." });
        socket.join(`room:${roomId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on("room:leave", (payload) => {
      const roomId = String(payload?.roomId || "");
      if (roomId) socket.leave(`room:${roomId}`);
    });
  });

  console.log("🔌 Realtime (Socket.IO) ready");
  return io;
}

export function emitToRoom(roomId, event, payload = {}) {
  try { io?.to(`room:${roomId}`).emit(event, payload); } catch { /* a missed nudge must never fail a request */ }
}

export function emitToUser(userId, event, payload = {}) {
  try { io?.to(`user:${userId}`).emit(event, payload); } catch { /* see above */ }
}

/** Drop a user's live sockets out of a room (removed, banned, left). */
export function evictFromRoom(roomId, userId) {
  try { io?.in(`user:${userId}`).socketsLeave(`room:${roomId}`); } catch { /* see above */ }
}
