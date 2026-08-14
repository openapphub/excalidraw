import clsx from "clsx";

import { actionShortcuts } from "../../actions";
import { useTunnels } from "../../context/tunnels";
import { ExitZenModeButton, UndoRedoActions, ZoomActions } from "../Actions";
import { useApp } from "../App";
import { HelpButton } from "../HelpButton";
import { Section } from "../Section";
import Stack from "../Stack";

import type { ActionManager } from "../../actions/manager";
import type { UIAppState } from "../../types";

const Footer = ({
  appState,
  actionManager,
  showExitZenModeBtn,
  renderWelcomeScreen,
  defaultUIEnabled,
  zoomUIEnabled,
}: {
  appState: UIAppState;
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
  renderWelcomeScreen: boolean;
  defaultUIEnabled: boolean;
  zoomUIEnabled: boolean;
}) => {
  const {
    FooterCenterTunnel,
    FooterLeftExtraTunnel,
    WelcomeScreenHelpHintTunnel,
  } = useTunnels();
  const app = useApp();

  return (
    <footer
      role="contentinfo"
      className="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      {(defaultUIEnabled || (zoomUIEnabled && app.isNavigationEnabled())) && (
        <div
          className={clsx(
            "layer-ui__wrapper__footer-left zen-mode-transition",
            {
              "layer-ui__wrapper__footer-left--transition-left":
                appState.zenModeEnabled,
            },
          )}
        >
          <Stack.Col gap={2}>
            <Section heading="canvasActions">
              {zoomUIEnabled && app.isNavigationEnabled() && (
                <ZoomActions renderAction={actionManager.renderAction} />
              )}

              {defaultUIEnabled && !appState.viewModeEnabled && (
                <UndoRedoActions
                  renderAction={actionManager.renderAction}
                  className={clsx("zen-mode-transition", {
                    "layer-ui__wrapper__footer-left--transition-bottom":
                      appState.zenModeEnabled,
                  })}
                />
              )}
              {/* 自建扩展：app 侧通过 FooterLeftExtraTunnel.In 注入底部左侧按钮。
                  AstraDraw 原版位置：Section 内部（UndoRedoActions 之后），与
                  zoom/undo 同一行 —— 挂 Section 外会掉到下一行（实测 2026-08） */}
              <FooterLeftExtraTunnel.Out />
            </Section>
          </Stack.Col>
        </div>
      )}
      <FooterCenterTunnel.Out />
      {(defaultUIEnabled || renderWelcomeScreen) && (
        <div
          className={clsx(
            "layer-ui__wrapper__footer-right zen-mode-transition",
            {
              "transition-right": appState.zenModeEnabled,
            },
          )}
        >
          <div style={{ position: "relative" }}>
            {renderWelcomeScreen && <WelcomeScreenHelpHintTunnel.Out />}
            {defaultUIEnabled && (
              <HelpButton
                onClick={() => actionManager.executeAction(actionShortcuts)}
              />
            )}
          </div>
        </div>
      )}
      {defaultUIEnabled && (
        <ExitZenModeButton
          actionManager={actionManager}
          showExitZenModeBtn={showExitZenModeBtn}
        />
      )}
    </footer>
  );
};

export default Footer;
Footer.displayName = "Footer";
