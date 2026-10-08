// One place for pagination so every list endpoint behaves the same way.
//
// Two styles, one response contract. Every paginated endpoint returns
//   { <items key>: [...], pagination: { limit, hasMore, ...style-specific } }
// so the frontend can read `pagination.hasMore` no matter which style is used.
//
//  1. PAGE-BASED  (?page=2&limit=20)
//     For tables and management lists (admin, my uploads, approvals, courses).
//     pagination = { page, limit, total, totalPages, hasNext, hasPrev, hasMore }
//
//  2. CURSOR-BASED  (?cursor=<opaque>&limit=12)
//     For the infinite-scroll feeds. The cursor is an opaque token; the client
//     just hands back `pagination.nextCursor` to get the next batch.
//     pagination = { limit, hasMore, nextCursor }
//     The cursor pins a snapshot time (`asOf`) so items uploaded while someone
//     is scrolling don't shift the list under them and cause repeats.

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

const toInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

// ---------- page-based ----------------------------------------------------

export function parsePageParams(query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const page = Math.max(1, toInt(query.page, 1));
  const limit = Math.min(maxLimit, Math.max(1, toInt(query.limit, defaultLimit)));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNext = page < totalPages;
  return { page, limit, total, totalPages, hasNext, hasPrev: page > 1, hasMore: hasNext };
}

/**
 * Runs `Model.find(filter)` with page/limit and returns { items, pagination }.
 *
 *   const { items, pagination } = await paginate(User, filter, req.query, {
 *     sort: { createdAt: -1 }, select: "-password",
 *     populate: [["uploadedBy", "name"]],
 *   });
 *
 * `_id` is always appended to the sort so ordering is stable between pages
 * (without a unique tiebreaker, rows with equal sort values can repeat or
 * vanish across pages).
 */
export async function paginate(Model, filter, query, {
  sort = { createdAt: -1 },
  select,
  populate = [],
  lean = false,
  defaultLimit,
  maxLimit,
} = {}) {
  const { page, limit, skip } = parsePageParams(query, { defaultLimit, maxLimit });
  const stableSort = { ...sort, _id: -1 };

  let q = Model.find(filter).sort(stableSort).skip(skip).limit(limit);
  if (select) q = q.select(select);
  for (const args of populate) q = q.populate(...(Array.isArray(args) ? args : [args]));
  if (lean) q = q.lean();

  const [items, total] = await Promise.all([q, Model.countDocuments(filter)]);
  return { items, pagination: pageMeta({ page, limit, total }) };
}

/** Same contract for an already-materialised array (e.g. a filtered id list). */
export function paginateArray(all, query, opts = {}) {
  const { page, limit, skip } = parsePageParams(query, opts);
  return { items: all.slice(skip, skip + limit), pagination: pageMeta({ page, limit, total: all.length }) };
}

// ---------- cursor-based (feeds) -------------------------------------------

const MAX_FEED_OFFSET = 5000; // hard stop so a crafted cursor can't request an absurd skip

export const encodeCursor = (payload) => Buffer.from(JSON.stringify(payload)).toString("base64url");

export function decodeCursor(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Reads ?cursor & ?limit. A missing/garbled cursor simply means "first page",
 * so a bad token can never break the feed.
 * Returns { limit, offset, asOf } — `asOf` is the snapshot time (ms).
 */
export function parseFeedParams(query = {}, { defaultLimit = 12, maxLimit = 30 } = {}) {
  const limit = Math.min(maxLimit, Math.max(1, toInt(query.limit, defaultLimit)));
  const now = Date.now();
  const c = decodeCursor(query.cursor);
  if (!c) return { limit, offset: 0, asOf: now };

  const offset = Math.min(MAX_FEED_OFFSET, Math.max(0, toInt(c.o, 0)));
  const asOfRaw = toInt(c.t, now);
  const asOf = asOfRaw > now || asOfRaw <= 0 ? now : asOfRaw;
  return { limit, offset, asOf };
}

/** Builds the `pagination` block for a cursor feed. */
export function feedMeta({ limit, offset, asOf, hasMore }) {
  const next = offset + limit;
  return {
    limit,
    hasMore: !!hasMore && next < MAX_FEED_OFFSET,
    nextCursor: hasMore && next < MAX_FEED_OFFSET ? encodeCursor({ t: asOf, o: next }) : null,
  };
}

/** Slices an in-memory ranked list for a cursor feed. */
export function sliceFeed(ranked, { limit, offset, asOf }) {
  const items = ranked.slice(offset, offset + limit);
  return { items, pagination: feedMeta({ limit, offset, asOf, hasMore: offset + limit < ranked.length }) };
}
