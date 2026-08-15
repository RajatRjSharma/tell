"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
  const title = isRegister ? "Create account" : "Sign in";
  const submitLabel = isRegister ? "Register" : "Sign in";
  const altHref = isRegister ? "/login" : "/register";
  const altLabel = isRegister
    ? "Already have an account? Sign in"
    : "Need an account? Register";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(endpoint, {
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
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-sm">
        <p className="mb-2 text-center text-sm tracking-[0.2em] text-zinc-500 uppercase">
          Tell
        </p>
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">
          {title}
        </h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-400">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-zinc-400">
            Password
            <input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-60"
          >
            {loading ? "Please wait…" : submitLabel}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href={altHref} className="text-zinc-300 hover:underline">
            {altLabel}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-zinc-600">
          <Link href="/" className="hover:underline">
            ← Back home
          </Link>
        </p>
      </div>
    </main>
  );
}
