// Course Reps manage materials (upload/edit/download). Class Reps manage the
// course list (add/edit courses). Both are stored as role "rep" and
// distinguished by `repType`. Reps created before `repType` existed default
// to "course" via the schema, so this keeps their existing access working.
function requireRep(type) {
  return function (req, res, next) {
    if (req.user?.role !== "rep") {
      return res.status(403).json({ message: type === "class" ? "Class Rep access required." : "Course Rep access required." });
    }
    if (req.user?.repStatus !== "active") {
      return res.status(403).json({ message: "Your Rep application is still pending approval." });
    }
    if ((req.user?.repType || "course") !== type) {
      return res.status(403).json({ message: type === "class" ? "Class Rep access required." : "Course Rep access required." });
    }
    next();
  };
}

export const repApprovedMiddleware = requireRep("course");
export const classRepApprovedMiddleware = requireRep("class");
