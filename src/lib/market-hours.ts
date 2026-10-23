const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * NYSE regular session (09:30–16:00 ET, Mon–Fri). Exchange holidays are not
 * modelled; on those days the quote provider simply returns the last close.
 */
export function isUsMarketOpen(now: Date = new Date()): boolean {
  const parts = Object.fromEntries(
    ET_PARTS.formatToParts(now).map((part) => [part.type, part.value]),
  );
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
