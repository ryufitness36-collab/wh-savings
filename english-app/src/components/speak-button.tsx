"use client";

import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** ブラウザ内蔵の音声合成で英文を読み上げる（無料・APIを使わない） */
export function SpeakButton({ text, lang = "en-US" }: { text: string; lang?: string }) {
  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };
  return (
    <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={speak} aria-label={`「${text}」を読み上げる`} title="読み上げ">
      <Volume2 className="size-4" />
    </Button>
  );
}
