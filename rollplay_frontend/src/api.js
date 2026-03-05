// src/api.js
import { BACKEND_URL } from "./config";

/**
 * Basic JSON fetch helper.
 * Automatically:
 *  - prefixes routes with BACKEND_URL
 *  - sends JSON body
 *  - optionally includes auth token
 */
export async function apiFetch(path, { method = "GET", body, token, headers } = {}) {
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.message ||
      `Request failed (${res.status}) ${res.statusText}`;
    throw new Error(msg);
  }

  return json;
}