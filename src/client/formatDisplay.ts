const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric', month: 'short', year: 'numeric',
});

/** Format an ISO calendar date without interpreting it as a UTC timestamp. */
export function formatDisplayDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return isoDate;

  return thaiDateFormatter.format(date);
}
