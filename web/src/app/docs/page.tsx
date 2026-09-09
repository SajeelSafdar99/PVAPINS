"use client";

import { useEffect } from "react";

export default function DocsPage() {
  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
    script.onload = () => {
      const SwaggerUIBundle = (window as unknown as {
        SwaggerUIBundle: (opts: Record<string, unknown>) => void;
      }).SwaggerUIBundle;
      SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger",
        deepLinking: true,
      });
    };
    document.body.appendChild(script);

    return () => {
      css.remove();
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-zinc-200 bg-[#0b1018] px-6 py-4 text-white">
        <p className="text-xs font-semibold tracking-[0.28em] text-[#3dd6c6]">PVAPINS</p>
        <h1 className="text-xl font-semibold">API contract</h1>
        <p className="text-sm text-[#93a0b5]">
          Implement this spec on a new backend, then set NEXT_PUBLIC_API_BASE_URL.
        </p>
      </div>
      <div id="swagger" />
    </div>
  );
}
