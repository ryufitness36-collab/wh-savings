import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { countReviewItems, getDueReviewItems } from "@/lib/server/review";

/** 今日復習すべき項目（期限が来たもの）を返す */
export async function GET() {
  try {
    return NextResponse.json({ items: getDueReviewItems(30), counts: countReviewItems() });
  } catch (err) {
    return handleRouteError(err);
  }
}
