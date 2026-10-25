import type { Metadata } from "next";
import { WritingClient } from "./writing-client";

export const metadata: Metadata = { title: "英作文" };

export default function WritingPage() {
  return <WritingClient />;
}
