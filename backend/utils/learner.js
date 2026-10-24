// "Independent learner" = a signed-in student who chose not to join a school.
// They keep a private library and the AI tools; they never see school-owned
// courses or materials. One helper so every endpoint agrees on the definition.
export const isIndependent = (user) => user?.learnerType === "independent";
export const hasSchool = (user) => Boolean(user?.schoolId);
