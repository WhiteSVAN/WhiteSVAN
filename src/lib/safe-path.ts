/** A path on this site to return to, or null: one leading slash, no scheme, host, backslash or space. */
export function safeNextPath(value: string | null | undefined): string | null {
  return value && value.length <= 200 && /^\/(?![/\\])[^\s\\]*$/.test(value) ? value : null;
}
