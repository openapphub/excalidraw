import React, { useState, useRef, useId } from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import { showSuccess, showError } from "../../../utils/toast";

import styles from "./WorkspaceSettingsPage.module.scss";

import type { Workspace } from "../../../auth/workspaceApi";

// Stop keyboard events from propagating
const stopPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

export interface WorkspaceSettingsPageProps {
  workspace: Workspace | null;
  onUpdateWorkspace?: (data: { name?: string }) => Promise<void>;
  onUploadWorkspaceAvatar?: (file: File) => Promise<void>;
  onDeleteWorkspace?: () => Promise<void>;
}

export const WorkspaceSettingsPage: React.FC<WorkspaceSettingsPageProps> = ({
  workspace,
  onUpdateWorkspace,
  onUploadWorkspaceAvatar,
  onDeleteWorkspace,
}) => {
  const nameInputId = useId();
  const [name, setName] = useState(workspace?.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = async () => {
    if (!workspace || !onUpdateWorkspace) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onUpdateWorkspace({ name: name.trim() });
      setIsEditingName(false);
      showSuccess(t("settings.workspaceNameUpdated"));
    } catch (err: any) {
      setError(err.message || "Failed to update workspace name");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadWorkspaceAvatar) {
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError(t("settings.imageTooLarge"));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onUploadWorkspaceAvatar(file);
      showSuccess(t("settings.workspaceAvatarUpdated"));
    } catch (err: any) {
      setError(err.message || "Failed to update workspace avatar");
    } finally {
      setIsSaving(false);
      // Reset file input after processing is complete
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace || !onDeleteWorkspace) {
      return;
    }

    // Show confirmation dialog
    if (!confirm(t("settings.confirmDeleteWorkspace"))) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await onDeleteWorkspace();
      showSuccess(t("settings.workspaceDeleted"));
    } catch (err: any) {
      setError(err.message || "Failed to delete workspace");
      showError(err.message || "Failed to delete workspace");
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if this is a personal workspace (cannot be deleted)
  const isPersonalWorkspace = workspace?.type === "PERSONAL";

  if (!workspace) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <p>{t("settings.noWorkspaceSelected")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{t("settings.workspaceSettings")}</h1>
        <p className={styles.subtitle}>
          {t("settings.workspaceSettingsDescription")}
        </p>

        {/* Separator after header */}
        <div className={styles.separator} />

        {/* Error messages */}
        {error && <div className={styles.errorInline}>{error}</div>}

        {/* Workspace Avatar */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings.workspaceIcon")}</h2>
          <div className={styles.sectionContent}>
            <div className={styles.avatarSection}>
              <div
                className={styles.avatar}
                onClick={handleAvatarClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleAvatarClick();
                  }
                }}
              >
                {workspace.avatarUrl ? (
                  <img src={workspace.avatarUrl} alt={workspace.name} />
                ) : (
                  <div className={styles.avatarInitials}>
                    {workspace.name[0].toUpperCase()}
                  </div>
                )}
                <div className={styles.avatarOverlay}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
              <div className={styles.avatarInfo}>
                <p>{t("settings.workspaceIconDescription")}</p>
                <button
                  className={styles.buttonSecondary}
                  onClick={handleAvatarClick}
                  disabled={isSaving}
                >
                  {t("settings.changeIcon")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace Name */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings.workspaceName")}</h2>
          <div className={styles.sectionContent}>
            {isEditingName ? (
              <div className={styles.editField}>
                <input
                  id={nameInputId}
                  name="workspaceName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    stopPropagation(e);
                    if (e.key === "Enter") {
                      handleSaveName();
                    } else if (e.key === "Escape") {
                      setIsEditingName(false);
                      setName(workspace.name);
                    }
                  }}
                  onKeyUp={stopPropagation}
                  placeholder={t("settings.workspaceNamePlaceholder")}
                  autoFocus
                  className={styles.input}
                />
                <div className={styles.editActions}>
                  <button
                    className={styles.buttonPrimary}
                    onClick={handleSaveName}
                    disabled={isSaving || !name.trim()}
                  >
                    {isSaving ? t("settings.saving") : t("settings.save")}
                  </button>
                  <button
                    className={styles.buttonSecondary}
                    onClick={() => {
                      setIsEditingName(false);
                      setName(workspace.name);
                    }}
                    disabled={isSaving}
                  >
                    {t("settings.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.field}>
                <span className={styles.fieldValue}>{workspace.name}</span>
                <button
                  className={styles.editButton}
                  onClick={() => setIsEditingName(true)}
                  title={t("settings.edit")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Workspace URL */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings.workspaceUrl")}</h2>
          <div className={styles.sectionContent}>
            <div className={styles.fieldReadonly}>
              <span className={styles.fieldValueMono}>{workspace.slug}</span>
            </div>
            <p className={styles.fieldHint}>{t("settings.workspaceUrlHint")}</p>
          </div>
        </section>

        {/* Danger Zone - only show for shared workspaces */}
        {!isPersonalWorkspace && (
          <section className={styles.sectionDanger}>
            <h2 className={styles.sectionTitle}>{t("settings.dangerZone")}</h2>
            <div className={styles.dangerItem}>
              <div className={styles.dangerInfo}>
                <h3>{t("settings.deleteWorkspace")}</h3>
              </div>
              <div className={styles.dangerContent}>
                <p>{t("settings.deleteWorkspaceDescription")}</p>
                <button
                  className={styles.buttonDangerOutline}
                  onClick={handleDeleteWorkspace}
                  disabled={isDeleting || !onDeleteWorkspace}
                >
                  {isDeleting
                    ? t("settings.deleting")
                    : t("settings.deleteWorkspaceButton")}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
