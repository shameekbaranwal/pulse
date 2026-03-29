import type { PulseConfig } from "./config";

function getAllowedOrigin(config: PulseConfig, request: Request): string {
  const requestOrigin = request.headers.get("Origin");

  if (config.allowedOrigins.includes("*")) {
    return requestOrigin || "*";
  }

  if (requestOrigin && config.allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return config.allowedOrigins[0] || "*";
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export function buildCacheHeaders(maxAgeSeconds: number): Record<string, string> {
  return {
    "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds}`,
  };
}

export function jsonResponse(config: PulseConfig, request: Request, data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers();
  const initialHeaders = new Headers(init.headers as any);
  initialHeaders.forEach((value, key) => headers.set(key, value));
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Access-Control-Allow-Origin", getAllowedOrigin(config, request));
  headers.set("Vary", "Origin");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function optionsResponse(config: PulseConfig, request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": getAllowedOrigin(config, request),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "86400",
    },
  });
}
