import { NextResponse } from "next/server";
import { emailOtpEnabled, registrationEnabled } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Public auth UI flags. */
export async function GET() {
  return NextResponse.json({
    registrationEnabled: registrationEnabled(),
    emailOtpEnabled: emailOtpEnabled(),
  });
}
