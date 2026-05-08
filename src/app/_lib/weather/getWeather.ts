/**
 * getWeather.ts — 時刻ベースで天気を返す utility (Garden v2.8a)
 *
 * 仕様:
 *   - 6 種: sunny / partly / cloudy / rain / snow / thunder
 *   - prototype の autoWeatherByHour() を拡張（深夜帯に snow を追加、demo 演出）
 *   - 時刻外 API は不要、決定論的（同じ hour に対しては決定論ではないが
 *     夜のランダム以外は決定論）
 *   - 各 kind に対応する image path / 日本語ラベルを export
 */

export type WeatherKind =
  | "sunny"
  | "partly"
  | "cloudy"
  | "rain"
  | "snow"
  | "thunder";

/** 時刻 (0-23) から WeatherKind を返す */
export function getWeatherByHour(hour: number): WeatherKind {
  // 早朝 5-9: partly cloudy（朝もや）
  if (hour >= 5 && hour < 9) return "partly";
  // 昼 9-12: sunny
  if (hour >= 9 && hour < 12) return "sunny";
  // 午後 12-16: partly
  if (hour >= 12 && hour < 16) return "partly";
  // 夕方 16-19: cloudy
  if (hour >= 16 && hour < 19) return "cloudy";
  // 夜 19-23: rain or thunder（demo 演出、ランダム）
  if (hour >= 19 && hour < 23) {
    return Math.random() < 0.7 ? "rain" : "thunder";
  }
  // 深夜 23-5: snow（demo 演出）
  return "snow";
}

/** WeatherKind から画像 path を返す */
export function getWeatherIconPath(kind: WeatherKind): string {
  const map: Record<WeatherKind, string> = {
    sunny: "/images/header_icons/weather_01_sunny.png",
    partly: "/images/header_icons/weather_02_partly_cloudy.png",
    cloudy: "/images/header_icons/weather_03_cloudy.png",
    rain: "/images/header_icons/weather_04_rain.png",
    snow: "/images/header_icons/weather_05_snow.png",
    thunder: "/images/header_icons/weather_06_thunder.png",
  };
  return map[kind];
}

/** WeatherKind の日本語ラベル */
export const WEATHER_LABELS: Record<WeatherKind, string> = {
  sunny: "晴れ",
  partly: "晴れ時々曇り",
  cloudy: "曇り",
  rain: "雨",
  snow: "雪",
  thunder: "雷",
};

/** WeatherKind 一覧 (UI で全種類描画する場合などに使う) */
export const WEATHER_KINDS: ReadonlyArray<WeatherKind> = [
  "sunny",
  "partly",
  "cloudy",
  "rain",
  "snow",
  "thunder",
];
