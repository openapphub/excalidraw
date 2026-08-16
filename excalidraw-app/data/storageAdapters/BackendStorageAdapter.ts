import { dehydrateCanvasData, hydrateCanvasData } from "../storage";
import { isIndexedDbCanvasId } from "../canvasId";

import { generateThumbnail } from "../thumbnail";
import { createScene } from "../../auth/workspaceApi";
import { sceneClientHeaders } from "../../auth/sceneClient";

import type {
  CanvasData,
  CanvasMetadata,
  IStorageAdapter,
  WorkspaceMetadata,
} from "../storage";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const API_BASE_URL = "/api/v2/kv";
const WORKSPACES_BASE_URL = "/api/v2/workspaces";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...sceneClientHeaders(),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export class BackendStorageAdapter implements IStorageAdapter {
  async listCanvases(): Promise<CanvasMetadata[]> {
    const response = await fetch(API_BASE_URL, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // For list, we can just return an empty array as if the user has no canvases.
        // This prevents an error popup when a logged-out user opens the app.
        return [];
      }
      throw new Error(`Failed to list canvases: ${response.statusText}`);
    }
    // Backend doesn't send userId, so we enrich the data here.
    const canvases: Omit<CanvasMetadata, "userId">[] = await response.json();
    const token = localStorage.getItem("token");
    if (!token) {
      return [];
    }

    // 兼容后端尚未返回 workspaceId 的情况（迁移期间），统一默认 "default"。
    return canvases.map((canvas) => ({
      ...canvas,
      workspaceId: canvas.workspaceId || "default",
    }));
  }

  async loadCanvas(id: string): Promise<CanvasData | null> {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to load canvas: ${response.statusText}`);
    }
    const text = await response.text();
    if (!text.trim()) {
      return hydrateCanvasData(null);
    }
    try {
      return hydrateCanvasData(JSON.parse(text));
    } catch {
      return hydrateCanvasData(null);
    }
  }

  async saveCanvas(id: string, data: CanvasData): Promise<void> {
    // IndexedDB UUID 不得 upsert 进 SQLite。
    if (isIndexedDbCanvasId(id)) {
      console.warn("skip saving indexeddb canvas id to backend", id);
      return;
    }
    let dataForUpload: CanvasData;
    if (data.thumbnail) {
      dataForUpload = data;
    } else {
      const thumbnail = await generateThumbnail(
        data.elements,
        data.appState,
        data.files,
      );
      dataForUpload = {
        ...data,
        thumbnail: data.elements.length > 0 ? thumbnail : undefined,
      };
    }
    const saveData = dehydrateCanvasData(dataForUpload);

    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(saveData),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to save canvas:  ${response.statusText}`);
    }
  }

  async createCanvas(data: CanvasData): Promise<CanvasMetadata> {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication token not found.");
    }
    const thumbnail = await generateThumbnail(
      data.elements,
      data.appState,
      data.files,
    );
    const dataWithThumbnail: CanvasData = {
      ...data,
      thumbnail: data.elements.length > 0 ? thumbnail : undefined,
    };

    const dehydrated = dehydrateCanvasData(dataWithThumbnail);
    const scene = await createScene({
      title: data.appState?.name || "Untitled",
      data: JSON.stringify(dehydrated),
    });
    return {
      id: scene.id,
      name: scene.title,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
      thumbnail: dataWithThumbnail.thumbnail,
      workspaceId: scene.workspaceId,
    };
  }

  async deleteCanvas(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to delete canvas: ${response.statusText}`);
    }
  }

  async renameCanvas(id: string, newName: string): Promise<void> {
    const canvasData = await this.loadCanvas(id);
    if (!canvasData) {
      throw new Error("Canvas not found, cannot rename.");
    }

    const updatedData: CanvasData = {
      ...canvasData,
      appState: {
        ...canvasData.appState,
        name: newName,
      },
    };

    await this.saveCanvas(id, updatedData);
  }

  async listWorkspaces(): Promise<WorkspaceMetadata[]> {
    const response = await fetch(WORKSPACES_BASE_URL, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // 未登录时当作没有工作区处理，避免弹错误提示。
        return [];
      }
      throw new Error(`Failed to list workspaces: ${response.statusText}`);
    }
    return response.json();
  }

  async createWorkspace(
    name: string,
    note?: string,
  ): Promise<WorkspaceMetadata> {
    const response = await fetch(WORKSPACES_BASE_URL, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, note }),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to create workspace: ${response.statusText}`);
    }
    return response.json();
  }

  async updateWorkspace(
    id: string,
    patch: { name?: string; note?: string },
  ): Promise<void> {
    const response = await fetch(`${WORKSPACES_BASE_URL}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to update workspace: ${response.statusText}`);
    }
  }

  async deleteWorkspace(id: string): Promise<void> {
    const response = await fetch(`${WORKSPACES_BASE_URL}/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(`Failed to delete workspace: ${response.statusText}`);
    }
  }

  async moveCanvasToWorkspace(
    canvasId: string,
    workspaceId: string,
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/${canvasId}/workspace`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ workspaceId }),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError("User is not authenticated");
      }
      throw new Error(
        `Failed to move canvas to workspace: ${response.statusText}`,
      );
    }
  }
}
