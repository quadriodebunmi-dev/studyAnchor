import multer from "multer";

// Memory storage so the raw buffer is available both for text extraction
// (pdf-parse/mammoth/xlsx) and for streaming up to Cloudinary in the
// controller — CloudinaryStorage alone would upload directly and leave us
// without a buffer to parse text from.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max, per the project guide
});

export default upload;
