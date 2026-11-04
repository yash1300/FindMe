import { describe, expect, it } from "vitest";
import { csvCell, leadsToCsv } from "./csv";

describe("csvCell", () => {
  it("quotes values and doubles inner quotes", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell(null)).toBe('""');
  });

  it.each(["=HYPERLINK(1)", "+cmd", "-2+3", "@SUM(A1)", "\t=x", "\r=x"])("neutralises the formula %j", (value) => {
    expect(csvCell(value).startsWith(`"'`)).toBe(true);
  });

  it("keeps line breaks inside the quotes", () => {
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
});

describe("leadsToCsv", () => {
  it("adds a column for each custom field across all rows", () => {
    const base = { created_at: "2026-01-01", kind: "contact", email: "a@b.co", name: null, message: "hi", consent_text: "yes", consent_at: "2026-01-01" };
    const csv = leadsToCsv([
      { ...base, custom_fields: { Budget: "100" } },
      { ...base, email: "c@d.co", custom_fields: { City: "Pune" } },
      { ...base, email: "e@f.co", custom_fields: null },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Date","Type","Email","Name","Message","Budget","City","Consent","Consent date"');
    expect(lines[1]).toContain('"100",""');
    expect(lines[2]).toContain('"","Pune"');
    expect(lines).toHaveLength(4);
  });

  it("works with no rows", () => {
    expect(leadsToCsv([]).split("\r\n")).toHaveLength(1);
  });
});
