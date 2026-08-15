import type { Metadata } from "next";
import Link from "next/link";
import { SwaggerDocs } from "@/components/SwaggerDocs";

export const metadata: Metadata = {
  title: "API docs",
  description: "Tell OpenAPI / Swagger reference",
};

export default function DocsPage() {
  return (
    <div className="min-h-[100dvh] bg-white text-neutral-900">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 backdrop-blur">
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm font-semibold tracking-[-0.02em]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-neutral-900 font-mono text-[10px] text-white">
            T
          </span>
          Tell API
        </Link>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <a className="hover:text-neutral-900" href="/api/openapi">
            openapi.json
          </a>
          <Link className="hover:text-neutral-900" href="/login">
            Sign in
          </Link>
        </div>
      </header>
      <SwaggerDocs />
    </div>
  );
}
