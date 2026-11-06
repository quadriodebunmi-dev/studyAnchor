import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// One entry on the education calendar: an exam, a deadline, a holiday, a class…
//
//  scope "personal"  only the creator sees it (any student, rep or independent learner).
//  scope "school"    shared with a school. Created by that school's Course/Class Reps.
//                    `department` / `level` narrow who it is for; blank = everyone at the school.
//                    An admin may leave `schoolId` empty to publish a platform-wide date.
//
// All-day events are stored at UTC midnight of their date; timed events hold the real instant.
const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 600, default: "" },
    type: {
      type: String,
      enum: ["exam", "test", "assignment", "class", "registration", "holiday", "deadline", "other"],
      default: "other",
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    allDay: { type: Boolean, default: true },

    scope: { type: String, enum: ["personal", "school"], default: "personal" },
    createdBy: { type: ObjectId, ref: "User", required: true },
    schoolId: { type: ObjectId, ref: "School" },
    department: { type: String, trim: true, maxlength: 80, default: "" },
    level: { type: Number, enum: [100, 200, 300, 400, 500, 600] },
    courseId: { type: ObjectId, ref: "Course" },

    // Set once the "starting soon" reminder has gone out, so it is sent exactly once.
    remindedAt: { type: Date },
  },
  { timestamps: true }
);

calendarEventSchema.index({ startsAt: 1 });
calendarEventSchema.index({ scope: 1, schoolId: 1, startsAt: 1 });
calendarEventSchema.index({ createdBy: 1, startsAt: 1 });
calendarEventSchema.index({ remindedAt: 1, startsAt: 1 });

export default mongoose.model("CalendarEvent", calendarEventSchema);
