/**
 * Returns the URL as a string if it is a valid http(s) URL, otherwise undefined.
 * Other schemes (javascript:, data:, ...) are rejected so they can never be rendered as links.
 */
export function toSafeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
