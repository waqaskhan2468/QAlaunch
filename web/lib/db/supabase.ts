import { createClient } from "@supabase/supabase-js";

function serviceSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string" ? input
    : input instanceof URL ? input.href
    : input.url;

  return fetch(input, { ...init, cache: "no-store" }).catch((error: unknown) => {
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

export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: serviceSupabaseFetch },
    },
  );
}

export type ServiceSupabase = ReturnType<typeof getServiceSupabase>;
