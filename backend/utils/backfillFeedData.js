// One-time (and safe to re-run) backfill for the feed algorithm:
//   * `topics`        keywords for every material that doesn't have any yet
//   * `bookmarkCount` how many students have bookmarked each material
//
// New uploads get their topics automatically; this is only for material that
// existed before the ranked feed. Run:  npm run backfill:feed
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Material from "../models/Material.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import Interaction from "../models/Interaction.js";
import { extractTopics } from "./feedRanking.js";

const BATCH = 200;

async function backfillTopics() {
  const courseText = new Map();
  const textFor = async (courseId) => {
    const key = String(courseId);
    if (!courseText.has(key)) {
      const c = await Course.findById(courseId).select("code title").lean();
      courseText.set(key, c ? `${c.code} ${c.title}` : "");
    }
    return courseText.get(key);
  };

  const cursor = Material.find({ $or: [{ topics: { $exists: false } }, { topics: { $size: 0 } }] })
    .select("title description courseId extractedText")
    .cursor();

  let ops = [];
  let done = 0;
  const flush = async () => {
    if (!ops.length) return;
    await Material.bulkWrite(ops);
    done += ops.length;
    ops = [];
  };
  for await (const m of cursor) {
    const topics = extractTopics({
      title: m.title,
      description: m.description,
      courseText: await textFor(m.courseId),
      body: m.extractedText,
    });
    ops.push({ updateOne: { filter: { _id: m._id }, update: { $set: { topics } } } });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  return done;
}

async function backfillBookmarkCounts() {
  const counts = await User.aggregate([{ $unwind: "$bookmarks" }, { $group: { _id: "$bookmarks", n: { $sum: 1 } } }]);
  for (let i = 0; i < counts.length; i += BATCH) {
    await Material.bulkWrite(
      counts.slice(i, i + BATCH).map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { bookmarkCount: c.n } } } }))
    );
  }
  return counts.length;
}

async function run() {
  await connectDB();
  await Promise.all([Material.init(), Interaction.init()]); // make sure the new indexes exist
  const topics = await backfillTopics();
  const bookmarks = await backfillBookmarkCounts();
  console.log(`✅ Backfill complete: topics added to ${topics} material(s), bookmark counts set on ${bookmarks} material(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
