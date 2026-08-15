import type { OpenAPIV3 } from "openapi-types";

const errorSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string" },
  },
};

const userSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  required: ["id", "email", "username"],
  properties: {
    id: { type: "string" },
    email: { type: "string", format: "email" },
    username: { type: "string" },
  },
};

const sessionSecurity: OpenAPIV3.SecurityRequirementObject[] = [
  { cookieAuth: [] },
  { bearerAuth: [] },
];

/** OpenAPI 3.0 document for Tell HTTP APIs. */
export function buildOpenApiDocument(serverUrl?: string): OpenAPIV3.Document {
  return {
    openapi: "3.0.3",
    info: {
      title: "Tell API",
      version: "0.1.0",
      description:
        "Global macro research API. Most routes need a session cookie (`tell_session`) or `Authorization: Bearer <jwt>`. Mutating cookie requests also need a same-origin `Origin`/`Referer` (CSRF). See docs/API.md for full narrative docs.",
    },
    servers: [
      {
        url: serverUrl && serverUrl.length > 0 ? serverUrl : "/",
        description: "Current host",
      },
    ],
    tags: [
      { name: "Auth" },
      { name: "Market" },
      { name: "Events" },
      { name: "Watchlist" },
      { name: "Alerts" },
      { name: "AI" },
      { name: "System" },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "tell_session",
          description: "HttpOnly session JWT cookie set by login / OTP verify.",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Same session JWT as the cookie, for API clients.",
        },
      },
      schemas: {
        Error: errorSchema,
        User: userSchema,
        AuthConfig: {
          type: "object",
          required: ["registrationEnabled", "emailOtpEnabled"],
          properties: {
            registrationEnabled: { type: "boolean" },
            emailOtpEnabled: { type: "boolean" },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { error: "Authentication required" },
            },
          },
        },
        BadRequest: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
    paths: {
      "/api/auth/config": {
        get: {
          tags: ["Auth"],
          summary: "Public registration / OTP flags",
          responses: {
            "200": {
              description: "Flags for login/register UI",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthConfig" },
                },
              },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current session user",
          responses: {
            "200": {
              description: "Signed in",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Signed out (`{ user: null }`)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { user: { nullable: true } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Sign in with email or username",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["password"],
                  properties: {
                    identifier: {
                      type: "string",
                      description: "Email address or username",
                    },
                    email: { type: "string", format: "email" },
                    username: { type: "string" },
                    password: { type: "string", minLength: 8 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Session cookie set",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "400": { $ref: "#/components/responses/BadRequest" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Clear session cookie",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
                example: {},
              },
            },
          },
          responses: {
            "200": {
              description: "Logged out",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { ok: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Disabled direct register (use OTP)",
          responses: {
            "403": {
              description: "Points to OTP endpoints",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/auth/otp/request": {
        post: {
          tags: ["Auth"],
          summary: "Email a registration OTP",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: {
                    email: { type: "string", format: "email" },
                    username: { type: "string" },
                    purpose: {
                      type: "string",
                      enum: ["register"],
                      default: "register",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Code sent (may include `devCode` when echo is on)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      expiresAt: { type: "string" },
                      expireMinutes: { type: "integer" },
                      devCode: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "409": { $ref: "#/components/responses/BadRequest" },
            "503": { $ref: "#/components/responses/BadRequest" },
          },
        },
      },
      "/api/auth/otp/verify": {
        post: {
          tags: ["Auth"],
          summary: "Verify OTP and create account",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "email",
                    "username",
                    "password",
                    "confirmPassword",
                    "otp",
                  ],
                  properties: {
                    email: { type: "string", format: "email" },
                    username: { type: "string" },
                    password: { type: "string", minLength: 12 },
                    confirmPassword: { type: "string", minLength: 12 },
                    otp: { type: "string", pattern: "^\\d{4,8}$" },
                    purpose: {
                      type: "string",
                      enum: ["register"],
                      default: "register",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Account created; session cookie set",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
          },
        },
      },
      "/api/assets": {
        get: {
          tags: ["Market"],
          summary: "Asset universe",
          security: sessionSecurity,
          responses: {
            "200": { description: "{ assets, count }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/readings": {
        get: {
          tags: ["Market"],
          summary: "Macro series readings",
          security: sessionSecurity,
          parameters: [
            {
              name: "country",
              in: "query",
              required: true,
              schema: { type: "string", pattern: "^[A-Z]{2}$" },
              example: "US",
            },
            {
              name: "indicator",
              in: "query",
              required: true,
              schema: { type: "string", pattern: "^[A-Z0-9_]{2,32}$" },
              example: "CPI",
            },
            {
              name: "from",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "to",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 120, maximum: 2000 },
            },
          ],
          responses: {
            "200": {
              description: "{ countryCode, indicatorId, count, readings }",
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/outlook": {
        get: {
          tags: ["Market"],
          summary: "Latest outlook signals",
          security: sessionSecurity,
          parameters: [
            {
              name: "asOf",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "symbols",
              in: "query",
              schema: { type: "string" },
              description: "Comma-separated symbols",
              example: "SPY,QQQ",
            },
            {
              name: "horizons",
              in: "query",
              schema: { type: "string" },
              example: "1d,1w,1m",
            },
          ],
          responses: {
            "200": {
              description:
                "{ asOf, modelVersion, count, bySymbol, signals, disclaimer }",
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/outlook/{symbol}": {
        get: {
          tags: ["Market"],
          summary: "Per-symbol outlook (+ optional live quote)",
          security: sessionSecurity,
          parameters: [
            {
              name: "symbol",
              in: "path",
              required: true,
              schema: { type: "string" },
              example: "SPY",
            },
            {
              name: "asOf",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "live",
              in: "query",
              schema: { type: "string", enum: ["1", "true"] },
            },
          ],
          responses: {
            "200": { description: "{ asset, signals, quote, disclaimer }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/BadRequest" },
          },
        },
      },
      "/api/charts/{symbol}": {
        get: {
          tags: ["Market"],
          summary: "Price bars with signal markers",
          security: sessionSecurity,
          parameters: [
            {
              name: "symbol",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "from",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "to",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "horizon",
              in: "query",
              schema: { type: "string", example: "1d" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 90, maximum: 400 },
            },
          ],
          responses: {
            "200": { description: "{ bars, signals, changePct, disclaimer }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/quality": {
        get: {
          tags: ["Market"],
          summary: "Forecast hit-rate quality report",
          security: sessionSecurity,
          parameters: [
            {
              name: "symbol",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "{ overall, byHorizon, bySymbol, recent }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/macro/strip": {
        get: {
          tags: ["Market"],
          summary: "Macro sparkline strip",
          security: sessionSecurity,
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 24, maximum: 120 },
            },
          ],
          responses: {
            "200": { description: "{ strip }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/risk/near-term": {
        get: {
          tags: ["Market"],
          summary: "Today / tomorrow risk bias",
          security: sessionSecurity,
          responses: {
            "200": { description: "{ asOf, today, tomorrow, sampleSize }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/events": {
        get: {
          tags: ["Events"],
          summary: "Policy / central-bank events",
          security: sessionSecurity,
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 30, maximum: 100 },
            },
            { name: "country", in: "query", schema: { type: "string" } },
            { name: "source", in: "query", schema: { type: "string" } },
            { name: "symbol", in: "query", schema: { type: "string" } },
            {
              name: "since",
              in: "query",
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            "200": { description: "{ count, events }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/events/impact": {
        get: {
          tags: ["Events"],
          summary: "Event study statistics",
          security: sessionSecurity,
          parameters: [
            { name: "source", in: "query", schema: { type: "string" } },
            { name: "symbol", in: "query", schema: { type: "string" } },
            {
              name: "sentiment",
              in: "query",
              schema: {
                type: "string",
                enum: ["any", "hawkish", "dovish"],
                default: "any",
              },
            },
            {
              name: "horizons",
              in: "query",
              schema: { type: "string", default: "1d,1w,1m" },
            },
          ],
          responses: {
            "200": { description: "{ report } or { report: null, message }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/watchlist": {
        get: {
          tags: ["Watchlist"],
          summary: "List saved symbols",
          security: sessionSecurity,
          responses: {
            "200": {
              description: "{ symbols }",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      symbols: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Watchlist"],
          summary: "Add symbol",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["symbol"],
                  properties: { symbol: { type: "string", example: "SPY" } },
                },
              },
            },
          },
          responses: {
            "201": { description: "{ symbols }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        delete: {
          tags: ["Watchlist"],
          summary: "Remove symbol",
          security: sessionSecurity,
          parameters: [
            {
              name: "symbol",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "{ symbols }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/alerts": {
        get: {
          tags: ["Alerts"],
          summary: "Rules, inbox, unread count",
          security: sessionSecurity,
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 30, maximum: 100 },
            },
          ],
          responses: {
            "200": { description: "{ rules, events, unreadCount }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Alerts"],
          summary: "Create alert rule",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["symbol", "ruleType"],
                  properties: {
                    symbol: { type: "string" },
                    horizon: {
                      type: "string",
                      enum: ["1d", "1w", "1m"],
                      default: "1d",
                    },
                    ruleType: {
                      type: "string",
                      enum: [
                        "direction_change",
                        "became_direction",
                        "confidence_below",
                      ],
                    },
                    ruleValue: {
                      description:
                        "Direction string or confidence number depending on ruleType",
                      oneOf: [{ type: "string" }, { type: "number" }],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "{ rule }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/alerts/rules/{id}": {
        patch: {
          tags: ["Alerts"],
          summary: "Enable or disable a rule",
          security: sessionSecurity,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["enabled"],
                  properties: { enabled: { type: "boolean" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "{ rule }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        delete: {
          tags: ["Alerts"],
          summary: "Delete a rule",
          security: sessionSecurity,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
          ],
          responses: {
            "200": { description: "{ ok: true }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/alerts/read": {
        post: {
          tags: ["Alerts"],
          summary: "Mark alert events read",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    all: { type: "boolean" },
                    eventIds: {
                      type: "array",
                      items: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "{ updated }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/brief": {
        get: {
          tags: ["AI"],
          summary: "Gemini research brief",
          security: sessionSecurity,
          parameters: [
            { name: "symbol", in: "query", schema: { type: "string" } },
            {
              name: "horizon",
              in: "query",
              schema: { type: "string", default: "1d" },
            },
            {
              name: "refresh",
              in: "query",
              schema: { type: "string", enum: ["1"] },
            },
          ],
          responses: {
            "200": { description: "Brief payload" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/brief/history": {
        get: {
          tags: ["AI"],
          summary: "Stored brief history",
          security: sessionSecurity,
          parameters: [
            { name: "symbol", in: "query", schema: { type: "string" } },
            {
              name: "horizon",
              in: "query",
              schema: { type: "string", default: "1d" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 7, maximum: 30 },
            },
          ],
          responses: {
            "200": { description: "{ briefs, count }" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/chat": {
        post: {
          tags: ["AI"],
          summary: "Grounded research chat",
          security: sessionSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: { type: "string" },
                    symbol: { type: "string" },
                    horizon: { type: "string", default: "1d" },
                    history: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string" },
                          content: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Chat answer payload" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "Liveness / health report",
          parameters: [
            {
              name: "deep",
              in: "query",
              schema: { type: "string", enum: ["1", "true"] },
              description: "Also probe Yahoo / Finnhub",
            },
          ],
          responses: {
            "200": { description: "Healthy or degraded" },
            "503": { description: "Critical failure" },
          },
        },
      },
      "/api/ready": {
        get: {
          tags: ["System"],
          summary: "Readiness (same checks as health)",
          responses: {
            "200": { description: "Ready" },
            "503": { description: "Not ready" },
          },
        },
      },
      "/api/openapi": {
        get: {
          tags: ["System"],
          summary: "This OpenAPI document",
          responses: {
            "200": {
              description: "OpenAPI 3.0 JSON",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  };
}
