import cloudinary from "../config/cloudinary.js";
import { ENV } from "../config/env.js";

// Cloudinary treats "raw" resources (docx/pptx/xlsx) very differently from
// "image" resources (images + pdf, which Cloudinary can rasterize/transform):
//   - For "image" resources, Cloudinary appends the correct file extension
//     to the delivery URL automatically based on the detected format, so the
//     public_id should NOT include an extension.
//   - For "raw" resources, the delivery URL is exactly the public_id with no
//     automatic extension — so the extension MUST be baked into the
//     public_id itself, or the file is served with no extension at all and
//     most viewers/downloads fail to recognize the file type (this was the
//     original bug: `filename.split(".")[0]` stripped the extension for
//     every upload, which silently broke every non-image file).
const RAW_TYPES = new Set(["docx", "pptx", "xlsx"]);

export function resourceTypeFor(fileType) {
  return RAW_TYPES.has(fileType) ? "raw" : "image"; // pdf + image both use the "image" pipeline
}

// Cloudinary public IDs are happiest with URL-safe characters.
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

// Streams a buffer up to Cloudinary and resolves with the upload result,
// including a working `secure_url` for both preview and download.
export function uploadBufferToCloudinary(buffer, filename, fileType) {
  const resourceType = resourceTypeFor(fileType);
  const safeName = sanitizeFilename(filename);
  const lastDot = safeName.lastIndexOf(".");
  const base = lastDot > 0 ? safeName.slice(0, lastDot) : safeName;
  const ext = lastDot > 0 ? safeName.slice(lastDot + 1) : "";
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  // Keep the extension in the public_id only for raw resources — image
  // resources get it appended automatically and having it twice would break
  // format detection.
  const publicId = resourceType === "raw" && ext ? `${base}-${unique}.${ext}` : `${base}-${unique}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${ENV.appName.toLowerCase()}/materials`,
        resource_type: resourceType,
        public_id: publicId,
        overwrite: false,
        // CRITICAL: Cloudinary accounts created/updated after their 2024
        // "restricted media types" security change default PDFs and raw
        // files to access_mode "authenticated" — every ordinary delivery
        // URL for them then 401s, even though the upload itself succeeds.
        // Explicitly requesting public access at upload time is what
        // actually fixes that (a signed delivery URL does NOT fix this —
        // that's a different Cloudinary feature for transformation
        // signing and doesn't bypass an authenticated access_mode).
        access_mode: "public",
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}