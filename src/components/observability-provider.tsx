"use client";

import { useEffect } from "react";

import { reportClientError } from "@/lib/observability/client";

export function ObservabilityProvider() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      void reportClientError({
        message: event.message || "Unhandled window error",
        source: "window.error",
        severity: "error",
        handled: false,
        error: event.error,
        context: {
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      void reportClientError({
        message: "Unhandled promise rejection",
        source: "window.unhandledrejection",
        severity: "error",
        handled: false,
        error: event.reason,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
