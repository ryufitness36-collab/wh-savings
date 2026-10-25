import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { getStats } from "@/lib/server/stats";

export async function GET() {
  try {
    return NextResponse.json(getStats());
  } catch (err) {
    return handleRouteError(err);
  }
}
