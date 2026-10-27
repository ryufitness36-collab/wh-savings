"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LessonSetup } from "@/components/conversation/lesson-setup";
import { LiveSession } from "@/components/conversation/live-session";
import { useAppStatus } from "@/hooks/use-status";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRealtimeConversation } from "@/hooks/use-realtime-conversation";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  CONVERSATION_MODES,
  DURATIONS,
  DEFAULT_LESSON_SETTINGS,
  getTeacher,
  lessonSettingsSchema,
  MODE_INFO,
  type ConversationMode,
  type LessonSettings,
} from "@/lib/learning/lesson";
import type { ConversationDetail } from "@/lib/server/conversations";

export function ConversationClient() {
  const router = useRouter();
  const params = useSearchParams();
  const practiceOf = params.get("practice");
  const modeParam = params.get("mode");
  const scenarioParam = params.get("scenario");
  const minutesParam = Number(params.get("minutes"));
  const { data: appStatus } = useAppStatus();

  const [saved, setSaved, loaded] = useLocalStorage<LessonSettings>("lesson-settings", DEFAULT_LESSON_SETTINGS, lessonSettingsSchema);
  const [settings, setSettings] = useState<LessonSettings>(DEFAULT_LESSON_SETTINGS);
  const [practiceTitle, setPracticeTitle] = useState<string | null>(null);
  const [conversation, setConversation] = useState<{ id: string; title: string; settings: LessonSettings } | null>(null);
  const [starting, setStarting] = useState(false);
  const initialized = useRef(false);

  // 保存済みの設定・URL のモード指定・復習元の会話設定を反映する
  useEffect(() => {
    if (!loaded || initialized.current) return;
    initialized.current = true;
    let next = saved;
    if (modeParam && (CONVERSATION_MODES as readonly string[]).includes(modeParam)) {
      const m = modeParam as ConversationMode;
      const scenario = MODE_INFO[m].scenarios.find((sc) => sc.id === scenarioParam) ?? MODE_INFO[m].scenarios[0];
      next = { ...next, mode: m, scenarioId: scenario.id };
    }
    if ((DURATIONS as readonly number[]).includes(minutesParam) && minutesParam > 0) {
      next = { ...next, durationMinutes: minutesParam as LessonSettings["durationMinutes"] };
    }
    setSettings(next);
    if (practiceOf) {
      apiFetch<{ conversation: ConversationDetail }>(`/api/conversations/${practiceOf}`)
        .then(({ conversation: c }) => {
          setSettings({ ...c.settings, durationMinutes: 5, correctionMode: "inline" });
          setPracticeTitle(c.report?.title_ja ?? c.title);
        })
        .catch((e) => toast.error(`復習元の会話を読み込めませんでした：${errorMessage(e)}`));
    }
  }, [loaded, saved, modeParam, scenarioParam, minutesParam, practiceOf]);

  const timeLimitSec = conversation && conversation.settings.durationMinutes > 0 ? conversation.settings.durationMinutes * 60 : null;

  const endRef = useRef<() => void>(() => {});
  const session = useRealtimeConversation({
    conversationId: conversation?.id ?? null,
    timeLimitSec,
    pushToTalk: conversation?.settings.turnMode === "push_to_talk",
    onAutoEnd: () => endRef.current(),
  });

  const finish = useCallback(async () => {
    if (!conversation) return;
    const ok = await session.end();
    if (ok) router.push(`/conversation/${conversation.id}`);
  }, [conversation, session, router]);

  useEffect(() => {
    endRef.current = () => void finish();
  }, [finish]);

  // 会話レコードが作られたら音声接続を開始
  const pendingStart = useRef(false);
  useEffect(() => {
    if (conversation && pendingStart.current) {
      pendingStart.current = false;
      void session.start();
    }
  }, [conversation, session]);

  const handleStart = async () => {
    setStarting(true);
    try {
      if (!practiceOf) setSaved(settings);
      const created = await apiFetch<{ id: string; title: string }>("/api/conversations", {
        method: "POST",
        json: { settings, practiceOf },
      });
      pendingStart.current = true;
      setConversation({ ...created, settings });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  // 会話中にページを閉じようとしたら確認する
  useEffect(() => {
    if (!conversation || session.status === "ended") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [conversation, session.status]);

  if (conversation) {
    return (
      <LiveSession
        session={session}
        conversationId={conversation.id}
        pushToTalk={conversation.settings.turnMode === "push_to_talk"}
        title={conversation.title}
        teacherName={getTeacher(conversation.settings.teacherId).name}
        timeLimitSec={timeLimitSec}
        onEnd={() => void finish()}
        onRetry={() => void session.start()}
      />
    );
  }

  const disabledReason = appStatus && !appStatus.openai ? "AI英会話を使うには OpenAI APIキーの設定が必要です（画面上部の案内を参照）。" : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI英会話</h1>
        <p className="mt-1 text-sm text-muted-foreground">AI講師と音声でリアルタイムに会話します。話し始めればいつでも割り込めます。</p>
      </header>
      <LessonSetup
        settings={settings}
        onChange={setSettings}
        onStart={handleStart}
        starting={starting}
        disabledReason={disabledReason}
        practiceTitle={practiceTitle}
      />
    </div>
  );
}
