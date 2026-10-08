// Makes user input safe to use inside `new RegExp(...)`. Without this, a
// search like "(" throws, and a crafted pattern can hang the database.
export const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
