
const FETCH_HOMEPAGE_TIMEOUT_MS = 15_000;

export async function fetchHomepageHtml(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_HOMEPAGE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "QAlaunch-Bot/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Failed to fetch homepage: ${res.status}`);
    return res.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Homepage fetch timed out after ${FETCH_HOMEPAGE_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

