"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = { id: string; email: string };

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    fetch("/api/auth/me", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = (await res.json()) as { user: User };
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div
        data-testid="auth-nav"
        className="absolute top-6 right-6 flex items-center gap-3 text-sm"
      >
        {loading ? (
          <span data-testid="auth-loading" className="text-zinc-600">
            …
          </span>
        ) : user ? (
          <>
            <span data-testid="user-email" className="text-zinc-400">
              {user.email}
            </span>
            <button
              data-testid="logout-button"
              type="button"
              onClick={logout}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              data-testid="nav-signin"
              href="/login"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900"
            >
              Sign in
            </Link>
            <Link
              data-testid="nav-register"
              href="/register"
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-zinc-950"
            >
              Register
            </Link>
          </>
        )}
      </div>

      <p className="mb-3 text-sm tracking-[0.2em] text-zinc-500 uppercase">
        Tell
      </p>
      <h1
        data-testid="home-heading"
        className="max-w-xl text-center text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        Global activity → market outlook
      </h1>
      <p className="mt-4 max-w-md text-center text-zinc-400">
        Auth ready. Next: data ingest and signals. Not financial advice.
      </p>
    </main>
  );
}
