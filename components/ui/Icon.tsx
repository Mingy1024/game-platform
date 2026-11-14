const paths = {
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm5-2l4 4",
  heart:
    "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  volume: "M4 10v4h3l5 4V6L7 10H4zm12-1a4 4 0 0 1 0 6m2.5-9a8 8 0 0 1 0 12",
  pause: "M9 5v14M15 5v14",
  restart: "M5 12a7 7 0 1 0 2.2-5.1M5 4v4h4",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  left: "M14 6l-6 6 6 6",
  right: "M10 6l6 6-6 6",
  touch:
    "M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L5 15a1.5 1.5 0 0 1 2.5-1.6L9 15v-4",
  keyboard: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8",
  clock: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zm0-14v5l3 2",
  device: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 15h2",
} as const;

export type IconName = keyof typeof paths;

/** 裝飾用線條圖示；需要語意時由外層按鈕或連結提供文字。 */
export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
