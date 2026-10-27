import { z } from "zod";

/** 英会話のモード・レベル・設定。クライアントとサーバーの両方で使う。 */

export const CONVERSATION_MODES = [
  "free_talk",
  "daily",
  "cafe",
  "travel",
  "roleplay",
  "discussion",
  "grammar_practice",
] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export interface Scenario {
  id: string;
  label: string;
  /** AI講師への指示（英語） */
  brief: string;
}

export interface ModeInfo {
  id: ConversationMode;
  label: string;
  description: string;
  emoji: string;
  scenarios: Scenario[];
}

export const MODE_INFO: Record<ConversationMode, ModeInfo> = {
  free_talk: {
    id: "free_talk",
    label: "フリートーク",
    description: "好きな話題で自由に会話",
    emoji: "💬",
    scenarios: [
      { id: "any", label: "おまかせ", brief: "Chat freely about whatever the learner wants. Start by asking how their day is going." },
      { id: "hobbies", label: "趣味", brief: "Talk about the learner's hobbies and free time." },
      { id: "weekend", label: "週末の予定", brief: "Talk about what the learner did last weekend and plans for the next one." },
      { id: "food", label: "食べ物", brief: "Talk about favorite foods, cooking and restaurants." },
      { id: "movies", label: "映画・ドラマ", brief: "Talk about movies, TV series and anime the learner likes, and ask why they like them." },
      { id: "work_study", label: "仕事・勉強", brief: "Talk about the learner's job or studies, what they do on a typical day and what they find interesting or difficult." },
    ],
  },
  daily: {
    id: "daily",
    label: "日常英会話",
    description: "自己紹介や友人との会話",
    emoji: "☀️",
    scenarios: [
      { id: "self_intro", label: "自己紹介", brief: "You just met the learner at a meetup. Help them introduce themselves (name, job, hometown, hobbies)." },
      { id: "friend", label: "友人と雑談", brief: "You are the learner's friendly English-speaking friend catching up over coffee." },
      { id: "small_talk", label: "スモールトーク", brief: "Practice small talk: weather, recent news, weekend, work." },
      { id: "family", label: "家族・ペット", brief: "Ask the learner about their family members or pets: what they are like and what they do together." },
      { id: "plans", label: "予定を立てる", brief: "You are the learner's friend. Together, make plans to meet this weekend: decide when, where and what to do." },
    ],
  },
  cafe: {
    id: "cafe",
    label: "カフェ英会話",
    description: "注文・接客・コーヒーの説明",
    emoji: "☕",
    scenarios: [
      { id: "order", label: "注文する（客）", brief: "You are a barista at a cafe. The learner is the customer ordering drinks and food. Ask about size, milk, for here or to go, etc." },
      { id: "serve", label: "接客する（店員）", brief: "You are a foreign customer at a cafe in Japan. The learner is the barista serving you. Order something, ask questions about the menu and pay." },
      { id: "explain_coffee", label: "コーヒーを説明", brief: "You are a curious customer asking the learner (a barista) to explain coffee beans, roasts, flavors and brewing methods." },
      { id: "recommend", label: "おすすめを聞く（客）", brief: "You are a barista. The learner is a customer who can't decide and asks for recommendations. Describe a few drinks and ask about their preferences." },
      { id: "cafe_trouble", label: "注文ミスに対応（店員）", brief: "You are a customer who received the wrong drink. The learner is the barista and must apologize and fix the problem politely." },
    ],
  },
  travel: {
    id: "travel",
    label: "海外旅行",
    description: "空港・ホテル・レストラン",
    emoji: "✈️",
    scenarios: [
      { id: "airport", label: "空港", brief: "You are an airline check-in agent and later an immigration officer. The learner is a traveler." },
      { id: "hotel", label: "ホテル", brief: "You are a hotel front desk clerk. The learner is checking in and asking about facilities or a problem with the room." },
      { id: "restaurant", label: "レストラン", brief: "You are a server at a restaurant abroad. The learner is a customer ordering, asking for recommendations and paying." },
      { id: "directions", label: "道をたずねる", brief: "You are a local person on the street. The learner is a tourist asking for directions and recommendations." },
      { id: "shopping", label: "ショッピング", brief: "You are a shop assistant at a souvenir shop abroad. The learner is looking for gifts, asks about prices and pays." },
      { id: "taxi", label: "タクシー・交通", brief: "You are a taxi driver (or a station staff member). The learner needs to get to their hotel and asks about fares and time." },
      { id: "trouble", label: "旅先のトラブル", brief: "You are a staff member at a hotel or police box. The learner has lost their wallet or passport and needs help." },
    ],
  },
  roleplay: {
    id: "roleplay",
    label: "ロールプレイ",
    description: "AIが店員・友人・顧客などを演じる",
    emoji: "🎭",
    scenarios: [
      { id: "shop_clerk", label: "AIが店員", brief: "You are a clothing store clerk. The learner is shopping for clothes and asks about sizes, colors and prices." },
      { id: "customer", label: "AIが顧客", brief: "You are a customer with a small complaint (wrong order). The learner is the staff member who must handle it politely." },
      { id: "new_friend", label: "AIが新しい友人", brief: "You are a new friend from abroad visiting Japan. Ask the learner for recommendations about places and food." },
      { id: "colleague", label: "AIが同僚", brief: "You are a new foreign colleague on your first day. Ask the learner about the office, lunch spots and the team." },
      { id: "interviewer", label: "AIが面接官", brief: "You are a friendly interviewer for a part-time job at an international cafe. Ask typical interview questions one at a time." },
      { id: "doctor", label: "AIが医師", brief: "You are a doctor at a clinic abroad. The learner is a patient who must explain their symptoms." },
    ],
  },
  discussion: {
    id: "discussion",
    label: "ディスカッション",
    description: "一つのテーマで意見交換",
    emoji: "🧭",
    scenarios: [
      { id: "remote_work", label: "在宅勤務は良い？", brief: "Discuss: Is working from home better than working at an office? Ask for the learner's opinion and reasons." },
      { id: "cashless", label: "キャッシュレス社会", brief: "Discuss: Should all shops go cashless? Ask for the learner's opinion, reasons and examples." },
      { id: "travel_style", label: "旅行のスタイル", brief: "Discuss: Is it better to travel alone or with friends? Ask for opinions and experiences." },
      { id: "social_media", label: "SNSとの付き合い方", brief: "Discuss: Is social media good or bad for us? Ask for the learner's opinion and personal experience." },
      { id: "ai_jobs", label: "AIと仕事", brief: "Discuss: Will AI take away people's jobs? Ask for the learner's opinion, reasons and examples." },
      { id: "city_country", label: "都会と田舎", brief: "Discuss: Is it better to live in a big city or in the countryside? Ask for opinions and reasons." },
    ],
  },
  grammar_practice: {
    id: "grammar_practice",
    label: "文法実践",
    description: "学んだ文法を会話で使う",
    emoji: "🧩",
    scenarios: [
      { id: "present_perfect", label: "現在完了形", brief: "Ask questions that naturally require the present perfect (Have you ever...? How long have you...?)." },
      { id: "past", label: "過去形", brief: "Ask about past experiences so the learner uses the past tense (What did you do...?)." },
      { id: "future", label: "未来形", brief: "Ask about plans so the learner uses will / be going to." },
      { id: "comparatives", label: "比較級・最上級", brief: "Ask the learner to compare things (cities, foods, seasons) so they use comparatives and superlatives." },
      { id: "conditionals", label: "仮定法", brief: "Ask hypothetical questions (What would you do if...?) so the learner uses the second conditional." },
      { id: "modals", label: "助動詞", brief: "Create situations where the learner uses can / should / must / might (advice, rules, possibility)." },
      { id: "gerunds", label: "不定詞・動名詞", brief: "Ask about likes, hobbies and goals so the learner uses gerunds and infinitives (I enjoy -ing, I want to...)." },
      { id: "relative", label: "関係代名詞", brief: "Ask the learner to describe people, places and things so they use relative clauses (a friend who..., a place where...)." },
      { id: "passive", label: "受動態", brief: "Ask about famous things, products and places so the learner uses the passive voice (It was built in..., It is made of...)." },
    ],
  },
};

export const LEVELS = ["beginner", "elementary", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_INFO: Record<Level, { label: string; cefr: string; guide: string }> = {
  beginner: {
    label: "初級",
    cefr: "A1〜A2",
    guide: "Use very simple, high-frequency words and short sentences (5-8 words). Ask yes/no or either/or questions often. Speak clearly.",
  },
  elementary: {
    label: "初中級",
    cefr: "A2〜B1",
    guide: "Use simple everyday vocabulary and short sentences. Mix simple open questions with easier follow-ups.",
  },
  intermediate: {
    label: "中級",
    cefr: "B1〜B2",
    guide: "Use natural everyday English with common idioms. Ask open questions and ask for reasons and examples.",
  },
  advanced: {
    label: "上級",
    cefr: "B2〜C1",
    guide: "Use natural, native-like English at normal complexity, including phrasal verbs and idioms. Challenge the learner to explain and justify opinions.",
  },
};

export const DURATIONS = [5, 10, 15, 25, 0] as const; // 0 = 無制限
export type DurationMinutes = (typeof DURATIONS)[number];

export const SPEEDS = ["slow", "normal", "fast"] as const;
export type Speed = (typeof SPEEDS)[number];
export const SPEED_INFO: Record<Speed, { label: string; value: number }> = {
  slow: { label: "ゆっくり", value: 0.85 },
  normal: { label: "普通", value: 1.0 },
  fast: { label: "速い", value: 1.15 },
};

export const ACCENTS = ["american", "british", "australian"] as const;
export type Accent = (typeof ACCENTS)[number];
export const ACCENT_INFO: Record<Accent, { label: string; instruction: string }> = {
  american: { label: "アメリカ英語", instruction: "Speak with a General American accent and use American vocabulary and spelling." },
  british: { label: "イギリス英語", instruction: "Speak with a British (Southern English) accent and use British vocabulary (e.g. 'flat', 'queue')." },
  australian: { label: "オーストラリア英語", instruction: "Speak with an Australian accent and use common Australian expressions, but keep them understandable." },
};

/** AI講師（OpenAI Realtime の音声と人物設定） */
export const TEACHERS = [
  {
    id: "emma",
    name: "Emma",
    voice: "marin",
    description: "明るく丁寧な講師",
    persona: "You are from Seattle, USA. You love coffee, hiking and indie music. You are cheerful and encouraging.",
  },
  {
    id: "leo",
    name: "Leo",
    voice: "cedar",
    description: "落ち着いたフレンドリーな講師",
    persona: "You are from Manchester, UK. You like football, cooking and history. You are calm, patient and thoughtful.",
  },
  {
    id: "mia",
    name: "Mia",
    voice: "coral",
    description: "元気でおしゃべりな講師",
    persona: "You are from Sydney, Australia. You love travel, the beach and food from around the world. You are energetic and talkative but still let the learner speak.",
  },
  {
    id: "noah",
    name: "Noah",
    voice: "ash",
    description: "ビジネス経験豊富な講師",
    persona: "You are from Toronto, Canada. You worked in hospitality and sales for years. You are professional, clear and practical.",
  },
] as const;
export type TeacherId = (typeof TEACHERS)[number]["id"];
export const TEACHER_IDS = TEACHERS.map((t) => t.id) as [TeacherId, ...TeacherId[]];

/** 講師の接し方 */
export const TEACHER_STYLES = ["friendly", "gentle", "coach", "casual"] as const;
export type TeacherStyle = (typeof TEACHER_STYLES)[number];
export const TEACHER_STYLE_INFO: Record<TeacherStyle, { label: string; description: string; instruction: string }> = {
  friendly: {
    label: "フレンドリー",
    description: "友達のように楽しく",
    instruction: "Be warm and friendly like a good friend. React with genuine interest and share small personal comments sometimes.",
  },
  gentle: {
    label: "やさしく丁寧",
    description: "ゆっくり待ってくれる",
    instruction: "Be extra gentle and patient. Praise effort often, never rush the learner, and rephrase questions more simply if they hesitate.",
  },
  coach: {
    label: "しっかり指導",
    description: "もっと長く話すよう促す",
    instruction: "Act like a supportive but demanding speaking coach. Push the learner to give longer answers with reasons and examples (e.g. 'Can you tell me more?', 'Why do you think so?').",
  },
  casual: {
    label: "くだけた会話",
    description: "ネイティブの日常表現多め",
    instruction: "Talk casually like native speakers do with friends, using common everyday expressions and contractions, but keep it understandable for the learner's level.",
  },
};

/** 話す順番の決め方 */
export const TURN_MODES = ["auto", "patient", "push_to_talk"] as const;
export type TurnMode = (typeof TURN_MODES)[number];
export const TURN_MODE_INFO: Record<TurnMode, { label: string; description: string }> = {
  auto: { label: "自動（標準）", description: "話し終わると自動でAIが返事します。黙っているとAIから話しかけます" },
  patient: { label: "自動（考える時間長め）", description: "文の途中で考え込んでも待ってくれます。返事は少し遅くなります" },
  push_to_talk: { label: "押して話す", description: "ボタン（PCはスペースキー）を押している間だけ話します。周りがうるさい場所向け" },
};

export const CORRECTION_MODES = ["inline", "after"] as const;
export type CorrectionMode = (typeof CORRECTION_MODES)[number];

export const lessonSettingsSchema = z.object({
  mode: z.enum(CONVERSATION_MODES),
  scenarioId: z.string().max(50),
  customTopic: z.string().max(200).default(""),
  level: z.enum(LEVELS),
  durationMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(25), z.literal(0)]),
  speed: z.enum(SPEEDS),
  accent: z.enum(ACCENTS),
  teacherId: z.enum(TEACHER_IDS),
  teacherStyle: z.enum(TEACHER_STYLES).default("friendly"),
  /** 講師へのお願い（例：「ゆっくり話して」「サッカーの話題が好き」） */
  teacherNote: z.string().max(300).default(""),
  correctionMode: z.enum(CORRECTION_MODES),
  japaneseSupport: z.boolean(),
  turnMode: z.enum(TURN_MODES).default("auto"),
});
export type LessonSettings = z.infer<typeof lessonSettingsSchema>;

export const DEFAULT_LESSON_SETTINGS: LessonSettings = {
  mode: "free_talk",
  scenarioId: "any",
  customTopic: "",
  level: "elementary",
  durationMinutes: 10,
  speed: "normal",
  accent: "american",
  teacherId: "emma",
  teacherStyle: "friendly",
  teacherNote: "",
  correctionMode: "after",
  japaneseSupport: true,
  turnMode: "auto",
};

export function getScenario(mode: ConversationMode, scenarioId: string): Scenario {
  const info = MODE_INFO[mode];
  return info.scenarios.find((s) => s.id === scenarioId) ?? info.scenarios[0];
}

export function getTeacher(id: TeacherId) {
  return TEACHERS.find((t) => t.id === id) ?? TEACHERS[0];
}

export function lessonTitle(s: LessonSettings): string {
  const info = MODE_INFO[s.mode];
  const scenario = getScenario(s.mode, s.scenarioId);
  const topic = s.customTopic.trim();
  return topic ? `${info.label}：${topic}` : `${info.label}：${scenario.label}`;
}

/** 間違えた表現をもう一度練習するときの対象 */
export interface PracticeTarget {
  original: string;
  corrected: string;
}
