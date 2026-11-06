import User from "../models/User.js";
import Course from "../models/Course.js";
import { notifyMany } from "./notify.js";

/**
 * Tells students a new shared material is available for a course they take:
 * same school, same department and level as the course. Never includes the
 * uploader, never private/pending material, capped so one upload can't fan out forever.
 */
export async function notifyNewMaterial(material, { cap = 2000 } = {}) {
  try {
    if (!material || material.visibility === "private" || material.status !== "approved" || !material.courseId) return 0;
    const course = await Course.findById(material.courseId).select("code title schoolId department level");
    if (!course || !course.schoolId) return 0;
    const users = await User.find({
      role: "student", schoolId: course.schoolId, department: course.department, level: course.level,
      suspended: { $ne: true }, _id: { $ne: material.uploadedBy },
    }).select("_id").limit(cap).lean();
    return await notifyMany(users.map((u) => u._id), {
      category: "materials", type: "new_material",
      title: material.kind === "past_question" ? `New past question for ${course.code}` : `New material for ${course.code}`, body: material.title,
      link: `/material/${material._id}`, dedupeKey: `material:${material._id}:new`,
    });
  } catch (err) {
    console.error("notifyNewMaterial failed:", err.message);
    return 0;
  }
}
