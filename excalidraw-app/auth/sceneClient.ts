const LOCK_CLIENT_KEY = "excalidraw-scene-lock-client-id";

export function getSceneClientId(): string {
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

export function sceneClientHeaders(): Record<string, string> {
  return { "X-Scene-Client-ID": getSceneClientId() };
}
