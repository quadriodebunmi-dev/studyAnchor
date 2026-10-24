// Prepares a photo for upload: fixes phone-camera rotation (EXIF), downsizes it
// and re-encodes as JPEG. Raw camera photos are often 5–12 MB (or HEIC), which
// serverless hosts reject (~4.5 MB request limit) — this keeps them small and
// in a format the server accepts.

export async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch { /* fall through to <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode failed")); };
    img.src = url;
  });
}

const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

/**
 * @returns {Promise<File>} a JPEG File (or the original if it is already small and a supported type)
 * @throws Error with a user-friendly message when the image can't be read
 */
export async function prepareImage(file, { maxDim = 1600, quality = 0.85, maxBytes = 3 * 1024 * 1024 } = {}) {
  if (!file) throw new Error("No image selected.");
  let bitmap;
  try {
    bitmap = await decodeImage(file);
  } catch {
    // Browser can't decode it (e.g. HEIC outside Safari). Only send it untouched if the server will take it.
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.type) && file.size <= maxBytes) return file;
    throw new Error("We couldn't read that photo. Try taking it again, or choose a JPG or PNG.");
  }
  const w = bitmap.width, h = bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // JPEG has no alpha; avoid black backgrounds on transparent PNGs
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(bitmap, 0, 0, cw, ch);
  bitmap.close?.();

  let blob = await toBlob(canvas, "image/jpeg", quality);
  // Still too big? Step the quality down a few times.
  for (let q = quality - 0.15; blob && blob.size > maxBytes && q > 0.4; q -= 0.15) blob = await toBlob(canvas, "image/jpeg", q);
  if (!blob) throw new Error("We couldn't process that photo. Please try another.");
  if (blob.size > maxBytes) throw new Error("That photo is too large. Try a smaller one.");
  const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/** Camera frames (from <video>) → JPEG File, already downsized. */
export async function captureFromVideo(video, { maxDim = 1600, quality = 0.88 } = {}) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) throw new Error("The camera isn't ready yet.");
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await toBlob(canvas, "image/jpeg", quality);
  if (!blob) throw new Error("Couldn't capture the photo.");
  return new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
}
