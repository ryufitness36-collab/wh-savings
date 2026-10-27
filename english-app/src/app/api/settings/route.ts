import { NextResponse } from "next/server";
import { handleRouteError, parseJson } from "@/lib/api";
import { getPrivacySettings, privacySettingsSchema, savePrivacySettings } from "@/lib/server/settings";

export async function GET() {
  try {
    return NextResponse.json({ privacy: getPrivacySettings() });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const privacy = await parseJson(req, privacySettingsSchema);
    savePrivacySettings(privacy);
    return NextResponse.json({ privacy });
  } catch (err) {
    return handleRouteError(err);
  }
}
