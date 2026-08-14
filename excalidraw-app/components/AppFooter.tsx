import { Footer, useTunnels } from "@excalidraw/excalidraw/index";
import { LoadIcon } from "@excalidraw/excalidraw/components/icons";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";
import { CREATIONS_SIDEBAR_NAME } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

import "./AppFooter.scss";

export interface AppFooterProps {
  onChange: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

// 底部左侧"画布列表"按钮：复刻 AstraDraw FooterLeftExtra 的布局结构，
// 通过 FooterLeftExtraTunnel 注入官方 footer-left 容器
const AppFooterLeft = React.memo(
  ({ excalidrawAPI }: { excalidrawAPI: ExcalidrawImperativeAPI | null }) => {
    const { FooterLeftExtraTunnel } = useTunnels();

    const handleToggleCreationsSidebar = () => {
      if (!excalidrawAPI) {
        return;
      }

      const appState = excalidrawAPI.getAppState();
      const sidebarIsOpen =
        appState.openSidebar?.name === CREATIONS_SIDEBAR_NAME;

      if (sidebarIsOpen) {
        // 侧边栏已打开 - 关闭
        excalidrawAPI.updateScene({
          appState: { openSidebar: null },
        });
      } else {
        // 侧边栏未打开 - 打开到 creations 标签页
        excalidrawAPI.updateScene({
          appState: {
            openSidebar: {
              name: CREATIONS_SIDEBAR_NAME,
              tab: "creations",
            },
          },
        });
      }
    };

    return (
      <FooterLeftExtraTunnel.In>
        <div className="footer-left-extra zen-mode-transition">
          <div className="excalidraw-tooltip-wrapper">
            <Tooltip label="画布列表">
              <button
                className="sidebarButton"
                onClick={handleToggleCreationsSidebar}
                onPointerDown={(e) => e.stopPropagation()}
                type="button"
                aria-label="画布列表"
              >
                <div className="toolIconWrapper" aria-hidden="true">
                  {LoadIcon}
                </div>
              </button>
            </Tooltip>
          </div>
        </div>
      </FooterLeftExtraTunnel.In>
    );
  },
);

export const AppFooter = React.memo(
  ({ onChange, excalidrawAPI }: AppFooterProps) => {
    return (
      <>
        {/* 底部左侧：画布列表按钮（注入官方 footer-left） */}
        <AppFooterLeft excalidrawAPI={excalidrawAPI} />

        {/* 底部中央内容 */}
        <Footer>
          <div
            style={{
              display: "flex",
              gap: ".5rem",
              alignItems: "center",
            }}
          >
            {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
            {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
          </div>
        </Footer>
      </>
    );
  },
);
