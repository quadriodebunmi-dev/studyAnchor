// Crop maths for the profile-picture editor, kept free of React and the DOM so it can be tested.
//
// The editing state is { zoom, ox, oy, rot }:
//   zoom  1 = the photo just covers the square; larger = zoomed in
//   ox/oy how far the photo is dragged, as a FRACTION of the square's side (so the preview and
//         the exported picture always show exactly the same crop, whatever their pixel size)
//   rot   quarter turns clockwise (0–3)

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const turned = (w, h, rot) => (rot % 2 ? [h, w] : [w, h]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Keeps the photo covering the whole square: you can never drag it off and expose an empty edge. */
export function clampState(w, h, { zoom, ox, oy, rot }) {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const [rw, rh] = turned(w, h, rot);
  const base = 1 / Math.min(rw, rh); // scale (square side = 1) at which the short side exactly fits
  const maxX = Math.max(0, (rw * base * z - 1) / 2);
  const maxY = Math.max(0, (rh * base * z - 1) / 2);
  return { zoom: z, rot, ox: clamp(ox, -maxX, maxX) + 0, oy: clamp(oy, -maxY, maxY) + 0 }; // "+ 0" turns -0 into 0
}

/** Paints the crop onto a square canvas context of `size` pixels. */
export function drawAvatar(ctx, bitmap, size, { zoom, ox, oy, rot }) {
  const [rw, rh] = turned(bitmap.width, bitmap.height, rot);
  const scale = (size / Math.min(rw, rh)) * zoom;
  ctx.save();
  ctx.fillStyle = "#fff"; // JPEG has no transparency
  ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2 + ox * size, size / 2 + oy * size);
  ctx.rotate((rot * Math.PI) / 2);
  ctx.scale(scale, scale);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
}
