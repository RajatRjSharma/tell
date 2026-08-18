import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/BrandMark";
import { SwaggerDocs } from "@/components/SwaggerDocs";

export const metadata: Metadata = {
  title: "API docs",
  description: "Tell OpenAPI / Swagger reference",
};

export default function DocsPage() {
  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-white text-neutral-900">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-2 border-b border-neutral-200 bg-white/95 px-3 backdrop-blur sm:h-14 sm:gap-3 sm:px-4">
        <Link href="/login" className="flex min-w-0 items-center">
          <BrandWordmark label="Tell API" />
        </Link>
        <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
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
