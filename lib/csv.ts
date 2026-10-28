// CSV for spreadsheets: UTF-8 with a BOM (so Excel reads Unicode names), CRLF line ends, every
// text cell quoted. Text starting with = + - @ tab or CR gets a leading ' so a spreadsheet shows
// it instead of running it as a formula (CSV injection). Numbers are written bare so they stay
// numeric for sums.

export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
