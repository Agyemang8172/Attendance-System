/** Business dates are calendar labels, not UTC midnights. */
export const businessDateAt = (instant: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const nextBusinessDate = (date: string): string => {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
};

/** First representable instant of a local date, including midnight gaps/overlaps. */
export const businessDateStart = (date: string, timezone: string): Date => {
  const anchor = Date.parse(`${date}T00:00:00.000Z`);
  let low = anchor - 48 * 60 * 60 * 1000;
  let high = anchor + 48 * 60 * 60 * 1000;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (businessDateAt(new Date(middle), timezone) < date) low = middle + 1;
    else high = middle;
  }
  if (businessDateAt(new Date(low), timezone) !== date) {
    throw new Error("Business date does not exist in this timezone");
  }
  return new Date(low);
};
