import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  appName: process.env.APP_NAME || "study-anchor",
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  groqKey: process.env.GROQ_API_KEY,
  // Every text AI feature (quiz, theory questions, study tips, chat
  // assistant) reads its model from here — never hardcode a model name
  // anywhere else. Vision (image transcription) needs its own model.
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  groqVisionModel: process.env.GROQ_VISION_MODEL || "llama-3.2-90b-vision-preview",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  // Optional. When set, rate-limit counters live in Redis so they're shared
  // across server instances (needed on Vercel/serverless). Unset = in-memory.
  redisUrl: process.env.REDIS_URL,
  email: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
  },
};
