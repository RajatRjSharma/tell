"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";
type RegisterStep = "email" | "verify";

type AuthPublicConfig = {
  registrationEnabled: boolean;
  emailOtpEnabled: boolean;
};

const REGISTER_PASSWORD_MIN = 12;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("email");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AuthPublicConfig | null>(null);

  const isRegister = mode === "register";
  const registrationClosed =
    isRegister && config != null && !config.registrationEnabled;
  const otpDisabled =
    isRegister && config != null && !config.emailOtpEnabled;
  const registerBlocked = registrationClosed || otpDisabled;

  const title = registrationClosed
    ? "Registration closed"
    : otpDisabled
      ? "Registration unavailable"
      : isRegister
        ? registerStep === "email"
          ? "Create account"
          : "Verify email"
        : "Sign in";
  const altHref = isRegister ? "/login" : "/register";
  const altLabel = isRegister
    ? "Already have an account? Sign in"
    : "Need an account? Register";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/config")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as AuthPublicConfig;
      })
      .then((data) => {
        if (!cancelled && data) setConfig(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (!isRegister) {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        router.push("/");
        router.refresh();
        return;
      }

      if (registerBlocked) {
        setError(
          registrationClosed
            ? "Registration is currently closed"
            : "Email verification is disabled on this server",
        );
        return;
      }

      if (registerStep === "email") {
        const res = await fetch("/api/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, purpose: "register" }),
        });
        const data = (await res.json()) as {
          error?: string;
          expireMinutes?: number;
          devCode?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Could not send code");
          return;
        }
        if (data.devCode) {
          setOtp(data.devCode);
        }
        setRegisterStep("verify");
        setInfo(
          data.devCode
            ? `Dev code filled (${data.expireMinutes ?? 10} min). Set a password to finish.`
            : `We sent a ${data.expireMinutes ?? 10}-minute code to ${email}.`,
        );
        return;
      }

      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp,
          password,
          purpose: "register",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] bg-[var(--page)] text-[var(--text)] lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-[var(--line)] p-12 lg:flex lg:flex-col lg:justify-between">
        <Link
          href="/"
          className="flex w-fit items-center gap-3 focus-visible:outline-none"
        >
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--text)] font-mono text-xs font-semibold text-[var(--page)]">
            T
          </span>
          <span className="font-semibold tracking-[-0.025em]">Tell</span>
        </Link>

        <div className="max-w-xl">
          <p className="font-mono text-xs text-[var(--accent)]">
            Macro research, made legible
          </p>
          <h2 className="mt-5 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.06em]">
            Read the regime before you read the market.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
            Explainable outlooks across equities, FX, commodities, and rates.
            Built from macro data, not narrative noise.
          </p>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Research aid only. Not financial advice.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-12 flex w-fit items-center gap-3 lg:hidden"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--text)] font-mono text-[11px] font-semibold text-[var(--page)]">
              T
            </span>
            <span className="text-sm font-semibold">Tell</span>
          </Link>

          <p className="font-mono text-[11px] text-[var(--accent)]">
            {isRegister ? "Create your research account" : "Welcome back"}
          </p>
          <h1
            data-testid="auth-title"
            className="mt-3 text-4xl font-semibold tracking-[-0.055em]"
          >
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {registrationClosed
              ? "New accounts are not being accepted right now. Sign in if you already have one."
              : otpDisabled
                ? "This host cannot send verification email. Contact the operator."
                : isRegister
                  ? registerStep === "email"
                    ? "We will email a one-time code to verify ownership."
                    : "Enter the code and choose a password."
                  : "Continue to your latest macro and market outlook."}
          </p>

          {registerBlocked ? (
            <div className="mt-9 flex flex-col gap-3 text-sm">
              <Link
                href="/login"
                className="button-primary inline-flex min-h-12 items-center justify-center"
              >
                Sign in
              </Link>
            </div>
          ) : (
          <form
            data-testid="auth-form"
            method="post"
            action="#"
            onSubmit={onSubmit}
            className="mt-9 flex flex-col gap-5"
          >
            <label className="flex flex-col gap-2 text-xs font-medium text-[var(--muted-strong)]">
              Email address
              <input
                data-testid="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                disabled={isRegister && registerStep === "verify"}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-12 rounded-[12px] border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] transition-colors placeholder:text-[var(--muted)] hover:border-[var(--muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-70"
              />
            </label>

            {isRegister && registerStep === "verify" ? (
              <label className="flex flex-col gap-2 text-xs font-medium text-[var(--muted-strong)]">
                Verification code
                <input
                  data-testid="auth-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="\d{4,8}"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="min-h-12 rounded-[12px] border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 font-mono text-sm tracking-[0.2em] text-[var(--text)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            ) : null}

            {!isRegister || registerStep === "verify" ? (
              <label className="flex flex-col gap-2 text-xs font-medium text-[var(--muted-strong)]">
                Password
                <input
                  data-testid="auth-password"
                  type="password"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  required
                  minLength={isRegister ? REGISTER_PASSWORD_MIN : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-12 rounded-[12px] border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] transition-colors placeholder:text-[var(--muted)] hover:border-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                {isRegister ? (
                  <span className="font-normal text-[var(--muted)]">
                    At least {REGISTER_PASSWORD_MIN} characters with upper,
                    lower, number, and special character.
                  </span>
                ) : null}
              </label>
            ) : null}

            {info ? (
              <p
                data-testid="auth-info"
                className="rounded-[10px] bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent)]"
              >
                {info}
              </p>
            ) : null}

            {error ? (
              <p
                data-testid="auth-error"
                className="rounded-[10px] bg-[var(--negative-soft)] px-3 py-2.5 text-sm text-[var(--negative)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              data-testid="auth-submit"
              type="submit"
              disabled={loading}
              className="button-primary mt-1 min-h-12 w-full disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : isRegister
                  ? registerStep === "email"
                    ? "Send verification code"
                    : "Verify & create account"
                  : "Sign in"}
            </button>

            {isRegister && registerStep === "verify" ? (
              <button
                type="button"
                className="text-sm text-[var(--muted)] underline underline-offset-2"
                onClick={() => {
                  setRegisterStep("email");
                  setOtp("");
                  setInfo(null);
                  setError(null);
                }}
              >
                Use a different email
              </button>
            ) : null}
          </form>
          )}

          <div className="mt-7 flex flex-col gap-3 text-sm">
            {!registerBlocked || !isRegister ? (
            <Link
              data-testid="auth-alt-link"
              href={altHref}
              className="w-fit font-medium text-[var(--text)] underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--text)]"
            >
              {altLabel}
            </Link>
            ) : null}
            <Link
              href="/"
              className="w-fit text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            >
              Back to outlook
            </Link>
            <Link
              href="/methodology"
              className="w-fit text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            >
              Methodology
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
