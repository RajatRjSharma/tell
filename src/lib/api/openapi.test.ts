import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "@/lib/api/openapi";
import { OPENAPI_SECURED_PATHS } from "@/lib/api/protected-paths";

describe("buildOpenApiDocument", () => {
  it("covers core auth and market paths", () => {
    const doc = buildOpenApiDocument("http://localhost:3000");
    expect(doc.openapi).toBe("3.0.3");
    expect(doc.info.title).toBe("Tell API");
    expect(doc.paths["/api/auth/login"]).toBeTruthy();
    expect(doc.paths["/api/outlook"]).toBeTruthy();
    expect(doc.paths["/api/openapi"]).toBeTruthy();
    expect(doc.servers?.[0]?.url).toBe("http://localhost:3000");
  });

  it("declares cookie and bearer security schemes", () => {
    const doc = buildOpenApiDocument();
    expect(doc.components?.securitySchemes?.cookieAuth).toBeTruthy();
    expect(doc.components?.securitySchemes?.bearerAuth).toBeTruthy();
  });

  it("marks product paths as secured", () => {
    const doc = buildOpenApiDocument();
    for (const path of OPENAPI_SECURED_PATHS) {
      const item = doc.paths[path];
      expect(item, path).toBeTruthy();
      const methods = ["get", "post", "put", "patch", "delete"] as const;
      const operations = methods
        .map((method) => item?.[method])
        .filter((op): op is NonNullable<typeof op> => op != null);
      expect(operations.length, path).toBeGreaterThan(0);
      for (const op of operations) {
        expect(op.security?.length, path).toBeGreaterThan(0);
      }
    }
  });

  it("keeps bootstrap paths without required security", () => {
    const doc = buildOpenApiDocument();
    const login = doc.paths["/api/auth/login"]?.post;
    const openapi = doc.paths["/api/openapi"]?.get;
    expect(login?.security ?? []).toHaveLength(0);
    expect(openapi?.security ?? []).toHaveLength(0);
  });
});
