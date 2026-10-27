/** CSV cells for the admin exports (pure). */

/** A text cell: quoted, and kept from being read as a formula by a spreadsheet (names and emails are typed by traders). */
export function csvText(value: string | null | undefined): string {
  const text = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Rupees from paise, plain for spreadsheets: 1234.50, -12.00. */
export const csvRupees = (paise: number) => (paise / 100).toFixed(2);
