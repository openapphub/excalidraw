import React from "react";
import { MainMenu } from "@excalidraw/excalidraw/index";

import { GithubIcon, saveAs } from "@excalidraw/excalidraw/components/icons";

import DropdownMenuItemLink from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItemLink";

import type { Theme } from "@excalidraw/element/types";

import {
  useAtom,
  useSetAtom,
  userAtom,
  saveAsDialogAtom,
} from "../app-jotai";
import { LanguageList } from "../app-language/LanguageList";

import { openWorkspaceSidebarAtom } from "./Settings/settingsState";

const workspaceIcon = (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M4 6.75A2.75 2.75 0 0 1 6.75 4h3.19c.6 0 1.16.29 1.5.78l.72 1.02h5.09A2.75 2.75 0 0 1 20 8.55v8.7A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75Zm2.75-1.25c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-8.7c0-.69-.56-1.25-1.25-1.25h-5.48a1.5 1.5 0 0 1-1.22-.64l-.73-1.02a.34.34 0 0 0-.28-.14H6.75Z"
      fill="currentColor"
    />
  </svg>
);

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
}> = React.memo((props) => {
  const [user, setUser] = useAtom(userAtom);
  const setSaveAsDialog = useSetAtom(saveAsDialogAtom);
  const openWorkspaceSidebar = useSetAtom(openWorkspaceSidebarAtom);

  const handleLogin = () => {
    window.location.href = "/auth/login";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    window.location.reload(); // Reload to clear all state
  };

  return (
    <MainMenu>
      <MainMenu.Item
        onSelect={() => openWorkspaceSidebar()}
        icon={workspaceIcon}
      >
        Workspace
      </MainMenu.Item>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      {!user && (
        <MainMenu.Item
          onSelect={() => setSaveAsDialog({ isOpen: true })}
          icon={saveAs}
        >
          Save as New Canvas...
        </MainMenu.Item>
      )}
      <MainMenu.DefaultItems.Export />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      {user ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            padding: "0 0.5rem",
            width: "100%",
            fontSize: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              overflow: "hidden",
              flexShrink: 1,
            }}
          >
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.login}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.name || user.login}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              textAlign: "center",
              color: "inherit",
              flexShrink: 0,
              marginRight: "1rem",
              font: "var(--ui-font)",
              fontSize: "14px",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = "var(--button-gray-1)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Logout
          </button>
        </div>
      ) : (
        <MainMenu.Item onSelect={handleLogin} icon={GithubIcon}>
          Login
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <DropdownMenuItemLink
        icon={GithubIcon}
        href="https://github.com/excalidraw/excalidraw"
        aria-label="GitHub"
      >
        GitHub
      </DropdownMenuItemLink>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
