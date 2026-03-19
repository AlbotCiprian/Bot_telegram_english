const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function normalizePhone(value: string): string {
  const normalized = value.replace(/[^\d+]/g, "");
  if (normalized.startsWith("00")) {
    return `+${normalized.slice(2)}`;
  }

  if (normalized.startsWith("373")) {
    return `+${normalized}`;
  }

  return normalized;
}

export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  return /^\+?\d{8,15}$/.test(normalized);
}

export function parseBooleanChoice(value: string): boolean | null {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (["da", "yes", "accept", "accepta", "acceptă", "sunt de acord", "vreau"].includes(normalized)) {
    return true;
  }

  if (["nu", "no", "refuz", "nu vreau"].includes(normalized)) {
    return false;
  }

  return null;
}
