/** Fills the `{{placeholder}}` slots in a preset's email template. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}
