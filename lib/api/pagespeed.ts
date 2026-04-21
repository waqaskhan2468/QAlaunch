
export async function fetchHomepageHtml(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "QAlaunch-Bot/1.0" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`Failed to fetch homepage: ${res.status}`);
  return res.text();
}


