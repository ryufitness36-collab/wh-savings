"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";

const ORDER = ["system", "light", "dark"] as const;
const LABEL = { system: "端末の設定に合わせる", light: "ライトモード", dark: "ダークモード" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = (mounted ? theme : "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={`表示：${LABEL[current]}（クリックで切り替え）`} title={LABEL[current]}>
      <Icon />
    </Button>
  );
}
