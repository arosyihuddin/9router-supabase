const BLOCKED_HEADER_NAMES = new Set([
  "connection",
  "content-length",
  "host",
  "transfer-encoding",
  "upgrade",
]);

const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function normalizeCustomHeaders(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const headers = {};
  for (const [rawName, rawValue] of Object.entries(input)) {
    const name = String(rawName || "").trim();
    if (!name || !HEADER_NAME_RE.test(name)) continue;
    if (BLOCKED_HEADER_NAMES.has(name.toLowerCase())) continue;
    if (rawValue === undefined || rawValue === null) continue;

    const value = String(rawValue).trim();
    if (!value) continue;
    headers[name] = value;
  }
  return headers;
}

export function parseCustomHeadersText(text) {
  const headers = {};
  const errors = [];

  for (const [index, rawLine] of String(text || "").split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      errors.push(`Line ${index + 1}: use "Header-Name: value"`);
      continue;
    }

    const name = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    const normalized = normalizeCustomHeaders({ [name]: value });
    if (!Object.keys(normalized).length) {
      errors.push(`Line ${index + 1}: invalid or blocked header`);
      continue;
    }
    Object.assign(headers, normalized);
  }

  return { headers, errors };
}

export function formatCustomHeadersText(headers) {
  return Object.entries(normalizeCustomHeaders(headers))
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}
