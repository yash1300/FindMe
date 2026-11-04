export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam or phishing" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "illegal", label: "Illegal content" },
  { value: "adult", label: "Adult content" },
  { value: "other", label: "Something else" },
] as const;

export function reasonLabel(value: string): string {
  return REPORT_REASONS.find((item) => item.value === value)?.label ?? value;
}
