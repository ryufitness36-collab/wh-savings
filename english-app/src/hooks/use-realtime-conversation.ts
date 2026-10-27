"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/client/api";
import { WRAP_UP_INSTRUCTIONS } from "@/lib/learning/instructions";
import type { TranscriptEntry } from "@/lib/learning/transcript";

/**
 * OpenAI Realtime API と WebRTC で双方向の音声会話を行うフック。
 *
 * 流れ：
 *  1. マイクの許可を取る
 *  2. 自分のサーバー（/api/realtime/session）から一時キーを受け取る（本物のAPIキーはブラウザに来ない）
 *  3. RTCPeerConnection を作り、マイク音声を送信・AIの音声を受信する
 *  4. データチャンネル "oai-events" で、文字起こし・発話状態などのイベントを受け取る
 *
 * 発話の区切り検出（VAD）・割り込み・沈黙時の声かけはサーバー側の server_vad 設定で行う。
 */

export type ConnectionStatus =
  | "idle"
  | "requesting_mic"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "ending"
  | "ended"
  | "error";

export type AiState = "listening" | "user_speaking" | "thinking" | "speaking";

export type ConversationErrorKind = "mic_denied" | "mic_not_found" | "insecure_context" | "unsupported" | "api" | "network";

export interface ConversationError {
  kind: ConversationErrorKind;
  message: string;
}

export interface LiveEntry extends TranscriptEntry {
  /** 文字起こし中（まだ確定していない） */
  partial: boolean;
}

interface Options {
  conversationId: string | null;
  timeLimitSec: number | null;
  /** 押して話すモード（自動の発話検出を使わず、ボタンを押している間だけ音声を送る） */
  pushToTalk?: boolean;
  onAutoEnd?: () => void;
}

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const AUTOSAVE_INTERVAL_MS = 20_000;

type ServerEvent = { type: string; [key: string]: unknown };

function prepareAudioElement(existing: HTMLAudioElement | null): HTMLAudioElement {
  const audio = existing ?? new Audio();
  audio.autoplay = true;
  audio.setAttribute("playsinline", "true");
  return audio;
}

export function useRealtimeConversation({ conversationId, timeLimitSec, pushToTalk = false, onAutoEnd }: Options) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [aiState, setAiState] = useState<AiState>("listening");
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [error, setError] = useState<ConversationError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [wrappingUp, setWrappingUp] = useState(false);
  const [talking, setTalking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const entriesRef = useRef<LiveEntry[]>([]);
  const micEnabledRef = useRef(true);
  const talkingRef = useRef(false);
  const statusRef = useRef<ConnectionStatus>("idle");
  const elapsedRef = useRef(0);
  const responseActiveRef = useRef(false);
  const userSpeakingSinceRef = useRef<number | null>(null);
  const aiSpeakingSinceRef = useRef<number | null>(null);
  const userSpeakingSecRef = useRef(0);
  const aiSpeakingSecRef = useRef(0);
  const wrapUpStateRef = useRef<"none" | "pending" | "sent">("none");
  const wrapUpResponseIdRef = useRef<string | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const autoReconnectTriedRef = useRef(false);
  const lastSaveRef = useRef(0);
  const onAutoEndRef = useRef(onAutoEnd);
  const connectionLostRef = useRef<() => void>(() => {});
  useEffect(() => {
    onAutoEndRef.current = onAutoEnd;
  }, [onAutoEnd]);

  const updateStatus = useCallback((s: ConnectionStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const commitEntries = useCallback((next: LiveEntry[]) => {
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const upsertEntry = useCallback(
    (id: string, role: "user" | "assistant", fn: (e: LiveEntry) => LiveEntry) => {
      const list = entriesRef.current;
      const idx = list.findIndex((e) => e.id === id);
      if (idx === -1) {
        commitEntries([...list, fn({ id, role, text: "", at: Date.now(), partial: true })]);
      } else {
        const copy = [...list];
        copy[idx] = fn(copy[idx]);
        commitEntries(copy);
      }
    },
    [commitEntries],
  );

  const removeEntry = useCallback(
    (id: string) => commitEntries(entriesRef.current.filter((e) => e.id !== id)),
    [commitEntries],
  );

  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(event));
      return true;
    }
    return false;
  }, []);

  /** 確定した文字起こし（保存・レポート用） */
  const finalTranscript = useCallback(
    (): TranscriptEntry[] =>
      entriesRef.current
        .filter((e) => e.text.trim() !== "")
        .map(({ id, role, text, at }) => ({ id, role, text: text.trim(), at })),
    [],
  );

  const stopSpeakingTimers = useCallback(() => {
    const now = Date.now();
    if (userSpeakingSinceRef.current !== null) {
      userSpeakingSecRef.current += (now - userSpeakingSinceRef.current) / 1000;
      userSpeakingSinceRef.current = null;
    }
    if (aiSpeakingSinceRef.current !== null) {
      aiSpeakingSecRef.current += (now - aiSpeakingSinceRef.current) / 1000;
      aiSpeakingSinceRef.current = null;
    }
  }, []);

  const progressPayload = useCallback(
    () => ({
      transcript: finalTranscript(),
      durationSec: elapsedRef.current,
      userSpeakingSec: Math.round(userSpeakingSecRef.current * 10) / 10,
      aiSpeakingSec: Math.round(aiSpeakingSecRef.current * 10) / 10,
    }),
    [finalTranscript],
  );

  const autosave = useCallback(
    (force = false) => {
      if (!conversationId) return;
      const now = Date.now();
      if (!force && now - lastSaveRef.current < AUTOSAVE_INTERVAL_MS) return;
      lastSaveRef.current = now;
      apiFetch(`/api/conversations/${conversationId}`, { method: "PATCH", json: progressPayload() }).catch(() => {
        // 途中保存の失敗は会話を止めない（終了時に再送される）
      });
    },
    [conversationId, progressPayload],
  );

  /** 接続を閉じる（マイクは keepMic=true なら残す：再接続用） */
  const teardown = useCallback((keepMic: boolean) => {
    stopSpeakingTimers();
    responseActiveRef.current = false;
    const dc = dcRef.current;
    dcRef.current = null;
    if (dc) {
      dc.onclose = null;
      dc.onmessage = null;
      try {
        dc.close();
      } catch {}
    }
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
      try {
        pc.close();
      } catch {}
    }
    if (audioRef.current) audioRef.current.srcObject = null;
    if (!keepMic && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [stopSpeakingTimers]);

  const trySendWrapUp = useCallback(() => {
    if (wrapUpStateRef.current !== "pending") return;
    if (responseActiveRef.current || userSpeakingSinceRef.current !== null || aiSpeakingSinceRef.current !== null) return;
    if (send({ type: "response.create", response: { instructions: WRAP_UP_INSTRUCTIONS } })) {
      wrapUpStateRef.current = "sent";
    }
  }, [send]);

  const handleServerEvent = useCallback(
    (ev: ServerEvent) => {
      switch (ev.type) {
        case "input_audio_buffer.speech_started": {
          userSpeakingSinceRef.current = Date.now();
          // ユーザーが話し始めたら AI の発話はサーバー側で中断される（interrupt_response）
          if (aiSpeakingSinceRef.current !== null) {
            aiSpeakingSecRef.current += (Date.now() - aiSpeakingSinceRef.current) / 1000;
            aiSpeakingSinceRef.current = null;
          }
          setAiState("user_speaking");
          break;
        }
        case "input_audio_buffer.speech_stopped": {
          if (userSpeakingSinceRef.current !== null) {
            userSpeakingSecRef.current += (Date.now() - userSpeakingSinceRef.current) / 1000;
            userSpeakingSinceRef.current = null;
          }
          setAiState("thinking");
          break;
        }
        case "conversation.item.added": {
          const item = ev.item as { id?: string; type?: string; role?: string; content?: { type?: string }[] } | undefined;
          if (!item?.id || item.type !== "message") break;
          if (item.role !== "user" && item.role !== "assistant") break;
          // テキストで追加した項目（再接続時の履歴復元・テキスト入力）は画面側で管理しているので無視
          if (item.content?.some((c) => c.type === "input_text" || c.type === "output_text")) break;
          const role = item.role;
          upsertEntry(item.id, role, (e) => e);
          break;
        }
        case "conversation.item.input_audio_transcription.delta": {
          const id = ev.item_id as string;
          const delta = (ev.delta as string) ?? "";
          upsertEntry(id, "user", (e) => ({ ...e, text: e.text + delta, partial: true }));
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const id = ev.item_id as string;
          const text = ((ev.transcript as string) ?? "").trim();
          if (text === "") removeEntry(id);
          else upsertEntry(id, "user", (e) => ({ ...e, text, partial: false }));
          autosave();
          break;
        }
        case "conversation.item.input_audio_transcription.failed": {
          removeEntry(ev.item_id as string);
          break;
        }
        case "response.created": {
          responseActiveRef.current = true;
          const response = ev.response as { id?: string } | undefined;
          if (wrapUpStateRef.current === "sent" && !wrapUpResponseIdRef.current && response?.id) {
            wrapUpResponseIdRef.current = response.id;
          }
          setAiState((s) => (s === "user_speaking" ? s : "thinking"));
          break;
        }
        case "response.output_audio_transcript.delta": {
          const id = ev.item_id as string;
          const delta = (ev.delta as string) ?? "";
          upsertEntry(id, "assistant", (e) => ({ ...e, text: e.text + delta, partial: true }));
          break;
        }
        case "response.output_audio_transcript.done": {
          const id = ev.item_id as string;
          const text = ((ev.transcript as string) ?? "").trim();
          upsertEntry(id, "assistant", (e) => ({ ...e, text: text || e.text, partial: false }));
          break;
        }
        case "output_audio_buffer.started": {
          aiSpeakingSinceRef.current = Date.now();
          setAiState("speaking");
          break;
        }
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared": {
          if (aiSpeakingSinceRef.current !== null) {
            aiSpeakingSecRef.current += (Date.now() - aiSpeakingSinceRef.current) / 1000;
            aiSpeakingSinceRef.current = null;
          }
          setAiState((s) => (s === "user_speaking" ? s : "listening"));
          // 締めくくりの挨拶を話し終えたら自動で終了
          if (wrapUpStateRef.current === "sent" && wrapUpResponseIdRef.current && !responseActiveRef.current) {
            onAutoEndRef.current?.();
          } else {
            trySendWrapUp();
          }
          break;
        }
        case "response.done": {
          responseActiveRef.current = false;
          const response = ev.response as { id?: string; status?: string; status_details?: { error?: { message?: string } } } | undefined;
          // 入力が無音で音声が返らなかった場合などに表示状態を戻す
          if (aiSpeakingSinceRef.current === null) setAiState((s) => (s === "thinking" ? "listening" : s));
          if (response?.status === "failed") {
            setNotice(`AIの応答でエラーが発生しました：${response.status_details?.error?.message ?? "不明なエラー"}`);
          }
          // 未完了のまま止まった AI 発話を確定させる
          commitEntries(entriesRef.current.map((e) => (e.role === "assistant" && e.partial ? { ...e, partial: false } : e)));
          if (wrapUpStateRef.current === "sent" && response?.id && response.id === wrapUpResponseIdRef.current && aiSpeakingSinceRef.current === null) {
            // 音声が出なかった場合でも終了する
            window.setTimeout(() => {
              if (aiSpeakingSinceRef.current === null) onAutoEndRef.current?.();
            }, 1500);
          }
          trySendWrapUp();
          autosave();
          break;
        }
        case "error": {
          const err = ev.error as { message?: string; code?: string } | undefined;
          const code = err?.code ?? "";
          // 割り込み時のキャンセル競合など、無視してよいエラー
          if (
            code === "response_cancel_not_active" ||
            code === "conversation_already_has_active_response" ||
            code === "input_audio_buffer_commit_empty"
          )
            break;
          console.warn("[realtime] error event", err);
          setNotice(err?.message ? `エラー：${err.message}` : "AIとの通信でエラーが発生しました。");
          break;
        }
        default:
          break;
      }
    },
    [upsertEntry, removeEntry, autosave, trySendWrapUp, commitEntries],
  );

  /** 再接続時に、これまでの会話を新しいセッションに渡して文脈を引き継ぐ */
  const restoreHistory = useCallback(() => {
    const history = finalTranscript().slice(-30);
    for (const e of history) {
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: e.role,
          content: [{ type: e.role === "user" ? "input_text" : "output_text", text: e.text }],
        },
      });
    }
    send({
      type: "response.create",
      response: {
        instructions:
          history.length > 0
            ? "The connection was briefly interrupted. Very briefly say sorry about the interruption and continue the conversation naturally from where you left off, ending with a question."
            : undefined,
      },
    });
  }, [finalTranscript, send]);

  const getMicrophone = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.getAudioTracks().some((t) => t.readyState === "live")) {
      return streamRef.current;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      throw { kind: "insecure_context", message: "マイクは安全な接続（https:// または localhost）でのみ使えます。スマホから使う場合は README の「スマホで使う」を参照してください。" } satisfies ConversationError;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      throw { kind: "unsupported", message: "このブラウザは音声会話に対応していません。最新の Chrome / Safari / Edge をお使いください。" } satisfies ConversationError;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      return stream;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw { kind: "mic_denied", message: "マイクの使用が許可されていません。" } satisfies ConversationError;
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw { kind: "mic_not_found", message: "マイクが見つかりません。マイクが接続されているか確認してください。" } satisfies ConversationError;
      }
      if (name === "NotReadableError") {
        throw { kind: "mic_not_found", message: "マイクを使用できません。他のアプリ（Zoomなど）がマイクを使っていないか確認してください。" } satisfies ConversationError;
      }
      throw { kind: "mic_denied", message: `マイクを開始できませんでした（${name || String(e)}）。` } satisfies ConversationError;
    }
  }, []);

  const connectInternal = useCallback(
    async (isReconnect: boolean) => {
      if (!conversationId) return;
      setError(null);
      setNotice(null);
      updateStatus(isReconnect ? "reconnecting" : "requesting_mic");

      try {
        const stream = await getMicrophone();
        // 押して話すモードでは、ボタンを押すまでマイク音声を送らない
        stream.getAudioTracks().forEach((t) => (t.enabled = pushToTalk ? false : micEnabledRef.current));
        updateStatus(isReconnect ? "reconnecting" : "connecting");

        const micType = /iPhone|iPad|Android/i.test(navigator.userAgent) ? "near_field" : "far_field";
        const { clientSecret } = await apiFetch<{ clientSecret: string }>("/api/realtime/session", {
          method: "POST",
          json: { conversationId, micType },
        });

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const audio = prepareAudioElement(audioRef.current);
        audioRef.current = audio;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
          audio.play().catch(() => {
            setNotice("音声を再生できませんでした。画面をタップしてください。");
          });
        };

        stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (e) => {
          try {
            handleServerEvent(JSON.parse(e.data as string) as ServerEvent);
          } catch (err) {
            console.warn("[realtime] failed to handle event", err);
          }
        };
        dc.onopen = () => {
          updateStatus("connected");
          autoReconnectTriedRef.current = false;
          if (isReconnect && hasConnectedOnceRef.current) {
            restoreHistory();
          } else {
            // 最初の挨拶と質問を AI から始める
            send({ type: "response.create" });
          }
          hasConnectedOnceRef.current = true;
        };
        dc.onclose = () => {
          if (statusRef.current === "connected") connectionLostRef.current();
        };

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "failed" || state === "closed") {
            if (statusRef.current === "connected") connectionLostRef.current();
          } else if (state === "disconnected") {
            // 一時的な切断は数秒で回復することがあるので少し待つ
            window.setTimeout(() => {
              if (pcRef.current === pc && pc.connectionState === "disconnected" && statusRef.current === "connected") {
                connectionLostRef.current();
              }
            }, 4000);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let sdpResponse: Response;
        try {
          sdpResponse = await fetch(REALTIME_CALLS_URL, {
            method: "POST",
            body: offer.sdp,
            headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
          });
        } catch {
          throw { kind: "network", message: "OpenAI の音声サーバーに接続できませんでした。ネットワークを確認してください。" } satisfies ConversationError;
        }
        if (!sdpResponse.ok) {
          const detail = await sdpResponse.text().catch(() => "");
          throw {
            kind: "api",
            message: `音声セッションを開始できませんでした（${sdpResponse.status}）。${detail.slice(0, 200)}`,
          } satisfies ConversationError;
        }
        const answerSdp = await sdpResponse.text();
        if (pcRef.current !== pc) return; // 途中で終了された
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (e) {
        teardown(false);
        const ce: ConversationError =
          e instanceof ApiError
            ? { kind: e.status === 0 ? "network" : "api", message: e.message }
            : typeof e === "object" && e !== null && "kind" in e
              ? (e as ConversationError)
              : { kind: "api", message: e instanceof Error ? e.message : String(e) };
        setError(ce);
        updateStatus(isReconnect ? "disconnected" : "error");
      }
    },
    [conversationId, pushToTalk, getMicrophone, handleServerEvent, restoreHistory, send, teardown, updateStatus],
  );

  // 接続が切れたときの処理（connectInternal の中から ref 経由で呼ぶ）
  useEffect(() => {
    connectionLostRef.current = () => {
      teardown(true);
      updateStatus("disconnected");
      setAiState("listening");
      autosave(true);
      // 1回だけ自動で再接続を試みる
      if (!autoReconnectTriedRef.current) {
        autoReconnectTriedRef.current = true;
        setNotice("接続が切れました。再接続しています…");
        window.setTimeout(() => {
          if (statusRef.current === "disconnected") void connectInternal(true);
        }, 1500);
      } else {
        setNotice("接続が切れました。「再接続」を押してください。");
      }
    };
  }, [teardown, updateStatus, autosave, connectInternal]);

  const start = useCallback(() => {
    // iOS Safari では、ユーザー操作の中で audio 要素を作って再生を許可しておく必要がある
    if (!audioRef.current) {
      const audio = prepareAudioElement(null);
      audio.play().catch(() => {});
      audioRef.current = audio;
    }
    return connectInternal(false);
  }, [connectInternal]);

  const reconnect = useCallback(() => {
    autoReconnectTriedRef.current = true;
    return connectInternal(true);
  }, [connectInternal]);

  const toggleMic = useCallback(() => {
    const next = !micEnabledRef.current;
    micEnabledRef.current = next;
    setMicEnabled(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  }, []);

  /** 押して話す：ボタンを押した */
  const startTalking = useCallback(() => {
    if (!pushToTalk || talkingRef.current || statusRef.current !== "connected") return;
    // AIが話していたら止めてから話す
    if (responseActiveRef.current) send({ type: "response.cancel" });
    if (aiSpeakingSinceRef.current !== null) send({ type: "output_audio_buffer.clear" });
    send({ type: "input_audio_buffer.clear" });
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    talkingRef.current = true;
    userSpeakingSinceRef.current = Date.now();
    setTalking(true);
    setAiState("user_speaking");
  }, [pushToTalk, send]);

  /** 押して話す：ボタンを離した。最後の音声が届くよう少し待ってから確定し、返事を依頼する */
  const stopTalking = useCallback(() => {
    if (!talkingRef.current) return;
    talkingRef.current = false;
    setTalking(false);
    const since = userSpeakingSinceRef.current ?? Date.now();
    const heldMs = Date.now() - since;
    window.setTimeout(() => {
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
      if (userSpeakingSinceRef.current !== null) {
        userSpeakingSecRef.current += (Date.now() - userSpeakingSinceRef.current) / 1000;
        userSpeakingSinceRef.current = null;
      }
      if (heldMs < 400) {
        send({ type: "input_audio_buffer.clear" });
        setAiState("listening");
        setNotice("ボタンを押したまま話し、話し終わったら離してください。");
        return;
      }
      send({ type: "input_audio_buffer.commit" });
      send({ type: "response.create" });
      setAiState("thinking");
    }, 300);
  }, [send]);

  /** AIの発話を止める（ボタンでの割り込み） */
  const interrupt = useCallback(() => {
    if (responseActiveRef.current) send({ type: "response.cancel" });
    send({ type: "output_audio_buffer.clear" });
  }, [send]);

  /** テキストでメッセージを送る（声を出せない場所用・日本語での質問用） */
  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || statusRef.current !== "connected") return false;
      if (responseActiveRef.current) {
        send({ type: "response.cancel" });
        send({ type: "output_audio_buffer.clear" });
      }
      const id = `text_${Date.now()}`;
      commitEntries([...entriesRef.current, { id, role: "user", text: trimmed, at: Date.now(), partial: false }]);
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: trimmed }] },
      });
      send({ type: "response.create" });
      return true;
    },
    [send, commitEntries],
  );

  /** 会話を終了し、記録を保存する */
  const end = useCallback(async () => {
    if (statusRef.current === "ending" || statusRef.current === "ended") return false;
    const prev = statusRef.current;
    updateStatus("ending");
    teardown(false);
    if (!conversationId) {
      updateStatus("ended");
      return true;
    }
    try {
      await apiFetch(`/api/conversations/${conversationId}/finish`, { method: "POST", json: progressPayload() });
      updateStatus("ended");
      return true;
    } catch (e) {
      setError({ kind: "api", message: `記録の保存に失敗しました：${e instanceof Error ? e.message : String(e)}` });
      updateStatus(prev === "idle" ? "idle" : "disconnected");
      return false;
    }
  }, [conversationId, progressPayload, teardown, updateStatus]);

  // 経過時間（接続中のみカウント）と制限時間の処理
  useEffect(() => {
    if (status !== "connected") return;
    const timer = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSec(elapsedRef.current);
      autosave();
      if (timeLimitSec && elapsedRef.current >= timeLimitSec && wrapUpStateRef.current === "none") {
        wrapUpStateRef.current = "pending";
        setWrappingUp(true);
        // 一定時間内に締めくくれない場合でも終了する
        window.setTimeout(() => {
          if (statusRef.current === "connected") onAutoEndRef.current?.();
        }, 25_000);
      }
      trySendWrapUp();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, timeLimitSec, autosave, trySendWrapUp]);

  // マイクの入力レベル（声が届いているかを画面に表示する）
  useEffect(() => {
    if (status !== "connected" || !streamRef.current) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(streamRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 80) return;
      last = t;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      setMicLevel(Math.min(1, rms * 6));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void ctx.close();
      setMicLevel(0);
    };
  }, [status]);

  // 画面を離れるときは接続とマイクを確実に止める
  useEffect(() => {
    return () => teardown(false);
  }, [teardown]);

  return {
    status,
    aiState,
    entries,
    error,
    notice,
    micEnabled,
    elapsedSec,
    wrappingUp,
    start,
    reconnect,
    end,
    toggleMic,
    talking,
    micLevel,
    startTalking,
    stopTalking,
    interrupt,
    sendText,
    dismissNotice: () => setNotice(null),
    getSpeakingStats: () => ({ user: userSpeakingSecRef.current, ai: aiSpeakingSecRef.current }),
  };
}
