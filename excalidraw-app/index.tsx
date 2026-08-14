import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { QueryClientProvider } from "@tanstack/react-query";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";
import { queryClient } from "./lib/queryClient";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ExcalidrawApp />
    </QueryClientProvider>
  </StrictMode>,
);
