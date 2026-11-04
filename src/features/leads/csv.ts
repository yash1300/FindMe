export type LeadRow = {
  created_at: string;
  kind: string;
  email: string;
  name: string | null;
  message: string | null;
  consent_text: string;
  consent_at: string;
  custom_fields: Record<string, string> | null;
};

/**
 * Quotes a value for CSV. Spreadsheets run cells starting with these characters as formulas, and
 * this data comes from strangers, so they're neutralised with a leading apostrophe.
 */
export function csvCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function leadsToCsv(leads: LeadRow[]): string {
  const customLabels = [...new Set(leads.flatMap((lead) => Object.keys(lead.custom_fields ?? {})))].sort();
  const header = ["Date", "Type", "Email", "Name", "Message", ...customLabels, "Consent", "Consent date"];
  const rows = leads.map((lead) => [
    lead.created_at, lead.kind, lead.email, lead.name, lead.message,
    ...customLabels.map((label) => lead.custom_fields?.[label] ?? ""),
    lead.consent_text, lead.consent_at,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
