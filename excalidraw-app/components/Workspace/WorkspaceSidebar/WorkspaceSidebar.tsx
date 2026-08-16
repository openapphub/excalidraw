import React, { useEffect, useState, useCallback, useMemo } from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import { useAtom, useAtomValue, useSetAtom } from "../../../app-jotai";
import { useAuth } from "../../../auth";

import { useWorkspaces } from "../../../hooks/useWorkspaces";
import { useCollections } from "../../../hooks/useCollections";
import {
  useScenesCache,
  useInvalidateScenesCache,
} from "../../../hooks/useScenesCache";
import { useSceneActions } from "../../../hooks/useSceneActions";

import {
  navigateToDashboardAtom,
  navigateToCollectionAtom,
  navigateToCanvasAtom,
  navigateToProfileAtom,
  navigateToPreferencesAtom,
  navigateToWorkspaceSettingsAtom,
  navigateToMembersAtom,
  navigateToTeamsCollectionsAtom,
  navigateToSceneAtom,
  sidebarModeAtom,
  dashboardViewAtom,
  searchQueryAtom,
  workspaceSidebarOpenAtom,
  closeWorkspaceSidebarAtom,
} from "../../Settings/settingsState";

import { CopyMoveDialog } from "../CopyMoveDialog";
import { BoardModeNav } from "../BoardModeNav";
import { FullModeNav } from "../FullModeNav";
import { LoginDialog } from "../LoginDialog";

import { buildDashboardUrl, navigateTo, parseUrl } from "../../../router";

import {
  CreateCollectionDialog,
  EditCollectionDialog,
  CreateWorkspaceDialog,
} from "./dialogs";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarSearch } from "./SidebarSearch";
import { SidebarHeader } from "./SidebarHeader";
import { loginIcon } from "./icons";
import styles from "./WorkspaceSidebar.module.scss";

import type {
  Workspace,
  Collection,
  WorkspaceType,
} from "../../../auth/workspaceApi";

interface WorkspaceSidebarProps {
  onNewScene: (
    collectionId?: string,
    options?: { skipCurrentSceneSave?: boolean },
  ) => void;
  onCurrentSceneDeleted?: (sceneId: string) => void;
  onBeforeCollectionMutation?: () => Promise<void>;
  currentSceneId?: string | null;
  onWorkspaceChange?: (
    workspace: Workspace,
    privateCollectionId: string | null,
  ) => void;
  onCurrentSceneTitleChange?: (newTitle: string) => void;
  workspace?: Workspace | null;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  onNewScene,
  onCurrentSceneDeleted,
  onBeforeCollectionMutation,
  currentSceneId,
  onWorkspaceChange,
  onCurrentSceneTitleChange,
  workspace: externalWorkspace,
}) => {
  // Sidebar open state from Jotai atom
  const isOpen = useAtomValue(workspaceSidebarOpenAtom);
  const closeSidebar = useSetAtom(closeWorkspaceSidebarAtom);
  const {
    user,
    isLoading: authLoading,
    isAuthenticated,
    login,
    oidcConfigured,
    localAuthEnabled,
  } = useAuth();

  // Global state
  const sidebarMode = useAtomValue(sidebarModeAtom);
  const dashboardView = useAtomValue(dashboardViewAtom);
  const navigateToDashboard = useSetAtom(navigateToDashboardAtom);
  const navigateToCollection = useSetAtom(navigateToCollectionAtom);
  const navigateToCanvas = useSetAtom(navigateToCanvasAtom);
  const navigateToProfile = useSetAtom(navigateToProfileAtom);
  const navigateToPreferences = useSetAtom(navigateToPreferencesAtom);
  const navigateToWorkspaceSettings = useSetAtom(
    navigateToWorkspaceSettingsAtom,
  );
  const navigateToMembers = useSetAtom(navigateToMembersAtom);
  const navigateToTeamsCollections = useSetAtom(navigateToTeamsCollectionsAtom);
  const navigateToScene = useSetAtom(navigateToSceneAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);

  const authAvailable = oidcConfigured || localAuthEnabled;

  // Workspaces hook
  const { currentWorkspace, loadWorkspaces, createWorkspace, generateSlug } =
    useWorkspaces({
      isAuthenticated,
      externalWorkspace,
      onWorkspaceChange,
    });

  // Collections hook
  const {
    isLoading: isCollectionsLoading,
    activeCollectionId,
    privateCollection,
    activeCollection,
    loadCollections,
    createCollection,
    updateCollection,
    deleteCollection,
  } = useCollections({
    workspaceId: currentWorkspace?.id || null,
  });

  // Scenes hook (only enabled in board mode)
  const {
    scenes,
    isLoading: isScenesLoading,
    refetch: refetchScenes,
  } = useScenesCache({
    workspaceId: currentWorkspace?.id,
    collectionId: activeCollectionId,
    enabled: isOpen && sidebarMode === "board" && isAuthenticated,
  });

  // Hook to invalidate scenes cache
  const invalidateScenesCache = useInvalidateScenesCache();

  // Scene actions hook with optimistic updates
  const { deleteScene, renameScene, duplicateScene } = useSceneActions({
    workspaceId: currentWorkspace?.id,
    collectionId: activeCollectionId,
    onSceneDeleted: useCallback(
      (sceneId: string) => {
        // 删除当前 Scene 后仍保持画布工作流：优先打开同一 Collection 的
        // 下一张画布；若已删空，则立即创建一张空白 Scene。绝不能停在
        // 已删除的 URL，也不应把用户丢回 Collection 页面。
        // 删除完成时不能依赖 React state 中可能滞后的 currentSceneId：新建后的
        // 路由同步与 mutation 回调会交错执行。URL 才是用户当前正在查看哪一张
        // Scene 的权威来源。
        const route = parseUrl();
        if (route.type !== "scene" || route.sceneId !== sceneId) {
          return;
        }

        onCurrentSceneDeleted?.(sceneId);

        const nextScene = scenes.find((scene) => scene.id !== sceneId);
        if (nextScene && currentWorkspace?.slug) {
          navigateToScene({
            sceneId: nextScene.id,
            title: nextScene.title,
            workspaceSlug: currentWorkspace.slug,
          });
          return;
        }

        void onNewScene(activeCollectionId || undefined, {
          skipCurrentSceneSave: true,
        });
      },
      [
        activeCollectionId,
        currentWorkspace?.slug,
        navigateToScene,
        onCurrentSceneDeleted,
        onNewScene,
        scenes,
      ],
    ),
    onSceneRenamed: useCallback(
      (sceneId: string, newTitle: string) => {
        if (sceneId === currentSceneId && onCurrentSceneTitleChange) {
          onCurrentSceneTitleChange(newTitle);
        }
      },
      [currentSceneId, onCurrentSceneTitleChange],
    ),
  });

  const isAdmin = currentWorkspace?.role === "ADMIN";

  // Dialog states
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionIcon, setNewCollectionIcon] = useState("");
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null,
  );
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState("");
  const [newWorkspaceType, setNewWorkspaceType] =
    useState<WorkspaceType>("SHARED");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [createWorkspaceError, setCreateWorkspaceError] = useState<
    string | null
  >(null);

  // Copy/Move dialog state
  const [copyMoveDialogOpen, setCopyMoveDialogOpen] = useState(false);
  const [copyMoveMode, setCopyMoveMode] = useState<"copy" | "move">("copy");
  const [copyMoveCollection, setCopyMoveCollection] =
    useState<Collection | null>(null);

  // Initial load
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadWorkspaces();
    }
  }, [isOpen, isAuthenticated, loadWorkspaces]);

  // Notify parent when workspace changes with private collection
  useEffect(() => {
    if (currentWorkspace && onWorkspaceChange && privateCollection) {
      onWorkspaceChange(currentWorkspace, privateCollection.id);
    }
  }, [currentWorkspace, privateCollection, onWorkspaceChange]);

  // Filter scenes by search query
  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) {
      return scenes;
    }
    const query = searchQuery.toLowerCase();
    return scenes.filter((scene) => scene.title.toLowerCase().includes(query));
  }, [scenes, searchQuery]);

  // Handlers
  const handleLoginClick = () => {
    if (oidcConfigured && !localAuthEnabled) {
      login(window.location.pathname);
    } else {
      setShowLoginDialog(true);
    }
  };

  const handleLoginSuccess = () => {
    loadWorkspaces();
  };

  const handleClose = useCallback(() => {
    navigateToCanvas();
    closeSidebar();
  }, [navigateToCanvas, closeSidebar]);

  // Handle workspace switch - clears scene state and navigates to new workspace dashboard
  const handleSwitchWorkspace = useCallback((workspace: Workspace) => {
    // URL 先进入离开 Scene 的保存事务；保存成功后路由同步再切 Workspace。
    // 若保存失败，useShellRouteSync 会回滚原 Scene，不能提前清空旧状态。
    navigateTo(buildDashboardUrl(workspace.slug));
  }, []);

  const handleCreateCollection = useCallback(async () => {
    const collection = await createCollection({
      name: newCollectionName,
      icon: newCollectionIcon,
    });
    if (collection) {
      setNewCollectionName("");
      setNewCollectionIcon("");
      setShowCreateCollection(false);
    }
  }, [createCollection, newCollectionName, newCollectionIcon]);

  const handleEditCollection = useCallback((collection: Collection) => {
    setEditingCollection(collection);
    setNewCollectionName(collection.name);
    setNewCollectionIcon(collection.icon || "");
  }, []);

  const handleSaveEditCollection = useCallback(async () => {
    if (!editingCollection) {
      return;
    }
    const updated = await updateCollection(editingCollection.id, {
      name: newCollectionName,
      icon: newCollectionIcon,
    });
    if (updated) {
      setEditingCollection(null);
      setNewCollectionName("");
      setNewCollectionIcon("");
    }
  }, [
    editingCollection,
    updateCollection,
    newCollectionName,
    newCollectionIcon,
  ]);

  const handleWorkspaceNameChange = useCallback(
    (name: string) => {
      setNewWorkspaceName(name);
      setNewWorkspaceSlug(generateSlug(name));
      setCreateWorkspaceError(null);
    },
    [generateSlug],
  );

  const handleCreateWorkspace = useCallback(async () => {
    if (!newWorkspaceName.trim() || !newWorkspaceSlug.trim()) {
      return;
    }

    setIsCreatingWorkspace(true);
    setCreateWorkspaceError(null);
    const urlAtStart = window.location.href;

    try {
      const workspace = await createWorkspace({
        name: newWorkspaceName,
        slug: newWorkspaceSlug,
        type: newWorkspaceType,
      });

      // Reset form and close dialog
      setNewWorkspaceName("");
      setNewWorkspaceSlug("");
      setNewWorkspaceType("SHARED");
      setShowCreateWorkspace(false);

      // mutation 期间用户已导航时，创建结果不能覆盖更新后的 URL。
      if (window.location.href === urlAtStart) {
        navigateTo(buildDashboardUrl(workspace.slug));
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("already taken")) {
        setCreateWorkspaceError(t("workspace.workspaceSlugTaken"));
      } else {
        setCreateWorkspaceError(
          err instanceof Error ? err.message : "Failed to create workspace",
        );
      }
    } finally {
      setIsCreatingWorkspace(false);
    }
  }, [createWorkspace, newWorkspaceName, newWorkspaceSlug, newWorkspaceType]);

  const openCopyMoveDialog = useCallback(
    (collection: Collection, mode: "copy" | "move") => {
      setCopyMoveCollection(collection);
      setCopyMoveMode(mode);
      setCopyMoveDialogOpen(true);
    },
    [],
  );

  const handleCopyMoveSuccess = useCallback(() => {
    if (currentWorkspace?.id) {
      invalidateScenesCache(currentWorkspace.id);
    }
    loadCollections();
    refetchScenes();
  }, [
    invalidateScenesCache,
    loadCollections,
    refetchScenes,
    currentWorkspace?.id,
  ]);

  const handleSceneClick = useCallback(
    (scene: { id: string; title: string }) => {
      if (currentWorkspace?.slug) {
        navigateToScene({
          sceneId: scene.id,
          title: scene.title,
          workspaceSlug: currentWorkspace.slug,
        });
      }
    },
    [currentWorkspace?.slug, navigateToScene],
  );

  return (
    <div
      className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}
      data-testid="workspace-sidebar"
    >
      <SidebarHeader
        isAuthenticated={isAuthenticated}
        user={user}
        onSwitchWorkspace={handleSwitchWorkspace}
        onCreateWorkspaceClick={() => setShowCreateWorkspace(true)}
        onClose={handleClose}
      />

      <div className={styles.divider} />

      <div className={styles.content}>
        {authLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : !authAvailable ? (
          <div className={styles.empty}>
            <p>{t("workspace.notConfigured")}</p>
            <span className={styles.emptyHint}>
              {t("workspace.notConfiguredHint")}
            </span>
          </div>
        ) : !isAuthenticated ? (
          <div className={styles.login}>
            <p>{t("workspace.loginPrompt")}</p>
            <button className={styles.loginButton} onClick={handleLoginClick}>
              {loginIcon}
              <span>{t("workspace.login")}</span>
            </button>
          </div>
        ) : (
          <>
            <SidebarSearch
              value={searchQuery}
              onChange={setSearchQuery}
              isOpen={isOpen}
            />

            {sidebarMode === "board" ? (
              <BoardModeNav
                activeCollection={activeCollection}
                scenes={filteredScenes}
                currentSceneId={currentSceneId || null}
                isLoading={isScenesLoading}
                onDashboardClick={() => navigateToDashboard()}
                onBackClick={() => navigateToDashboard()}
                onSceneClick={handleSceneClick}
                onNewScene={onNewScene}
                onDeleteScene={deleteScene}
                onRenameScene={renameScene}
                onDuplicateScene={duplicateScene}
                authorName={user?.name || undefined}
              />
            ) : (
              <FullModeNav
                currentView={dashboardView}
                isAdmin={isAdmin}
                isPersonalWorkspace={currentWorkspace?.type === "PERSONAL"}
                isCollectionsLoading={isCollectionsLoading}
                onDashboardClick={() => navigateToDashboard()}
                onProfileClick={() => navigateToProfile()}
                onPreferencesClick={() => navigateToPreferences()}
                onSettingsClick={() => navigateToWorkspaceSettings()}
                onMembersClick={() => navigateToMembers()}
                onTeamsCollectionsClick={() => navigateToTeamsCollections()}
                onCollectionClick={(collectionId, isPrivate) =>
                  navigateToCollection({ collectionId, isPrivate })
                }
                onCreateCollection={() => setShowCreateCollection(true)}
                onNewScene={onNewScene}
                onDeleteCollection={deleteCollection}
                onEditCollection={handleEditCollection}
                onCopyCollection={(c) => openCopyMoveDialog(c, "copy")}
                onMoveCollection={(c) => openCopyMoveDialog(c, "move")}
              />
            )}
          </>
        )}
      </div>

      {isAuthenticated && user && (
        <SidebarFooter
          user={user}
          workspaceSlug={currentWorkspace?.slug || undefined}
          appMode={sidebarMode === "full" ? "dashboard" : "canvas"}
          onProfileClick={() => navigateToProfile()}
        />
      )}

      {/* Dialogs */}
      <CreateCollectionDialog
        isOpen={showCreateCollection}
        name={newCollectionName}
        icon={newCollectionIcon}
        onNameChange={setNewCollectionName}
        onIconChange={setNewCollectionIcon}
        onSubmit={handleCreateCollection}
        onClose={() => setShowCreateCollection(false)}
      />

      <EditCollectionDialog
        collection={editingCollection}
        name={newCollectionName}
        icon={newCollectionIcon}
        onNameChange={setNewCollectionName}
        onIconChange={setNewCollectionIcon}
        onSubmit={handleSaveEditCollection}
        onClose={() => {
          setEditingCollection(null);
          setNewCollectionName("");
          setNewCollectionIcon("");
        }}
      />

      <CreateWorkspaceDialog
        isOpen={showCreateWorkspace}
        name={newWorkspaceName}
        slug={newWorkspaceSlug}
        type={newWorkspaceType}
        error={createWorkspaceError}
        isCreating={isCreatingWorkspace}
        onNameChange={handleWorkspaceNameChange}
        onSlugChange={(slug) => {
          setNewWorkspaceSlug(slug);
          setCreateWorkspaceError(null);
        }}
        onTypeChange={setNewWorkspaceType}
        onSubmit={handleCreateWorkspace}
        onClose={() => {
          setShowCreateWorkspace(false);
          setNewWorkspaceName("");
          setNewWorkspaceSlug("");
          setNewWorkspaceType("SHARED");
          setCreateWorkspaceError(null);
        }}
      />

      <LoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onSuccess={handleLoginSuccess}
      />

      <CopyMoveDialog
        isOpen={copyMoveDialogOpen && !!copyMoveCollection}
        onClose={() => {
          setCopyMoveDialogOpen(false);
          setCopyMoveCollection(null);
        }}
        collectionId={copyMoveCollection?.id || ""}
        collectionName={copyMoveCollection?.name || ""}
        mode={copyMoveMode}
        onBeforeMutation={onBeforeCollectionMutation}
        onSuccess={handleCopyMoveSuccess}
      />
    </div>
  );
};

export default WorkspaceSidebar;
