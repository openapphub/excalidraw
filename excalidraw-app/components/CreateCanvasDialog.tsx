import React, { useState, useCallback } from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import { useAtom, useSetAtom } from "../app-jotai";
import {
  createCanvasDialogAtom,
  activeWorkspaceIdAtom,
  workspacesAtom,
} from "../app-jotai";

interface CreateCanvasDialogProps {
  onCanvasCreate: (name: string, workspaceId?: string) => void;
}

export const CreateCanvasDialog: React.FC<CreateCanvasDialogProps> = ({
  onCanvasCreate,
}) => {
  const [name, setName] = useState("Untitled Canvas");
  const setCreateCanvasDialog = useSetAtom(createCanvasDialogAtom);
  const [activeWorkspaceId] = useAtom(activeWorkspaceIdAtom);
  const [workspaces] = useAtom(workspacesAtom);
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    activeWorkspaceId,
  );

  const handleCreate = useCallback(() => {
    if (name.trim()) {
      // 新画布归属选中的分组（未选则 default 由后端兜底）。
      onCanvasCreate(name.trim(), workspaceId || undefined);
      setCreateCanvasDialog({ isOpen: false });
    }
  }, [name, workspaceId, onCanvasCreate, setCreateCanvasDialog]);

  const handleClose = useCallback(() => {
    setCreateCanvasDialog({ isOpen: false });
  }, [setCreateCanvasDialog]);

  return (
    <Dialog onCloseRequest={handleClose} title={"Create New Canvas"}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TextField
          label="Canvas Name"
          value={name}
          placeholder="Enter a name for your new canvas"
          onChange={setName}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--text-secondary-color)",
            }}
          >
            所属分组
          </label>
          <select
            value={workspaceId || "default"}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setWorkspaceId(e.target.value)
            }
            style={{
              padding: "0.5rem 0.75rem",
              background: "var(--default-bg-color)",
              border: "1px solid var(--default-border-color)",
              borderRadius: "8px",
              fontSize: "0.875rem",
              color: "var(--text-primary-color)",
            }}
          >
            <option value="default">默认分组</option>
            {workspaces
              .filter((ws) => ws.id !== "default")
              .map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
          </select>
        </div>
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
        >
          <FilledButton
            color="primary"
            label={"Create"}
            onClick={handleCreate}
          />
        </div>
      </div>
    </Dialog>
  );
};
