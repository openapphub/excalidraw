/** IndexedDB 画布 id：`crypto.randomUUID()`（8-4-4-4-12）。 */
const INDEXED_DB_CANVAS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isIndexedDbCanvasId = (id: string | null | undefined): boolean =>
  typeof id === "string" && INDEXED_DB_CANVAS_ID_RE.test(id);

/** 已登录后允许写入后端 SQLite 的 id（ULID / nanoid / ai-*）。UUID 禁止 upsert。 */
export const isBackendPersistableCanvasId = (
  id: string | null | undefined,
): id is string =>
  typeof id === "string" && id.length > 0 && !isIndexedDbCanvasId(id);
