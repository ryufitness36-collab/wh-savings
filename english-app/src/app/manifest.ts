import type { MetadataRoute } from "next";

/** PWA のマニフェスト（ホーム画面に追加したときのアプリ名・アイコン・色） */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hello Coach — AI英会話スクール",
    short_name: "Hello Coach",
    description: "毎日使いたくなる、自分専用のAI英会話スクール",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfcfd",
    theme_color: "#0d7a7f",
    lang: "ja",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "AI英会話", url: "/conversation", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "復習", url: "/review", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
