import { gradeKind, type RouteStop } from "@/lib/games/precise-stop/route";
import { fmt } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { u, type GameText } from "./shared";

export function gradeLabel(stop: RouteStop, text: GameText): string {
  const kind = gradeKind(stop.grade);
  if (kind === "flat") return text.grade.flat;
  const value = Math.round(Math.abs(stop.grade) * 1000) / 10;
  return fmt(kind === "up" ? text.grade.upValue : text.grade.downValue, { value });
}

export function shortGrade(stop: RouteStop, text: GameText) {
  const kind = gradeKind(stop.grade);
  return kind === "flat" ? text.grade.flat : kind === "up" ? text.grade.up : text.grade.down;
}

/** 估算文字寬度（以一個漢字寬為 1）：漢字、假名、韓文算 1，其他字母約 0.6 */
export function textUnits(value: string): number {
  return [...value].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? 1 : 0.6), 0);
}

/** 站名、坡度只用漢字或假名的語言，5 站橫排在手機上也放得下 */
export const COMPACT_SCRIPT: Locale[] = ["zh-TW", "zh-CN", "ja"];

export const pill = (background: string, color = "#fff") => ({
  padding: `${u(4)} ${u(12)}`,
  borderRadius: "999px",
  background,
  color,
  fontSize: u(14),
  fontWeight: 900,
  whiteSpace: "nowrap" as const,
});

export const chip = {
  padding: `${u(3)} ${u(10)}`,
  borderRadius: "999px",
  background: "rgba(255,255,255,0.88)",
  color: "#14171f",
  fontSize: u(13),
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

export const cornerButton = {
  width: u(44),
  height: u(44),
  minWidth: "44px",
  minHeight: "44px",
  borderRadius: u(12),
  background: "rgba(16,19,26,0.75)",
};
