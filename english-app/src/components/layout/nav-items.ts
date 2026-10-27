import { BookOpenCheck, House, LineChart, MessagesSquare, PenLine } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: House },
  { href: "/conversation", label: "AI英会話", icon: MessagesSquare },
  { href: "/grammar", label: "英文法", icon: BookOpenCheck },
  { href: "/writing", label: "英作文", icon: PenLine },
  { href: "/progress", label: "学習記録", icon: LineChart },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
