import type { Metadata } from "next";
import { ProgressClient } from "./progress-client";

export const metadata: Metadata = { title: "学習記録" };

export default function ProgressPage() {
  return <ProgressClient />;
}
