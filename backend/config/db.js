import mongoose from "mongoose";
import { ENV } from "./env.js";

// Cache the connection across invocations of a warm serverless instance.
// On Vercel, module scope can persist between invocations when the
// function stays warm, so this avoids reconnecting on every request.
let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (!ENV.mongoUri) {
    console.warn("⚠️  MONGODB_URI not set — add it to backend/.env before starting the server for real.");
    return;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(ENV.mongoUri, {
        bufferCommands: false, // fail fast instead of queuing ops on a dead connection
        serverSelectionTimeoutMS: 10000,
      })
      .then((mongooseInstance) => {
        console.log("✅ MongoDB connected");
        return mongooseInstance;
      })
      .catch((err) => {
        cached.promise = null; // allow retry on next request
        console.error("❌ MongoDB connection error:", err.message);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}