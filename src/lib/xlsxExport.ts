/**
 * XLSX export utility.
 *
 * Generates a properly formatted Excel spreadsheet with frozen header row,
 * auto-filters, sensible column widths, and preserved identifiers/URLs.
 */
import * as XLSX from "xlsx";

/** Trigger a browser download of an XLSX file. */
export function downloadXlsx(
  headers: string[],
  rows: Record<string, string>[],
  filename: string,
): void {
  // Build the worksheet data as an array of arrays
  const data: (string | number)[][] = [];

  // Header row
  data.push(headers);

  // Data rows
  for (const row of rows) {
    data.push(headers.map((h) => row[h] ?? ""));
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Freeze the header row
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as XLSX.CellObject;

  // Set column widths based on header length and content
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.slice(0, 100).map((row) => (row[h] ?? "").length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  worksheet["!cols"] = colWidths;

  // Add auto-filter
  if (headers.length > 0 && rows.length > 0) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: headers.length - 1 },
      }),
    };
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  // Trigger download
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
