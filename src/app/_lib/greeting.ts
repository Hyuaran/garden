export type GardenGreeting =
  | "おはようございます"
  | "こんにちは"
  | "お疲れさまです";

export function getGreeting(date: Date): GardenGreeting {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return "おはようございます";
  if (hour >= 10 && hour < 17) return "こんにちは";
  return "お疲れさまです";
}
