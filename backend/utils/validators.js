export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

// Loose matric number check e.g. CSC/19/1234 or 19/CSC/1234 — adjust to your school's format
export function isValidMatric(matric) {
  return typeof matric === "string" && matric.trim().length >= 4;
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6;
}
