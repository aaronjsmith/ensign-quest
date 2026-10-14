const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const PROJECT_DOMAIN = "ensign.quest";
const PROJECT_RECORD_TYPES = new Set(["A", "AAAA", "CNAME"]);
const EXCLUDED_LABELS = new Set([
  "autodiscover",
  "ftp",
  "imap",
  "mail",
  "pop",
  "smtp",
  "www",
]);
const CACHE_TTL_SECONDS = 300;

function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function normalizeHostname(name) {
  return name.toLowerCase().replace(/\.$/, "");
}

function isProjectRecord(record) {
  if (!PROJECT_RECORD_TYPES.has(record.type)) return false;

  const hostname = normalizeHostname(record.name);
  const suffix = `.${PROJECT_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return false;

  const labels = hostname.slice(0, -suffix.length).split(".");
  if (labels.some((label) => !label || label.startsWith("_"))) return false;
  return labels.length !== 1 || !EXCLUDED_LABELS.has(labels[0]);
}

function displayName(hostname) {
  const label = hostname.slice(0, -(`.${PROJECT_DOMAIN}`).length);
  return label
    .split(".")
    .at(-1)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function fetchAllDnsRecords(env) {
  if (!env.CF_ZONE_ID) {
    throw new Error("CF_ZONE_ID secret is not configured");
  }
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN secret is not configured");
  }

  const records = [];
  let page = 1;

  while (page <= 100) {
    const url = new URL(
      `${CLOUDFLARE_API}/zones/${encodeURIComponent(env.CF_ZONE_ID)}/dns_records`,
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "1000");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      },
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(`Cloudflare DNS API returned HTTP ${response.status}`);
    }

    records.push(...payload.result);
    const totalPages = Number(payload.result_info?.total_pages || page);
    if (page >= totalPages) break;
    page += 1;
  }

  return records;
}

async function loadProjects(env) {
  const records = await fetchAllDnsRecords(env);
  const projects = new Map();

  for (const record of records) {
    if (!isProjectRecord(record)) continue;

    const host = normalizeHostname(record.name);
    projects.set(host, {
      name: displayName(host),
      host,
      url: `https://${host}/`,
    });
  }

  return [...projects.values()].sort((a, b) => a.host.localeCompare(b.host));
}

async function projectResponse(request, env, ctx) {
  const cacheKey = new Request(new URL("/api/projects", request.url));
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const projects = await loadProjects(env);
  const response = jsonResponse(
    { projects },
    {
      headers: {
        "cache-control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
      },
    },
  );

  ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/projects") {
      if (request.method !== "GET") {
        return jsonResponse(
          { error: "Method not allowed" },
          { status: 405, headers: { allow: "GET" } },
        );
      }

      try {
        return await projectResponse(request, env, ctx);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            message: "project discovery failed",
            error: message,
            path: url.pathname,
          }),
        );
        return jsonResponse(
          { error: "Project discovery is temporarily unavailable" },
          { status: 502, headers: { "cache-control": "no-store" } },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
