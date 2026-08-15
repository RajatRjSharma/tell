import { NextResponse } from "next/server";
import { emailOtpEnabled, registrationEnabled } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Public flags for login/register UI (OUTSKILL `/api/auth/config` pattern). */
export async function GET() {
  return NextResponse.json({
    registrationEnabled: registrationEnabled(),
    emailOtpEnabled: emailOtpEnabled(),
  });
}
