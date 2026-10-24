import mongoose from "mongoose";
// Aggregation pipelines do NOT cast strings to ObjectIds the way find() does.
// Anything that reaches a $match on an id field goes through this.
export const toObjectId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v?._id ?? v)));
