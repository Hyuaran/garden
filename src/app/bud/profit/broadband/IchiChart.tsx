"use client";
import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { Bar, Line } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);
export default function IchiChart({ title, labels, series, line = false, stacked = false }: {
  title: string; labels: string[]; series: { label: string; values: (number | null)[] }[]; line?: boolean; stacked?: boolean;
}) {

  const [theme, setTheme] = useState({
    ink: "#6d6356", grid: "#b4a58255", colors: ["#9eb35f",
      "#d5ac4f",
      "#6f9b70",
      "#8ab4cc"]
  });

  useEffect(() => {

    const update = () => {

      const css = getComputedStyle(document.documentElement);

      const read = (key: string, fallback: string) => css.getPropertyValue(key).trim() || fallback;

      setTheme({
        ink: read("--text-main", "#6d6356"), grid: read("--border-soft", "#b4a58255"), colors: [read("--accent-green", "#9eb35f"),
        read("--accent-gold", "#d5ac4f"),
        read("--accent-blue", "#8ab4cc"),
        read("--accent-green-d", "#6f9b70")]
      });
    };

    update();

    const observer = new MutationObserver(update);

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });

    return () => observer.disconnect();
  }, []);

  const data = { labels, datasets: series.map((s, i) => ({ label: s.label, data: s.values, backgroundColor: theme.colors[i % theme.colors.length], borderColor: theme.colors[i % theme.colors.length], borderWidth: 2, spanGaps: false })) };

  const options = {
    responsive: true, maintainAspectRatio: false, animation: false as const,
    plugins: { legend: { labels: { color: theme.ink } } },
    scales: { x: { stacked, ticks: { color: theme.ink }, grid: { color: theme.grid } }, y: { stacked, ticks: { color: theme.ink }, grid: { color: theme.grid } } },
  };

  return <figure>
    <figcaption>
      {title}</figcaption>
    <div style={{ height: 280 }}>
      {line ? <Line aria-label={title} role="img" data={data} options={options} /> : <Bar aria-label={title} role="img" data={data} options={options} />}</div></figure>;
}
