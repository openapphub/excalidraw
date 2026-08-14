import React, { useCallback, useEffect } from "react";
import { useTunnels } from "@excalidraw/excalidraw/index";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";

import { useAtom } from "../app-jotai";
import { workspaceSidebarOpenAtom } from "../app-jotai";

import "./WorkspaceSidebarTrigger.scss";

// Sidebar panel icon (copy from AstraDraw WorkspaceSidebarTrigger)
const sidebarIcon = (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M14.807 9.249a.75.75 0 0 0-1.059-.056l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 0 0 1.004-1.115l-1.048-.942h3.546a.75.75 0 1 0 0-1.5h-3.546l1.048-.942a.75.75 0 0 0 .055-1.059ZM2 17.251A2.75 2.75 0 0 0 4.75 20h14.5A2.75 2.75 0 0 0 22 17.25V6.75A2.75 2.75 0 0 0 19.25 4H4.75A2.75 2.75 0 0 0 2 6.75v10.5Zm2.75 1.25c-.69 0-1.25-.56-1.25-1.25V6.749c0-.69.56-1.25 1.25-1.25h3.254V18.5H4.75Zm4.754 0V5.5h9.746c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H9.504Z"
      fill="currentColor"
    />
  </svg>
);

/**
 * 左上角 workspace 侧边栏触发器（copy AstraDraw WorkspaceSidebarTrigger）：
 * 通过 WorkspaceTriggerTunnel 注入官方 top-left（汉堡菜单之前），
 * 点击 toggle workspaceSidebarOpenAtom。反引号快捷键同 AstraDraw。
 */
export const WorkspaceSidebarTrigger: React.FC = () => {
  const { WorkspaceTriggerTunnel } = useTunnels();
  const [isOpen, setIsOpen] = useAtom(workspaceSidebarOpenAtom);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, [setIsOpen]);

  // 反引号快捷键（AstraDraw 同款）
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "`" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
      }
    },
    [toggleSidebar],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <WorkspaceTriggerTunnel.In>
      <div className="ws-trigger">
        <Tooltip label="画布目录">
          <button
            type="button"
            className={`ws-trigger__button${
              isOpen ? " ws-trigger__button--active" : ""
            }${!isOpen ? " ws-trigger__button--closed" : ""}`}
            onClick={toggleSidebar}
            aria-label="画布目录"
            aria-pressed={isOpen}
            title="画布目录 (`)"
          >
            {sidebarIcon}
          </button>
        </Tooltip>
      </div>
    </WorkspaceTriggerTunnel.In>
  );
};

export default WorkspaceSidebarTrigger;
