import { useEffect, useState } from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  listWorkspaces,
  copyCollectionToWorkspace,
  moveCollectionToWorkspace,
  getScene,
  type Workspace,
} from "../../../auth/workspaceApi";
import { queryClient, queryKeys } from "../../../lib/queryClient";
import { navigateTo, parseUrl } from "../../../router";
import { showError } from "../../../utils/toast";

import { getCollectionMoveRedirect } from "../collectionMutationRouting";

import styles from "./CopyMoveDialog.module.scss";

type Mode = "copy" | "move";

interface CopyMoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
  mode: Mode;
  onBeforeMutation?: () => Promise<void>;
  onSuccess?: () => void;
}

export const CopyMoveDialog: React.FC<CopyMoveDialogProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionName,
  mode,
  onBeforeMutation,
  onSuccess,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      listWorkspaces()
        .then((ws) =>
          setWorkspaces(
            ws.filter((workspace) => workspace.type !== "PERSONAL"),
          ),
        )
        .catch((error) => console.error("Failed to load workspaces", error));
      setSelectedWorkspace("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedWorkspace) {
      return;
    }

    setIsLoading(true);
    try {
      const routeAtSubmit = parseUrl();
      let currentSceneBelongsToCollection = false;
      if (routeAtSubmit.type === "scene") {
        try {
          const currentScene = await getScene(routeAtSubmit.sceneId);
          currentSceneBelongsToCollection =
            currentScene.collectionId === collectionId;
        } catch (error) {
          throw new Error("无法验证当前 Scene 的 Collection 归属。", {
            cause: error,
          });
        }
      }
      if (currentSceneBelongsToCollection) {
        await onBeforeMutation?.();
      }
      if (mode === "copy") {
        await copyCollectionToWorkspace(collectionId, selectedWorkspace);
      } else {
        await moveCollectionToWorkspace(collectionId, selectedWorkspace);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.collections.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all }),
      ]);
      if (mode === "move") {
        const targetWorkspace = workspaces.find(
          (workspace) => workspace.id === selectedWorkspace,
        );
        const currentRoute = parseUrl();
        if (targetWorkspace) {
          const redirect = getCollectionMoveRedirect({
            routeAtStart: routeAtSubmit,
            currentRoute,
            collectionId,
            currentSceneBelongsToCollection,
            targetWorkspaceSlug: targetWorkspace.slug,
          });
          if (redirect) {
            navigateTo(redirect);
          }
        }
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to submit copy/move", error);
      showError(
        error instanceof Error
          ? error.message
          : t("workspace.updateCollectionError"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t(`workspace.${mode}ToWorkspace` as const)}
    >
      <div className={styles.dialog}>
        <p>
          {mode === "copy"
            ? t("workspace.copyDescription", { name: collectionName })
            : t("workspace.moveDescription", { name: collectionName })}
        </p>

        <label className={styles.label}>
          {t("workspace.selectWorkspace")}
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
          >
            <option value="">{t("workspace.selectWorkspace")}</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.actions}>
          <FilledButton
            variant="outlined"
            onClick={onClose}
            label={t("buttons.cancel")}
          />
          <FilledButton
            label={mode === "copy" ? t("buttons.copy") : t("buttons.move")}
            onClick={() => {
              if (!selectedWorkspace || isLoading) {
                return;
              }
              handleSubmit();
            }}
            status={isLoading ? "loading" : null}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default CopyMoveDialog;
