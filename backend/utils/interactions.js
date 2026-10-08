import Interaction from "../models/Interaction.js";
import Material from "../models/Material.js";
import { topicsOf } from "./feedRanking.js";

const VIEW_COUNT_COOLDOWN_MS = 30 * 60 * 1000; // one person refreshing a page isn't 20 views

// Records what a user did with a material. Fire-and-forget: it must never
// slow down or fail the request that triggered it, so errors are only logged.
//
//   kind: "view" | "download" | "quiz" | "bookmark" | "unbookmark"
export function trackInteraction(user, material, kind) {
  if (!user?._id || !material?._id) return;
  run(user, material, kind).catch((err) => console.error("trackInteraction failed:", err.message));
}

async function run(user, material, kind) {
  const inc = {};
  const set = { lastAt: new Date() };
  if (kind === "view") inc.views = 1;
  else if (kind === "download") inc.downloads = 1;
  else if (kind === "quiz") inc.quizzes = 1;
  else if (kind === "bookmark") set.bookmarked = true;
  else if (kind === "unbookmark") set.bookmarked = false;
  else return;

  const update = {
    $set: set,
    $setOnInsert: { course: material.courseId?._id || material.courseId, topics: topicsOf(material) },
  };
  if (Object.keys(inc).length) update.$inc = inc;

  const previous = await Interaction.findOneAndUpdate(
    { user: user._id, material: material._id },
    update,
    { upsert: kind !== "unbookmark", new: false }
  );

  // Public view counter (a feed-ranking signal) — throttled per person.
  if (kind === "view" && (!previous || Date.now() - new Date(previous.lastAt).getTime() > VIEW_COUNT_COOLDOWN_MS)) {
    await Material.updateOne({ _id: material._id }, { $inc: { viewCount: 1 } });
  }
}

/** Latest activity, used to build the interest profile and the "already seen" set. */
export function recentInteractions(userId, limit = 150) {
  return Interaction.find({ user: userId })
    .sort({ lastAt: -1 })
    .limit(limit)
    .select("material topics views downloads quizzes bookmarked lastAt")
    .lean();
}
