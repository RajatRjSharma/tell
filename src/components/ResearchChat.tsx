"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export function ResearchChat({
  symbol,
  horizon,
  open,
  onOpenChange,
}: {
  symbol: string;
  horizon: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, turns, loading]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setInput("");
    setError(null);
    setLoading(true);
    setTurns((current) => [...current, { role: "user", content: message }]);

    try {
      const history = turns.slice(-6);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          symbol,
          horizon,
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
        citations?: string[];
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Chat unavailable");
      }

      const citationNote =
        data.citations && data.citations.length > 0
          ? `\n\nSources: ${data.citations.slice(0, 4).join(" · ")}`
          : "";

      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: `${data.answer ?? ""}${citationNote}`,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Chat unavailable");
      setTurns((current) => current.slice(0, -1));
      setInput(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button-secondary"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        Ask Tell
      </button>

      {open ? (
        <div className="chat-drawer" role="dialog" aria-label="Ask Tell">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em]">
                Ask Tell
              </p>
              <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                Groq · grounded in {symbol} / {horizon}
              </p>
            </div>
            <button
              type="button"
              className="font-mono text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => onOpenChange(false)}
            >
              Close
            </button>
          </div>

          <div ref={listRef} className="chat-thread">
            {turns.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Ask about the regime, a signal, or why an asset looks bullish or
                bearish. Answers use your Turso evidence only.
              </p>
            ) : (
              turns.map((turn, index) => (
                <div
                  key={`${turn.role}-${index}`}
                  className={`chat-bubble chat-bubble-${turn.role}`}
                >
                  {turn.content}
                </div>
              ))
            )}
            {loading ? (
              <div className="chat-bubble chat-bubble-assistant">Thinking…</div>
            ) : null}
            {error ? (
              <p className="text-sm text-[var(--negative)]" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-[var(--line)] p-3"
          >
            <label className="sr-only" htmlFor="ask-tell-input">
              Research question
            </label>
            <div className="flex gap-2">
              <input
                id="ask-tell-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Why is TLT bearish?"
                className="min-h-11 flex-1 rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                className="button-primary min-h-11"
                disabled={loading || !input.trim()}
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted)]">
              Research aid only. Not financial advice.
            </p>
          </form>
        </div>
      ) : null}
    </>
  );
}
