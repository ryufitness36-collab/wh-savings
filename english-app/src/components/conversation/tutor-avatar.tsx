"use client";

import { cn } from "@/lib/utils";
import type { AiState, ConnectionStatus } from "@/hooks/use-realtime-conversation";

/** AI講師のアバター。状態（聞いている・考え中・話している）を動きで表す */
export function TutorAvatar({
  name,
  aiState,
  status,
  size = "lg",
}: {
  name: string;
  aiState: AiState;
  status: ConnectionStatus;
  size?: "md" | "lg";
}) {
  const connected = status === "connected";
  const speaking = connected && aiState === "speaking";
  const userSpeaking = connected && aiState === "user_speaking";
  const thinking = connected && aiState === "thinking";
  const dim = size === "lg" ? "size-36 md:size-44" : "size-20";

  return (
    <div className={cn("relative flex items-center justify-center", dim)} aria-hidden>
      {speaking && (
        <>
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20 [animation-delay:0.5s]" />
        </>
      )}
      {userSpeaking && <span className="absolute -inset-2 animate-pulse rounded-full border-4 border-success/60" />}
      <div
        className={cn(
          "relative flex size-full items-center justify-center overflow-hidden rounded-full shadow-lg transition-all duration-500",
          "bg-[radial-gradient(circle_at_30%_25%,oklch(0.85_0.08_195),oklch(0.55_0.11_200)_55%,oklch(0.38_0.09_230))]",
          connected ? "opacity-100" : "opacity-60 grayscale-[30%]",
          !speaking && connected && "animate-breathe",
        )}
      >
        {/* 顔（シンプルな抽象表現） */}
        <svg viewBox="0 0 100 100" className="size-[70%] text-white/95">
          <circle cx="36" cy="44" r={thinking ? 3 : 4.5} fill="currentColor" className="transition-all" />
          <circle cx="64" cy="44" r={thinking ? 3 : 4.5} fill="currentColor" className="transition-all" />
          {speaking ? (
            <ellipse cx="50" cy="66" rx="10" ry="7" fill="currentColor" className="origin-center animate-pulse" />
          ) : (
            <path d="M38 64 Q50 74 62 64" stroke="currentColor" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          )}
        </svg>
        <span className="sr-only">{name}</span>
      </div>
      {thinking && (
        <div className="absolute -bottom-1 flex gap-1 rounded-full bg-card px-2.5 py-1.5 shadow-md">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}
