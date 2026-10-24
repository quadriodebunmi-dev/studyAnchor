// Upload validation shared by materials, Snap-a-Question and anything else that
// accepts a file. We never trust the client's mimetype or filename alone —
// the file's leading bytes ("magic numbers") must agree with what it claims.

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
export const SCHOOL_EXTENSIONS = ["pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx", ...IMAGE_EXTENSIONS];
// Independent learners can keep the same kinds of files as school students
// (PDF, Word, PowerPoint, Excel, images) in their private library.
export const PERSONAL_EXTENSIONS = [...SCHOOL_EXTENSIONS];

export const extensionOf = (name = "") => {
  const i = String(name).lastIndexOf(".");
  return i < 0 ? "" : String(name).slice(i + 1).toLowerCase();
};

/** Returns "pdf" | "png" | "jpg" | "gif" | "webp" | "zip" (OOXML) | "ole" (legacy Office) | null. */
export function sniffFileKind(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.slice(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.slice(0, 4).toString("latin1") === "GIF8") return "gif";
  if (buffer.slice(0, 4).toString("latin1") === "RIFF" && buffer.slice(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "zip";
  // Audio containers (voice notes + audio files)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm"; // Matroska/WebM (Chrome, Firefox, Android)
  if (buffer.slice(0, 4).toString("latin1") === "OggS") return "ogg";
  if (buffer.slice(4, 8).toString("latin1") === "ftyp") return "mp4"; // m4a / mp4 (Safari, iOS)
  if (buffer.slice(0, 3).toString("latin1") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return "mp3";
  if (buffer.slice(0, 4).toString("latin1") === "RIFF" && buffer.slice(8, 12).toString("latin1") === "WAVE") return "wav";
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) return "ole";
  return null;
}

const KIND_FOR_EXT = {
  pdf: ["pdf"],
  png: ["png"], jpg: ["jpg"], jpeg: ["jpg"], gif: ["gif"], webp: ["webp"],
  docx: ["zip"], pptx: ["zip"], xlsx: ["zip"],
  doc: ["ole"], ppt: ["ole"], xls: ["ole"],
};

/**
 * Checks a multer file against an allow-list of extensions AND its real bytes.
 * Returns { ok: true } or { ok: false, message }.
 */
export function validateUploadedFile(file, allowedExtensions) {
  const ext = extensionOf(file?.originalname);
  if (!ext || !allowedExtensions.includes(ext)) {
    return { ok: false, message: `"${file?.originalname || "file"}" isn't a supported type. Allowed: ${allowedExtensions.join(", ")}.` };
  }
  const kind = sniffFileKind(file.buffer);
  if (!kind || !(KIND_FOR_EXT[ext] || []).includes(kind)) {
    return { ok: false, message: `"${file.originalname}" doesn't look like a real .${ext} file.` };
  }
  return { ok: true, ext, kind };
}

/** Image-only check used by Snap a Question. */
export function validateImageFile(file, maxBytes) {
  if (!file?.buffer?.length) return { ok: false, message: "Attach a photo of the question." };
  if (maxBytes && file.size > maxBytes) {
    return { ok: false, message: `That image is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB).` };
  }
  const kind = sniffFileKind(file.buffer);
  if (!["png", "jpg", "gif", "webp"].includes(kind)) {
    return { ok: false, message: "Unsupported image. Use a JPG, PNG, WebP or GIF photo." };
  }
  const mime = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[kind];
  return { ok: true, kind, mime };
}

// ---- Profile picture: a still photo, JPG / PNG / WebP (no GIFs), small ----------
const AVATAR_KINDS = ["png", "jpg", "webp"];
export function validateAvatarFile(file, maxBytes) {
  if (!file?.buffer?.length) return { ok: false, message: "Choose a photo to use as your profile picture." };
  if (maxBytes && file.size > maxBytes) {
    return { ok: false, message: `That picture is too large (max ${Math.round((maxBytes / (1024 * 1024)) * 10) / 10} MB). Crop it in the editor and try again.` };
  }
  const kind = sniffFileKind(file.buffer);
  if (!AVATAR_KINDS.includes(kind)) return { ok: false, message: "Use a JPG, PNG or WebP photo." };
  return { ok: true, kind };
}

// ---- Room chat attachments: one photo OR one sound per message --------------
const CHAT_IMAGE_KINDS = ["png", "jpg", "gif", "webp"];
const CHAT_AUDIO_KINDS = ["webm", "ogg", "mp4", "mp3", "wav"];
const CHAT_MIME = {
  png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  webm: "audio/webm", ogg: "audio/ogg", mp4: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav",
};

/** Decides image vs audio from the file's real bytes. Returns { ok, attachmentKind, kind, mime } or { ok:false, message }. */
export function validateChatAttachment(file, maxBytes) {
  if (!file?.buffer?.length) return { ok: false, message: "That attachment is empty." };
  if (maxBytes && file.size > maxBytes) {
    return { ok: false, message: `That file is too large (max ${(maxBytes / (1024 * 1024)).toFixed(0)} MB).` };
  }
  const kind = sniffFileKind(file.buffer);
  if (CHAT_IMAGE_KINDS.includes(kind)) return { ok: true, attachmentKind: "image", kind, mime: CHAT_MIME[kind] };
  if (CHAT_AUDIO_KINDS.includes(kind)) return { ok: true, attachmentKind: "audio", kind, mime: CHAT_MIME[kind] };
  return { ok: false, message: "Attach a photo (JPG, PNG, WebP, GIF) or a sound (voice note, MP3, M4A, WAV, OGG)." };
}
