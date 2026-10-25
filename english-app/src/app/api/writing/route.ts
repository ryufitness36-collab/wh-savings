import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { listWriting } from "@/lib/server/writing";

export async function GET() {
  try {
    return NextResponse.json({ entries: listWriting() });
  } catch (err) {
    return handleRouteError(err);
  }
}
