import type { Metadata } from "next";
import { Suspense } from "react";
import { GrammarClient } from "./grammar-client";

export const metadata: Metadata = { title: "英文法" };

export default function GrammarPage() {
  return (
    <Suspense>
      <GrammarClient />
    </Suspense>
  );
}
