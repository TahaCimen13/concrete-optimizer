import type { NextConfig } from "next";

// The FastAPI backend (server-to-server URL — same machine as the Next server).
// Use 127.0.0.1 (not "localhost") so it matches uvicorn's default IPv4 bind and
// avoids Node resolving localhost to IPv6 ::1 (→ ECONNREFUSED).
function resolveBackendUrl(): string {
  let url = process.env.BACKEND_URL?.trim() || "http://127.0.0.1:8000";
  // Tolerate a value pasted without a protocol (e.g. "host.onrender.com").
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, ""); // strip any trailing slash
}

const BACKEND_URL = resolveBackendUrl();

const nextConfig: NextConfig = {
  // Proxy the Python backend under a same-origin path so the browser never makes
  // a cross-origin call. This makes the app work over localhost, the LAN IP, or
  // a deployed host without any CORS configuration.
  async rewrites() {
    return [
      {
        source: "/py/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
