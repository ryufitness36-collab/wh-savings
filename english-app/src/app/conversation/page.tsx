import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationClient } from "./conversation-client";

export const metadata: Metadata = { title: "AI英会話" };

export default function ConversationPage() {
  return (
    <Suspense>
      <ConversationClient />
    </Suspense>
  );
}
