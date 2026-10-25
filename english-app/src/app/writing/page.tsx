import type { Metadata } from "next";
import { Suspense } from "react";
import { WritingClient } from "./writing-client";

export const metadata: Metadata = { title: "英作文" };

export default function WritingPage() {
  return (
    <Suspense>
      <WritingClient />
    </Suspense>
  );
}
