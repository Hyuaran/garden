const paths = {
  camera: "M4 7h4l2-3h4l2 3h4v13H4z M15 13a3 3 0 1 1-6 0 3 3 0 1 1 6 0z",
  image: "M3 4h18v16H3z M3 17l6-6 4 4 3-3 5 5 M16 8h.01",
  lock: "M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4 M12 15v2",
  scan: "M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4m4-7h8m-8 3h8m-8 3h5",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v6m4-6v6",
  person: "M16 8a4 4 0 1 1-8 0 4 4 0 1 1 8 0z M4 21a8 7 0 0 1 16 0",
  edit: "M13 5H5v15h14v-8M10 14l1-4 7-7 3 3-7 7z",
  clip: "M8 13l7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7l9-9m-5 11 7-7",
  repeat: "M3 10V6h15l-3-3m6 11v4H6l3 3",
  target: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M12 12h.01",
  bolt: "M13 2 4 14h7l-1 8 10-12h-7z",
  plug: "M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v5",
  flame: "M12 2c4 6 8 8 8 13a8 8 0 0 1-16 0c0-4 2-7 5-9 0 3 1 4 2 5 1-3 1-6 1-9z",
  document: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7",
  folder: "M3 6h7l2 3h9v11H3z",
};

export default function SalesIcon({ name }: { name: keyof typeof paths }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>;
}
