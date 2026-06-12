/** Simple `{key}` interpolation compatible with next-intl message strings. */
export function formatMessage(
  template: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
