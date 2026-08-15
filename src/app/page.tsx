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
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = (await res.json()) as { user: User };
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="absolute top-6 right-6 flex items-center gap-3 text-sm">
        {loading ? (
          <span className="text-zinc-600">…</span>
        ) : user ? (
          <>
            <span className="text-zinc-400">{user.email}</span>
            <button
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
              href="/login"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900"
            >
              Sign in
            </Link>
            <Link
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
      <h1 className="max-w-xl text-center text-3xl font-semibold tracking-tight sm:text-4xl">
        Global activity → market outlook
      </h1>
      <p className="mt-4 max-w-md text-center text-zinc-400">
        Auth ready. Next: data ingest and signals. Not financial advice.
      </p>
    </main>
  );
}
