import type { Metadata } from "next";
import { ReportClient } from "./report-client";

export const metadata: Metadata = { title: "会話レポート" };

export default async function ReportPage({ params }: PageProps<"/conversation/[id]">) {
  const { id } = await params;
  return <ReportClient id={id} />;
}
