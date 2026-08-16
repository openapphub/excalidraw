import React from "react";
import { GithubIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";

import { useAtom, userAtom } from "../app-jotai";

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
}> = React.memo((props) => {
  const { t } = useI18n();
  const [user] = useAtom(userAtom);

  // 未登录画布仅保存在浏览器中，官方欢迎语准确。已登录后画布属于
  // Workspace Scene 并落库，继续展示该文案会误导用户，也会遮住空白编辑面。
  if (user) {
    return null;
  }

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo />
        <WelcomeScreen.Center.Heading>
          {t("welcomeScreen.app.center_heading")}
        </WelcomeScreen.Center.Heading>
        <WelcomeScreen.Center.Menu>
          <WelcomeScreen.Center.MenuItemLoadScene />
          <WelcomeScreen.Center.MenuItemHelp />
          {props.isCollabEnabled && (
            <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
              onSelect={() => props.onCollabDialogOpen()}
            />
          )}
          <WelcomeScreen.Center.MenuItem
            onSelect={() => {
              window.location.href = "/auth/login";
            }}
            icon={GithubIcon}
          >
            Login
          </WelcomeScreen.Center.MenuItem>
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
