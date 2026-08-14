import { useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { ApiError } from "../auth/api/client";
import {
  acquireSceneLock,
  releaseSceneLock,
} from "../auth/workspaceApi";
import {
  sceneCollabEnabledAtom,
  sceneEditLockAtom,
} from "../components/Settings/settingsState";
import { userAtom, useAtomValue, useSetAtom } from "../app-jotai";
import { isBackendPersistableCanvasId } from "../data/canvasId";

import type { SceneEditor } from "../auth/api/types";

const LOCK_CLIENT_KEY = "excalidraw-scene-lock-client-id";
const HEARTBEAT_MS = 10_000;

export function getSceneLockClientId(): string {
  try {
    const existing = window.sessionStorage.getItem(LOCK_CLIENT_KEY);
    if (existing) {
      return existing;
    }
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(LOCK_CLIENT_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function editorFromError(error: unknown): SceneEditor | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null;
  }
  const raw = error.body?.editor;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const editor = raw as Partial<SceneEditor>;
  return {
    userId: String(editor.userId ?? ""),
    name: String(editor.name ?? "同事"),
    isSelf: Boolean(editor.isSelf),
  };
}

export function useSceneEditLock({
  sceneId,
  canEdit,
  excalidrawAPI,
}: {
  sceneId: string | null;
  canEdit: boolean | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined;
}) {
  const collabEnabled = useAtomValue(sceneCollabEnabledAtom);
  const user = useAtomValue(userAtom);
  const setLock = useSetAtom(sceneEditLockAtom);
  const heldSceneRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !sceneId ||
      !isBackendPersistableCanvasId(sceneId) ||
      canEdit === false ||
      collabEnabled
    ) {
      if (heldSceneRef.current) {
        const prev = heldSceneRef.current;
        heldSceneRef.current = null;
        void releaseSceneLock(prev, getSceneLockClientId()).catch(() => {});
      }
      setLock(null);
      return;
    }

    const clientId = getSceneLockClientId();
    const displayName = user?.name || user?.login || "同事";
    let cancelled = false;
    let timer: number | undefined;

    const applyLocked = (editor: SceneEditor | null) => {
      setLock({
        locked: true,
        editorName: editor?.name || "同事",
        isOtherTab: Boolean(editor?.isSelf),
      });
      excalidrawAPI?.updateScene({
        appState: { viewModeEnabled: true },
      });
    };

    const applyOwned = () => {
      heldSceneRef.current = sceneId;
      setLock({ locked: false, editorName: null, isOtherTab: false });
      excalidrawAPI?.updateScene({
        appState: { viewModeEnabled: false },
      });
    };

    const beat = async () => {
      try {
        await acquireSceneLock(sceneId, clientId, displayName);
        if (!cancelled) {
          applyOwned();
        }
      } catch (error) {
        const editor = editorFromError(error);
        if (!cancelled) {
          heldSceneRef.current = null;
          if (editor) {
            applyLocked(editor);
          } else {
            console.error("Failed to acquire scene lock:", error);
          }
        }
      }
    };

    void beat();
    timer = window.setInterval(beat, HEARTBEAT_MS);

    const onUnload = () => {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      void fetch(
        `/api/v2/workspace/scenes/${encodeURIComponent(
          sceneId,
        )}/lock?clientId=${encodeURIComponent(clientId)}`,
        { method: "DELETE", headers, keepalive: true },
      );
    };
    window.addEventListener("pagehide", onUnload);

    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
      window.removeEventListener("pagehide", onUnload);
      if (heldSceneRef.current === sceneId) {
        heldSceneRef.current = null;
        void releaseSceneLock(sceneId, clientId).catch(() => {});
      }
    };
  }, [
    sceneId,
    canEdit,
    collabEnabled,
    excalidrawAPI,
    user?.name,
    user?.login,
    setLock,
  ]);
}
