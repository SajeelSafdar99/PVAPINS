"use client";

import { useEffect } from "react";

export function SwaggerPanel() {
  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css";
    document.head.appendChild(css);

    const override = document.createElement("style");
    override.textContent = `
      .swagger-panel .swagger-ui .topbar { display: none; }
      .swagger-panel .swagger-ui .information-container { display: block; }
      .swagger-panel .swagger-ui .info { display: block; margin: 20px 0; }
      .swagger-panel .swagger-ui .info .title { display: block; color: #3b4151; }
    `;
    document.head.appendChild(override);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
    script.onload = () => {
      const SwaggerUIBundle = (window as unknown as {
        SwaggerUIBundle: (opts: Record<string, unknown>) => void;
      }).SwaggerUIBundle;
      SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger",
        layout: "BaseLayout",
        deepLinking: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
    };
    document.body.appendChild(script);

    return () => {
      css.remove();
      override.remove();
      script.remove();
    };
  }, []);

  return (
    <div className="swagger-panel rounded-2xl border border-[#2a3344] bg-white p-4">
      <div id="swagger" />
    </div>
  );
}
