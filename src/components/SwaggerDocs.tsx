"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <p className="p-8 text-sm text-[var(--muted)]">Loading API docs…</p>
  ),
});

export function SwaggerDocs() {
  return (
    <div className="swagger-wrap min-h-[100dvh] bg-white">
      <SwaggerUI
        url="/api/openapi"
        docExpansion="list"
        defaultModelsExpandDepth={0}
      />
    </div>
  );
}
