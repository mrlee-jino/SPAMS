/** Deterministic ID cursor avoids offset skips when new telemetry arrives. */
export async function collectPages<T extends { id: string }>(
  page: (after: string | null) => Promise<T[]>,
  maxRows = 100000,
) {
  const rows: T[] = [];
  let after: string | null = null;
  while (true) {
    const batch = await page(after);
    if (!batch.length) return rows;
    if (batch.some((row, i) => row.id <= (i ? batch[i - 1].id : (after ?? ""))))
      throw new Error("Pagination did not advance");
    rows.push(...batch);
    if (rows.length > maxRows)
      throw new Error(
        "Research window exceeds processing budget; narrow it or use an offline export",
      );
    after = batch.at(-1)!.id;
  }
}
export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const safe =
    typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
