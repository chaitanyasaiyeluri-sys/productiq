/**
 * CSV export utility.
 *
 * Generates a valid UTF-8 CSV file from an array of output rows.
 * Handles commas, quotes, newlines, unicode, and leading zeros.
 */

/** Escape a single CSV cell value. */
function escapeCell(value: string): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If the value contains commas, quotes, or newlines, wrap in quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Generate a CSV string from headers and rows. */
export function generateCsv(
  headers: string[],
  rows: Record<string, string>[],
): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(escapeCell).join(","));

  // Data rows
  for (const row of rows) {
    const cells = headers.map((h) => escapeCell(row[h] ?? ""));
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}

/** Trigger a browser download of a CSV file. */
export function downloadCsv(
  headers: string[],
  rows: Record<string, string>[],
  filename: string,
): void {
  const csv = generateCsv(headers, rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
