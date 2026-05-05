/**
 * Minimal RFC 4180 CSV parser specialized for GTFS-Static feeds.
 *
 * GTFS files are UTF-8, comma-separated, optionally double-quoted, with CRLF
 * or LF line endings. We don't import a full CSV library because GTFS has only
 * a handful of columns and we want to control memory pressure on big feeds
 * (stop_times.txt can be 100s of MB for major operators).
 */

export interface CsvRow {
  [column: string]: string;
}

export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = splitLines(text);
  if (lines.length === 0) return rows;
  const header = parseLine(lines[0]).map((h) => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    const cells = parseLine(line);
    const row: CsvRow = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = (cells[j] ?? '').trim();
    rows.push(row);
  }
  return rows;
}

function splitLines(text: string): string[] {
  // Respect quoted newlines. GTFS rarely has them, but we handle correctly.
  const out: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      buf += c;
      // doubled "" is escaped quote inside quoted field
      if (inQuotes && text[i + 1] === '"') {
        buf += text[++i];
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++; // CRLF
      out.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === ',' && !inQuotes) {
      cells.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  cells.push(buf);
  return cells;
}
