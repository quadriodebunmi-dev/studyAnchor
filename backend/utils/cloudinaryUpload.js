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

// ---- Room chat media --------------------------------------------------------
// Photos use Cloudinary's "image" pipeline; sounds go through "video" (Cloudinary's
// type for all audio/video). Both are delivered publicly.
export function uploadChatMedia(buffer, { roomId, kind }) {
  const resourceType = kind === "audio" ? "video" : "image";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${ENV.appName.toLowerCase()}/rooms/${roomId}`,
        resource_type: resourceType,
        public_id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        overwrite: false,
        access_mode: "public",
      },
      (error, result) => (error ? reject(error) : resolve({ ...result, resourceType }))
    );
    stream.end(buffer);
  });
}

// Best effort: a failed cleanup must never block deleting the message itself.
export async function deleteChatMedia(publicId, kind) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: kind === "audio" ? "video" : "image", invalidate: true });
  } catch (err) {
    console.error("Chat media cleanup failed:", err.message);
  }
}

// ---- Profile pictures -------------------------------------------------------
// One image per user (same public_id, overwritten on change). Cloudinary also
// re-crops it to a 256px square around the face, so even a hand-made request
// can't leave a huge image behind.
export function uploadAvatar(buffer, userId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${ENV.appName.toLowerCase()}/avatars`,
        public_id: `user-${userId}`,
        resource_type: "image",
        overwrite: true,
        invalidate: true,
        format: "jpg",
        transformation: [{ width: 256, height: 256, crop: "fill", gravity: "face" }],
        access_mode: "public",
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Best effort: a failed cleanup must never block removing the picture from the profile.
export async function deleteAvatar(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (err) {
    console.error("Avatar cleanup failed:", err.message);
  }
}

// ---- Direct (browser -> Cloudinary) material uploads -------------------------
// Vercel-style hosts reject request bodies over ~4.5 MB before our code runs, so
// the browser sends each file straight to Cloudinary with a one-use signature from
// us, then tells the API what it uploaded (POST /materials/register).
export const materialFolder = () => `${ENV.appName.toLowerCase()}/materials`;

// Every direct upload's public_id starts with the uploader's id, so registering
// someone else's file (or any other asset in the account) can be refused.
export const materialIdPrefix = (userId) => `${materialFolder()}/u${userId}-`;

/** Signed parameters the browser needs to upload ONE file. */
export function signMaterialUpload(filename, fileType, userId) {
  const resourceType = resourceTypeFor(fileType);
  const safeName = sanitizeFilename(filename);
  const lastDot = safeName.lastIndexOf(".");
  const base = lastDot > 0 ? safeName.slice(0, lastDot) : safeName;
  const ext = lastDot > 0 ? safeName.slice(lastDot + 1) : "";
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const idPart = `u${userId}-${base.slice(0, 80)}-${unique}`;
  const publicId = resourceType === "raw" && ext ? `${idPart}.${ext}` : idPart;

  // Exactly the params the browser will send (besides file/api_key/resource_type).
  const params = {
    access_mode: "public", // see the note in uploadBufferToCloudinary
    folder: materialFolder(),
    public_id: publicId,
    timestamp: Math.round(Date.now() / 1000),
  };
  const signature = cloudinary.utils.api_sign_request(params, ENV.cloudinary.apiSecret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${ENV.cloudinary.cloudName}/${resourceType}/upload`,
    apiKey: ENV.cloudinary.apiKey,
    params,
    signature,
  };
}

/** Delivery URL for a registered asset, rebuilt server-side (never trust a client-sent URL). */
export function materialDeliveryUrl({ publicId, version, fileName, fileType }) {
  const resourceType = resourceTypeFor(fileType);
  const ext = sanitizeFilename(fileName).split(".").pop().toLowerCase().replace("jpeg", "jpg");
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "upload",
    secure: true,
    urlAnalytics: false, // keep the stored URL identical in shape to an upload result's secure_url
    version,
    // image resources need the format on the URL; raw ones already have it in the public_id
    ...(resourceType === "image" ? { format: fileType === "pdf" ? "pdf" : ext } : {}),
  });
}

// Best effort cleanup of an asset we refuse to keep (failed validation).
export async function deleteMaterialAsset(publicId, fileType) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceTypeFor(fileType), invalidate: true });
  } catch (err) {
    console.error("Material asset cleanup failed:", err.message);
  }
}
