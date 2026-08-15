import { NextResponse } from "next/server";

/**
 * Direct password registration is disabled.
 * New accounts must verify email via OTP:
 *   POST /api/auth/otp/request
 *   POST /api/auth/otp/verify
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Email verification is required. Request a code with POST /api/auth/otp/request, then complete signup with POST /api/auth/otp/verify.",
      otpRequest: "/api/auth/otp/request",
      otpVerify: "/api/auth/otp/verify",
    },
    { status: 403 },
  );
}
