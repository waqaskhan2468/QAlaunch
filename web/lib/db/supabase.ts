import { createClient } from "@supabase/supabase-js";
import { Agent, fetch as undiciFetch } from "undici";

const SUPABASE_CONNECT_TIMEOUT_MS = 30_000;

const supabaseFetchAgent = new Agent({
  connectTimeout: SUPABASE_CONNECT_TIMEOUT_MS,
});

function serviceSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string" ? input
    : input instanceof URL ? input.href
    : input.url;

  return undiciFetch(url, {
    ...init,
    cache: "no-store",
    dispatcher: supabaseFetchAgent,
  } as Parameters<typeof undiciFetch>[1]).then(
    (response) => response as unknown as Response,
  ).catch((error: unknown) => {
    console.error("[supabase] fetch failed", {
      url: url.split("?")[0],
      error: error instanceof Error ? error.message : String(error),
      cause:
        error instanceof Error && error.cause != null ?
          error.cause instanceof Error ?
            error.cause.message
          : String(error.cause)
        : undefined,
    });
    throw error;
  });
}

export function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: serviceSupabaseFetch } },
  );
}

export type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: serviceSupabaseFetch } },
  );
}
