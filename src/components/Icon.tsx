/* Stroke icon set used across MAT-AH (24 px grid, 1.75 stroke). */
const PATHS = {
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  ask: "M4 5h16v11H9l-5 4zM8 10h8M8 13h5",
  note: "M5 4h10l4 4v12H5zM15 4v4h4M8 13h8M8 16h5",
  organize: "M3 7h7l2 2h9v10H3zM12 12v5M9.5 14.5h5",
  clean: "M4 8h12v12H4zM8 4h12v12",
  settings:
    "M12 9a3 3 0 100 6 3 3 0 000-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
  check: "M5 12l5 5 9-10",
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  open: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  folder: "M3 7h7l2 2h9v10H3z",
  lock: "M5 10h14v10H5zM8 10V7a4 4 0 018 0v3",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  info: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5M12 16h.01",
  alert: "M12 3l9 16H3zM12 10v4M12 17h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  send: "M12 19V5M6 11l6-6 6 6",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  image: "M3 4h18v16H3zM9 8a2 2 0 100 4 2 2 0 000-4zM21 17l-5-5-9 8",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
  palette: "M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.5 0-.9-.7-1.3-.7-2.1 0-.8.7-1.4 1.5-1.4H17a4 4 0 004-4c0-5-4-9-9-9zM7.5 11h.01M10.5 7.5h.01M15 8h.01",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  sidebar: "M4 4h16v16H4zM9 4v16",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      className={`ic${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
