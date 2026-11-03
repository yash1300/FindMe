type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|service[-_]?role/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? "[redacted]" : sanitize(item, depth + 1),
      ]),
    );
  }
  return value;
}

function write(level: Level, event: string, fields?: Fields) {
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...(sanitize(fields ?? {}) as Fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Structured JSON logs. `event` is a stable dotted name; never log emails or other personal data. */
export const logger = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
