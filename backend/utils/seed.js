// Run with: npm run seed
// Seeds a demo admin, an active course rep, a pending rep application,
// a demo student, and the sample courses/materials from the project guide.
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Material from "../models/Material.js";
import School from "../models/School.js";
import mongoose from "mongoose";
import { extractTopics } from "./feedRanking.js";

const SESSION = "2025/2026";

async function seed() {
  await connectDB();

  await Promise.all([User.deleteMany({}), Course.deleteMany({}), Material.deleteMany({}), School.deleteMany({})]);

  // Two schools so the Explore "my school / all schools" toggle and the
  // profile "change school" flow have something to show.
  const school = await School.create({ name: "Demo University", city: "Lagos", verified: true });
  const otherSchool = await School.create({ name: "Second Demo Institute", city: "Abuja", verified: true });

  const password = await bcrypt.hash("demo123", 10);
  const adminPassword = await bcrypt.hash("admin123", 10);

  const admin = await User.create({ name: "Admin User", email: "admin@demo.edu", password: adminPassword, role: "admin" });
  const rep = await User.create({
    name: "John Okafor", email: "john@demo.edu", password, matricNumber: "CSC/18/0098",
    department: "Computer Science", level: 100, session: SESSION, repCourses: "CSC101, CSC102, CSC201", role: "rep", repStatus: "active", repType: "course", schoolId: school._id,
  });
  await User.create({
    name: "Grace Udo", email: "grace@demo.edu", password, matricNumber: "ACC/20/0451",
    department: "Accounting", role: "rep", repStatus: "pending", repCourses: "ACC101", session: SESSION, repType: "course", schoolId: school._id,
    repNote: "I'm the class representative and can keep materials current for our set.",
  });
  await User.create({
    name: "Tunde Balogun", email: "tunde@demo.edu", password, matricNumber: "CSC/18/0077",
    department: "Computer Science", level: 100, session: SESSION, role: "rep", repStatus: "active", repType: "class", schoolId: school._id,
    repNote: "Class rep for CSC 100L — keeping the course list up to date.",
  });
  await User.create({
    name: "Aisha Bello", email: "aisha@demo.edu", password, matricNumber: "CSC/19/1234",
    department: "Computer Science", level: 100, semester: "First Semester", session: SESSION, role: "student", schoolId: school._id,
  });

  const courses = await Course.insertMany([
    { code: "CSC101", title: "Introduction to Programming", department: "Computer Science", level: 100, semester: "First Semester", session: SESSION },
    { code: "CSC102", title: "Introduction to Computer Science", department: "Computer Science", level: 100, semester: "First Semester", session: SESSION },
    { code: "MTH101", title: "Elementary Mathematics I", department: "Computer Science", level: 100, semester: "First Semester", session: SESSION },
    { code: "CSC201", title: "Data Structures & Algorithms", department: "Computer Science", level: 200, semester: "First Semester", session: SESSION },
    { code: "ACC101", title: "Principles of Accounting I", department: "Accounting", level: 100, semester: "First Semester", session: SESSION },
    { code: "MCM101", title: "Introduction to Mass Communication", department: "Mass Communication", level: 100, semester: "First Semester", session: SESSION },
    // A prior session too, so the session filter/sort has something to show.
    { code: "CSC101", title: "Introduction to Programming", department: "Computer Science", level: 100, semester: "First Semester", session: "2024/2025" },
    { code: "CSC101", title: "Introduction to Programming", department: "Computer Science", level: 100, semester: "First Semester", session: SESSION, schoolId: otherSchool._id },
  ].map((c) => ({ schoolId: school._id, ...c })));

  const handmade = [
    { courseId: courses[0]._id, uploadedBy: rep._id, schoolId: school._id, title: "Lecture 1 — Introduction to Programming Concepts", description: "Overview of programming basics, variables and control flow.", fileUrl: "https://example.com/lecture1.pptx", fileName: "Lecture1.pptx", fileType: "pptx", size: "3.4 MB", downloads: 42, bookmarkCount: 9, viewCount: 120, quizzesGenerated: 18 },
    { courseId: courses[0]._id, uploadedBy: rep._id, schoolId: school._id, title: "Assignment 1 Guide — Flowcharts & Pseudocode", description: "Step-by-step guide for the first assignment.", fileUrl: "https://example.com/assignment1.pdf", fileName: "Assignment1.pdf", fileType: "pdf", size: "850 KB", downloads: 25, bookmarkCount: 4, viewCount: 80 },
    { courseId: courses[1]._id, uploadedBy: rep._id, schoolId: school._id, title: "Number Systems & Binary Arithmetic", description: "Binary, octal, hexadecimal conversions with examples.", fileUrl: "https://example.com/numbers.pdf", fileName: "Numbers.pdf", fileType: "pdf", size: "2.0 MB", downloads: 31, bookmarkCount: 6, viewCount: 95 },
    // A material at the second school, so the all-schools Explore feed has another school to group.
    { courseId: courses[7]._id, uploadedBy: rep._id, schoolId: otherSchool._id, title: "CSC101 — Programming Basics (Second Demo Institute)", description: "Intro programming notes from the other school.", fileUrl: "https://example.com/other.pdf", fileName: "Other.pdf", fileType: "pdf", size: "1.1 MB", downloads: 12, bookmarkCount: 2, viewCount: 30 },
  ];

  // A few dozen more, spread over several courses and dates with varied
  // popularity, so pagination, infinite scroll and the ranked feed have
  // something real to chew on.
  const TOPICS = [
    "Variables and Data Types", "Control Flow and Loops", "Functions and Recursion", "Arrays and Strings", "Sorting Algorithms",
    "Searching Algorithms", "Linked Lists", "Stacks and Queues", "Binary Trees", "Graph Traversal", "Boolean Algebra",
    "Logic Gates", "Computer Architecture", "Operating Systems Basics", "Database Fundamentals", "Set Theory", "Matrices and Determinants",
    "Limits and Continuity", "Differentiation", "Integration Techniques", "Probability Basics", "Double-Entry Bookkeeping",
    "Trial Balance Practice", "Journalism Ethics", "News Writing", "Media Law", "Past Questions 2023", "Past Questions 2024",
    "Revision Summary", "Lab Manual", "Tutorial Sheet",
  ];
  const generated = TOPICS.map((topic, i) => {
    const course = courses[i % 6]; // the first six courses belong to Demo University
    return {
      courseId: course._id, uploadedBy: rep._id, schoolId: school._id,
      title: `${course.code} — ${topic}`,
      description: `${topic} notes for ${course.title}.`,
      fileUrl: `https://example.com/seed-${i}.pdf`, fileName: `seed-${i}.pdf`, fileType: "pdf", size: `${(1 + (i % 7) * 0.4).toFixed(1)} MB`,
      downloads: (i * 7) % 60, bookmarkCount: (i * 3) % 12, viewCount: (i * 11) % 150, quizzesGenerated: (i * 5) % 20,
      createdAt: new Date(Date.now() - i * 2.5 * 24 * 60 * 60 * 1000),
    };
  });

  await Material.insertMany(
    [...handmade, ...generated].map((m) => ({
      ...m,
      topics: extractTopics({ title: m.title, description: m.description }),
    }))
  );

  console.log("✅ Seed complete. Demo logins: admin@demo.edu / admin123, john@demo.edu / demo123 (course rep), tunde@demo.edu / demo123 (class rep), aisha@demo.edu / demo123 (student)");
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
