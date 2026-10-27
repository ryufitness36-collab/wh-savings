"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { ApiKeyNotice } from "./api-key-notice";
import { OfflineBanner } from "./offline-banner";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M5 16c2.5-6 4.5-9 7-9s4.5 3 7 9" />
          <circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span>Hello Coach</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // ログイン画面と会話中の画面はナビゲーションを最小限にする
  const isLogin = pathname === "/login";
  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-dvh md:pl-60">
      {/* PC: 左サイドバー */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card/60 px-4 py-5 backdrop-blur md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="メインメニュー">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
                  active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-1 px-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild aria-label="設定">
            <Link href="/settings">
              <Settings />
            </Link>
          </Button>
        </div>
      </aside>

      {/* スマホ: 上部ヘッダー */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-lg md:hidden">
        <Logo />
        <div className="flex items-center">
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild aria-label="設定">
            <Link href="/settings">
              <Settings />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">
        <OfflineBanner />
        <ApiKeyNotice />
        {/* 画面切り替え時のやわらかいフェードイン */}
        <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          {children}
        </div>
      </main>

      {/* スマホ: 下部タブバー */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
        aria-label="メインメニュー"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10.5px] transition-colors",
                active ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
