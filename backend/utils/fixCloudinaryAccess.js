// One-time fix for materials uploaded BEFORE the access_mode fix in
// cloudinaryUpload.js. Cloudinary's 2024 "restricted media types" security
// default marks pdf/docx/pptx/xlsx uploads as access_mode "authenticated"
// unless access_mode:"public" was explicitly requested at upload time —
// anything uploaded before that fix will 401 on every ordinary delivery URL
// (this is exactly the `401 (Unauthorized)` error on a material's fileUrl).
//
// This script finds every existing Material, works out its Cloudinary
// resource_type + public_id from the stored fileUrl, and flips access_mode
// to "public" via the Admin API so old uploads start working again without
// needing to be re-uploaded.
//
// Run with: npm run fix-access
import { connectDB } from "../config/db.js";
import Material from "../models/Material.js";
import cloudinary from "../config/cloudinary.js";
import { resourceTypeFor } from "./cloudinaryUpload.js";
import mongoose from "mongoose";

// Given a Cloudinary delivery URL like:
//   https://res.cloudinary.com/<cloud>/<resource_type>/upload/v123/folder/name.ext
// return { resourceType, publicId } suitable for the Admin API. Returns null
// for URLs that aren't Cloudinary URLs (e.g. seed data placeholders).
function parseCloudinaryUrl(fileUrl, fileType) {
  const match = fileUrl.match(/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/v\d+\/(.+)$/);
  if (!match) return null;
  const [, urlResourceType, pathWithExt] = match;
  const resourceType = urlResourceType || resourceTypeFor(fileType);
  // Raw resources keep their extension as part of the public_id; image/video
  // resources have the format stripped back off to get the real public_id.
  const publicId = resourceType === "raw" ? pathWithExt : pathWithExt.replace(/\.[^/.]+$/, "");
  return { resourceType, publicId };
}

async function run() {
  await connectDB();
  const materials = await Material.find({});
  let fixed = 0, skipped = 0, failed = 0;

  for (const material of materials) {
    const parsed = parseCloudinaryUrl(material.fileUrl, material.fileType);
    if (!parsed) { skipped++; continue; }
    try {
      await cloudinary.api.update(parsed.publicId, { resource_type: parsed.resourceType, access_mode: "public" });
      fixed++;
      console.log(`✅ Fixed access for "${material.title}" (${parsed.resourceType}/${parsed.publicId})`);
    } catch (err) {
      failed++;
      console.error(`❌ Couldn't fix "${material.title}": ${err.message}`);
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, skipped (not a Cloudinary URL): ${skipped}, failed: ${failed}.`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });