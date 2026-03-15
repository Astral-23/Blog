const DISPLAY_LOCALE = "ja-JP";
const DISPLAY_TIME_ZONE = "Asia/Tokyo";

export function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeZone: DISPLAY_TIME_ZONE }).format(date);
}
