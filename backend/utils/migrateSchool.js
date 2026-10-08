// One-time migration: backfills `schoolId` onto every existing User, Course
// and Material row so multi-tenancy can be turned on without breaking
// existing data.
//
// Run this AFTER `schoolId` has been added to the schemas as OPTIONAL, and
// BEFORE flipping it to `required: true` — three separate deploys, not one:
//   1. Deploy with `schoolId` optional on User/Course/Material.
//   2. Run this script once:  npm run migrate:school
//   3. Deploy again with `schoolId` flipped to `required: true`.
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import School from "../models/School.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Material from "../models/Material.js";

async function run() {
  await connectDB();

  let school = await School.findOne({ name: "Default School" });
  if (!school) {
    school = await School.create({ name: "Default School", verified: true });
    console.log("Created 'Default School' as the home for pre-existing data.");
  }

  const [userResult, courseResult, materialResult] = await Promise.all([
    User.updateMany({ schoolId: { $exists: false } }, { schoolId: school._id }),
    Course.updateMany({ schoolId: { $exists: false } }, { schoolId: school._id }),
    Material.updateMany({ schoolId: { $exists: false } }, { schoolId: school._id }),
  ]);

  console.log("Backfilled schoolId onto existing data:", school._id.toString());
  console.log(`  Users updated:     ${userResult.modifiedCount}`);
  console.log(`  Courses updated:   ${courseResult.modifiedCount}`);
  console.log(`  Materials updated: ${materialResult.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
