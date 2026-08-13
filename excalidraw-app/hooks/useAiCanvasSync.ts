import { useEffect, useRef } from "react";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Live-sync hook for AI canvases (id prefix "ai-").
 *
 * When the user opens an AI canvas, this hook connects to the server's
 * /ws endpoint and applies incremental element updates broadcast by the
 * mcp-excalidraw API (element_created / element_updated / element_deleted /
 * elements_batch_created / canvas_cleared / initial_elements). Broadcasts
 * carry a canvasId; messages for other canvases are ignored.
 *
 * All updates use CaptureUpdateAction.NEVER so applying remote changes does
 * not trigger the onChange -> save loop (the server already persisted them).
 */
const AI_CANVAS_PREFIX = "ai-";

export function useAiCanvasSync(
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  currentCanvasId: string | null,
) {
  const apiRef = useRef(excalidrawAPI);
  apiRef.current = excalidrawAPI;
  const canvasIdRef = useRef(currentCanvasId);
  canvasIdRef.current = currentCanvasId;

  useEffect(() => {
    if (!currentCanvasId || !currentCanvasId.startsWith(AI_CANVAS_PREFIX) || !excalidrawAPI) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    let closed = false;

    const applyElements = (elements: any[]) => {
      const api = apiRef.current;
      if (!api || !elements || elements.length === 0) {
        return;
      }
      // Merge with current scene: replace matching ids, append new ones.
      const current = api.getSceneElements();
      const incomingById = new Map<string, any>();
      elements.forEach((el: any) => {
        if (el && el.id) {
          incomingById.set(el.id, el);
        }
      });
      const merged = current.map((el: any) => {
        const incoming = incomingById.get(el.id);
        if (!incoming) {
          return el;
        }
        incomingById.delete(el.id);
        return { ...el, ...incoming };
      });
      incomingById.forEach((el: any) => merged.push(el));
      api.updateScene({
        elements: merged,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    };

    ws.onopen = () => {
      // Server pushes initial_elements on connect.
    };

    ws.onmessage = (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      // Ignore broadcasts for other canvases (server sends all AI canvases
      // on the same socket; only this canvas's messages apply).
      if (data.canvasId && data.canvasId !== canvasIdRef.current) {
        return;
      }
      const api = apiRef.current;
      if (!api) {
        return;
      }
      switch (data.type) {
        case "initial_elements":
          if (data.elements && data.elements.length > 0) {
            api.updateScene({
              elements: data.elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
          break;
        case "element_created":
        case "element_updated":
          if (data.element) {
            applyElements([data.element]);
          }
          break;
        case "elements_batch_created":
          if (data.elements) {
            applyElements(data.elements);
          }
          break;
        case "elements_synced":
          // Full-scene sync (frontend edited the canvas and the server
          // echoed it back). Replace wholesale. CaptureUpdateAction.NEVER
          // prevents an onChange loop.
          if (data.elements && Array.isArray(data.elements)) {
            api.updateScene({
              elements: data.elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
          break;
        case "element_deleted":
        if (data.elementId) {
          const filtered = api
            .getSceneElements()
            .filter((el: any) => el.id !== data.elementId);
          api.updateScene({
            elements: filtered,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
        break;
        case "canvas_cleared":
          api.updateScene({
            elements: [],
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      if (!closed) {
        // Reconnect after 3s.
        setTimeout(() => {
          if (apiRef.current) {
            // Re-run effect by toggling a state is complex; simplest is to
            // re-create the connection via a recursive call.
            reconnect();
          }
        }, 3000);
      }
    };

    const reconnect = () => {
      if (closed) {
        return;
      }
      const api = apiRef.current;
      if (!api) {
        return;
      }
      const ws2 = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws2.onmessage = ws.onmessage;
      ws2.onclose = ws.onclose;
      ws2.onopen = ws.onopen;
    };

    return () => {
      closed = true;
      ws.close();
    };
  }, [currentCanvasId, excalidrawAPI]);
}
