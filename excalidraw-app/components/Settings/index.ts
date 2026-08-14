export { ProfilePage } from "./ProfilePage";
export type { ProfilePageProps } from "./ProfilePage";
export { PreferencesPage } from "./PreferencesPage";
export type { PreferencesPageProps } from "./PreferencesPage";
export { WorkspaceSettingsPage } from "./WorkspaceSettingsPage";
export type { WorkspaceSettingsPageProps } from "./WorkspaceSettingsPage";
export { MembersPage } from "./MembersPage";
export type { MembersPageProps } from "./MembersPage";
export { TeamsCollectionsPage } from "./TeamsCollectionsPage";
export type { TeamsCollectionsPageProps } from "./TeamsCollectionsPage";

export {
  appModeAtom,
  activeCollectionIdAtom,
  dashboardViewAtom,
  sidebarModeAtom,
  navigateToDashboardAtom,
  navigateToCollectionAtom,
  navigateToCanvasAtom,
  navigateToProfileAtom,
  navigateToPreferencesAtom,
  navigateToWorkspaceSettingsAtom,
  navigateToMembersAtom,
  navigateToTeamsCollectionsAtom,
  navigateToSceneAtom,
  collectionsRefreshAtom,
  triggerCollectionsRefreshAtom,
  currentWorkspaceSlugAtom,
  currentSceneIdAtom,
  currentSceneTitleAtom,
  currentSceneCanEditAtom,
  sceneCollabEnabledAtom,
  sceneEditLockAtom,
  isPrivateCollectionAtom,
  isAutoCollabSceneAtom,
  quickSearchOpenAtom,
  searchQueryAtom,
  workspaceSidebarOpenAtom,
  toggleWorkspaceSidebarAtom,
  openWorkspaceSidebarAtom,
  closeWorkspaceSidebarAtom,
  // Workspace & collections data atoms
  workspacesAtom,
  currentWorkspaceAtom,
  collectionsAtom,
  privateCollectionAtom,
  activeCollectionAtom,
  clearWorkspaceDataAtom,
  logoutSignalAtom,
  isLoggingOutAtom,
  type AppMode,
  type SidebarMode,
  type DashboardView,
  type WorkspaceData,
  type CollectionData,
} from "./settingsState";
