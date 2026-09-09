export function apiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
}

export function apiUrl(path: string) {
  const prefix = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase()}${prefix}`;
}

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("pvapins_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
}

export function rememberToken(token?: string) {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem("pvapins_token", token);
  else sessionStorage.removeItem("pvapins_token");
}
