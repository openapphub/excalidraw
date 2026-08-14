import { createStore, set, get, del, entries } from "idb-keyval";

import { generateThumbnail } from "../thumbnail";
import { randomUUID } from "../random";

import type {
  CanvasData,
  CanvasMetadata,
  IStorageAdapter,
  WorkspaceMetadata,
} from "../storage";

const metadataStore = createStore("excalidraw-canvases-metadata", "metadata");
const dataStore = createStore("excalidraw-canvases-data", "data");

export class IndexedDBStorageAdapter implements IStorageAdapter {
  async listCanvases(): Promise<CanvasMetadata[]> {
    const allEntries = await entries<string, CanvasMetadata>(metadataStore);
    return allEntries.map(([, metadata]) => ({
      ...metadata,
      // 兼容历史数据没有 workspaceId 的情况。
      workspaceId: metadata.workspaceId || "default",
    }));
  }

  async loadCanvas(id: string): Promise<CanvasData | null> {
    const data = await get<CanvasData>(id, dataStore);
    return data === undefined ? null : data;
  }

  async saveCanvas(id: string, data: CanvasData): Promise<void> {
    const existingMetadata = await get<CanvasMetadata>(id, metadataStore);
    if (!existingMetadata) {
      throw new Error("Canvas metadata not found. Cannot save.");
    }
    const thumbnail = await generateThumbnail(
      data.elements,
      data.appState,
      data.files,
    );

    const updatedMetadata: CanvasMetadata = {
      ...existingMetadata,
      name: data.appState.name || existingMetadata.name,
      updatedAt: new Date().toISOString(),
      thumbnail: data.elements.length > 0 ? thumbnail : undefined,
      // 兼容历史数据没有 workspaceId 的情况。
      workspaceId:
        existingMetadata.workspaceId ||
        (data.appState as { workspaceId?: string }).workspaceId ||
        "default",
    };

    await set(id, updatedMetadata, metadataStore);
    await set(id, data, dataStore);
  }

  async createCanvas(data: CanvasData): Promise<CanvasMetadata> {
    const newId = randomUUID();
    const now = new Date().toISOString();
    const thumbnail = await generateThumbnail(
      data.elements,
      data.appState,
      data.files,
    );

    const newMetadata: CanvasMetadata = {
      id: newId,
      name: data.appState.name || "Untitled Canvas",
      createdAt: now,
      updatedAt: now,
      thumbnail: data.elements.length > 0 ? thumbnail : undefined,
      workspaceId:
        (data.appState as { workspaceId?: string }).workspaceId || "default",
    };

    await set(newId, newMetadata, metadataStore);
    await set(newId, data, dataStore);

    return newMetadata;
  }

  async deleteCanvas(id: string): Promise<void> {
    await del(id, metadataStore);
    await del(id, dataStore);
  }

  async renameCanvas(id: string, newName: string): Promise<void> {
    // Update metadata
    const existingMetadata = await get<CanvasMetadata>(id, metadataStore);
    if (!existingMetadata) {
      throw new Error("Canvas metadata not found. Cannot rename.");
    }
    await set(id, { ...existingMetadata, name: newName }, metadataStore);

    // Update canvas data
    const existingData = await get<CanvasData>(id, dataStore);
    if (!existingData) {
      // This should not happen if metadata exists, but as a safeguard:
      throw new Error("Canvas data not found. Cannot rename.");
    }
    await set(
      id,
      {
        ...existingData,
        appState: { ...existingData.appState, name: newName },
      },
      dataStore,
    );
  }

  // ---------------------------------------------------------------------------
  // Workspaces 最小实现（IndexedDB 本地模式不常用工作区功能）：
  // 统一返回空数组 / 默认值，moveCanvasToWorkspace 为 no-op，
  // 仅保证 IStorageAdapter 类型完整。
  // ---------------------------------------------------------------------------

  async listWorkspaces(): Promise<WorkspaceMetadata[]> {
    return [];
  }

  async createWorkspace(
    _name: string,
    _note?: string,
  ): Promise<WorkspaceMetadata> {
    throw new Error(
      "Workspaces are not supported by the IndexedDB storage adapter.",
    );
  }

  async updateWorkspace(
    _id: string,
    _patch: { name?: string; note?: string },
  ): Promise<void> {
    throw new Error(
      "Workspaces are not supported by the IndexedDB storage adapter.",
    );
  }

  async deleteWorkspace(_id: string): Promise<void> {
    throw new Error(
      "Workspaces are not supported by the IndexedDB storage adapter.",
    );
  }

  async moveCanvasToWorkspace(
    _canvasId: string,
    _workspaceId: string,
  ): Promise<void> {
    // no-op：本地模式下画布没有工作区概念。
  }
}
