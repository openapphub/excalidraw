import { useState, useCallback, useEffect } from "react";

import { AuthError } from "../data/storageAdapters/BackendStorageAdapter";

import { useSetAtom, workspacesAtom } from "../app-jotai";

import type { IStorageAdapter, WorkspaceMetadata } from "../data/storage";

/**
 * 工作区（Workspaces）管理 hook：负责加载/创建/更新/删除工作区，
 * 以及把画布移动到某个工作区。错误处理风格与 useCanvasManagement 一致
 * （AuthError 提示登录，其余走 setErrorMessage / console.error）。
 */
export const useWorkspaces = ({
  storageAdapter,
  setErrorMessage,
}: {
  storageAdapter: IStorageAdapter;
  setErrorMessage: (msg: string) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const setWorkspaces = useSetAtom(workspacesAtom);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const workspaces = await storageAdapter.listWorkspaces();
      setWorkspaces(workspaces);
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not list your workspaces.");
    }
  }, [storageAdapter, setErrorMessage, setWorkspaces]);

  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshWorkspaces();
    } finally {
      setIsLoading(false);
    }
  }, [refreshWorkspaces]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const createWorkspace = useCallback(
    async (name: string, note?: string) => {
      try {
        const workspace = await storageAdapter.createWorkspace(name, note);
        await refreshWorkspaces();
        return workspace;
      } catch (error: any) {
        if (error instanceof AuthError) {
          setErrorMessage("您需要登录才能创建工作区。");
        } else {
          setErrorMessage("Could not create the workspace.");
        }
        return null;
      }
    },
    [storageAdapter, refreshWorkspaces, setErrorMessage],
  );

  const updateWorkspace = useCallback(
    async (id: string, patch: { name?: string; note?: string }) => {
      try {
        await storageAdapter.updateWorkspace(id, patch);
        await refreshWorkspaces();
      } catch (error: any) {
        if (error instanceof AuthError) {
          setErrorMessage("您需要登录才能更新工作区。");
        } else {
          setErrorMessage("Could not update the workspace.");
        }
      }
    },
    [storageAdapter, refreshWorkspaces, setErrorMessage],
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      try {
        await storageAdapter.deleteWorkspace(id);
        await refreshWorkspaces();
      } catch (error: any) {
        if (error instanceof AuthError) {
          setErrorMessage("您需要登录才能删除工作区。");
        } else {
          setErrorMessage("Could not delete the workspace.");
        }
      }
    },
    [storageAdapter, refreshWorkspaces, setErrorMessage],
  );

  const moveCanvasToWorkspace = useCallback(
    async (canvasId: string, workspaceId: string) => {
      try {
        await storageAdapter.moveCanvasToWorkspace(canvasId, workspaceId);
      } catch (error: any) {
        if (error instanceof AuthError) {
          setErrorMessage("您需要登录才能移动画布。");
        } else {
          setErrorMessage("Could not move the canvas.");
        }
      }
    },
    [storageAdapter, setErrorMessage],
  );

  return {
    isLoading,
    refreshWorkspaces,
    loadWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    moveCanvasToWorkspace,
  };
};
