export function supplyPoint(value: string) {
  const digits = (value.match(/[0-9]/g) ?? []).length;
  if (!/^[0-9]{22}$/.test(value)) {
    return { error: `22 桁で入力してください（今 ${digits} 桁）` };
  }
  // 例 06 01 551553880322001020 の「01」。中央14桁は先頭4桁と末尾4桁を除く。
  return { schedule: value.slice(2, 4), middle: value.slice(4, 18) };
}

export type CalendarDay = { schedule: string; date: string };

export function nextSupplyDay(days: CalendarDay[], schedule: string, from: string) {
  const end = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return null;
  const dayOfMonth = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 3, 0);
  end.setUTCDate(Math.min(dayOfMonth, end.getUTCDate()));
  const through = end.toISOString().slice(0, 10);
  return days.reduce<string | null>((earliest, day) => {
    if (day.schedule !== schedule || day.date < from || day.date > through) return earliest;
    return !earliest || day.date < earliest ? day.date : earliest;
  }, null);
}
