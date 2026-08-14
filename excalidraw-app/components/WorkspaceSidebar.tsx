import React, { useState, useMemo, useCallback, useEffect } from "react";

import clsx from "clsx";

import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import {
  PlusIcon,
  DotsIcon,
  TrashIcon,
  pencilIcon,
  searchIcon,
  chevronDownIcon,
  chevronRight,
} from "@excalidraw/excalidraw/components/icons";

import { timeAgo } from "../utils/time";

import { useAtom, useSetAtom } from "../app-jotai";
import {
  workspaceSidebarOpenAtom,
  createCanvasDialogAtom,
  renameCanvasDialogAtom,
} from "../app-jotai";

import "./WorkspaceSidebar.scss";

import type { CanvasMetadata, WorkspaceMetadata } from "../data/storage";

interface WorkspaceSidebarProps {
  canvases: readonly CanvasMetadata[];
  workspaces: readonly WorkspaceMetadata[];
  currentCanvasId: string | null;
  activeWorkspaceId: string | null;
  onWorkspaceFilterChange: (id: string | null) => void;
  onCanvasSelect: (id: string) => void;
  onCanvasDelete: (id: string) => void;
  onCreateWorkspace: (name: string, note?: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onMoveCanvas: (canvasId: string, workspaceId: string) => void;
  onCreateCanvas: () => void;
}

/**
 * 左侧滑出式 Workspaces 画布目录（复刻 AstraDraw WorkspaceSidebar 布局与
 * SceneCard 视觉语言）。固定在页面左侧，margin-left 滑出动画，自带遮罩。
 *
 * 结构（自上而下）：触发器按钮 → header（标题 + 新建分组）→ 分组选择 →
 * 搜索框 → 分组画布列表（SceneCard 风格：缩略图 + 名称 + 时间 + 三点菜单）→
 * 底部新建画布按钮。
 *
 * 菜单事件用 closest() 判断而非共享 ref —— 多个卡片共用 ref 会指向最后
 * 挂载的元素，mousedown 判定"外部"提前卸载菜单 → click 丢失（2026-08
 * 实测：移动/改名/删除请求全部发不出去）。
 */
export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  canvases,
  workspaces,
  currentCanvasId,
  activeWorkspaceId,
  onWorkspaceFilterChange,
  onCanvasSelect,
  onCanvasDelete,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onMoveCanvas,
  onCreateCanvas,
}) => {
  const [isOpen, setIsOpen] = useAtom(workspaceSidebarOpenAtom);
  const setCreateCanvasDialog = useSetAtom(createCanvasDialogAtom);
  const setRenameCanvasDialog = useSetAtom(renameCanvasDialogAtom);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [renamingWorkspace, setRenamingWorkspace] =
    useState<WorkspaceMetadata | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceNote, setNewWorkspaceNote] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);

  // 菜单区域判定：document mousedown 时检查 target 是否在任一菜单内。
  // 不用共享 ref（多个卡片 → 竞态）；菜单关闭交给 click 层（stopPropagation）
  // + 这里只负责"点到菜单外关闭"。
  useEffect(() => {
    if (!menuFor && !moveMenuFor) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".ws-card__menu, .ws-card__menu-trigger")) {
        setMenuFor(null);
        setMoveMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuFor, moveMenuFor]);

  const sortedCanvases = useMemo(
    () =>
      [...canvases].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [canvases],
  );

  // 搜索过滤
  const filteredCanvases = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedCanvases;
    }
    const q = searchQuery.toLowerCase();
    return sortedCanvases.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedCanvases, searchQuery]);

  const visibleCanvases = useMemo(() => {
    if (!activeWorkspaceId) {
      return filteredCanvases;
    }
    return filteredCanvases.filter((c) => c.workspaceId === activeWorkspaceId);
  }, [filteredCanvases, activeWorkspaceId]);

  // 全部画布视图：按 workspace 分组
  const grouped = useMemo(() => {
    if (activeWorkspaceId) {
      return null;
    }
    return workspaces
      .map((ws) => ({
        workspace: ws,
        items: visibleCanvases.filter((c) => c.workspaceId === ws.id),
      }))
      .filter((g) => g.items.length > 0 || !searchQuery);
  }, [workspaces, visibleCanvases, activeWorkspaceId, searchQuery]);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCreateWorkspace = useCallback(() => {
    if (!newWorkspaceName.trim()) {
      return;
    }
    onCreateWorkspace(newWorkspaceName.trim(), newWorkspaceNote.trim());
    setNewWorkspaceName("");
    setNewWorkspaceNote("");
    setShowCreateWorkspace(false);
  }, [newWorkspaceName, newWorkspaceNote, onCreateWorkspace]);

  const handleRenameWorkspaceSubmit = useCallback(() => {
    if (renamingWorkspace && renameValue.trim()) {
      onRenameWorkspace(renamingWorkspace.id, renameValue.trim());
    }
    setRenamingWorkspace(null);
    setRenameValue("");
  }, [renamingWorkspace, renameValue, onRenameWorkspace]);

  const handleDeleteWorkspace = useCallback(
    (ws: WorkspaceMetadata) => {
      const count = canvases.filter((c) => c.workspaceId === ws.id).length;
      const msg =
        count > 0
          ? `删除分组「${ws.name}」后，其中 ${count} 个画布将移回「默认分组」。确定删除？`
          : `确定删除分组「${ws.name}」？`;
      if (window.confirm(msg)) {
        onDeleteWorkspace(ws.id);
      }
    },
    [canvases, onDeleteWorkspace],
  );

  // ---------- 画布条目（复刻 SceneCard） ----------
  const renderCanvasRow = (canvas: CanvasMetadata) => (
    <div
      key={canvas.id}
      className={clsx("ws-card", {
        "ws-card--active": canvas.id === currentCanvasId,
      })}
      onClick={() => {
        if (canvas.id !== currentCanvasId) {
          onCanvasSelect(canvas.id);
          setIsOpen(false);
        }
      }}
    >
      <div className="ws-card__thumb">
        {canvas.thumbnail ? (
          <img src={canvas.thumbnail} alt={canvas.name} />
        ) : (
          <div className="ws-card__thumb-placeholder">✏️</div>
        )}
      </div>
      <div className="ws-card__info">
        <div className="ws-card__title-row">
          <span className="ws-card__name" title={canvas.name}>
            {canvas.name}
          </span>
        </div>
        <span className="ws-card__date">{timeAgo(canvas.updatedAt)}</span>
      </div>
      <div className="ws-card__actions">
        <button
          className="ws-card__menu-trigger"
          aria-label="更多操作"
          onClick={(e) => {
            e.stopPropagation();
            setMenuFor(menuFor === canvas.id ? null : canvas.id);
            setMoveMenuFor(null);
          }}
        >
          {DotsIcon}
        </button>
        {menuFor === canvas.id && (
          <div
            className="ws-card__menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ws-card__menu-item"
              onClick={() => {
                setMenuFor(null);
                setRenameCanvasDialog({
                  isOpen: true,
                  canvasId: canvas.id,
                  currentName: canvas.name,
                });
              }}
            >
              {pencilIcon}
              <span>重命名</span>
            </button>
            <div className="ws-card__menu-item--relative">
              <button
                className="ws-card__menu-item"
                onClick={() => {
                  setMoveMenuFor(
                    moveMenuFor === canvas.id ? null : canvas.id,
                  );
                }}
              >
                {chevronRight}
                <span>移动到…</span>
              </button>
              {moveMenuFor === canvas.id && (
                <div className="ws-card__menu ws-card__menu--sub">
                  {workspaces
                    .filter((ws) => ws.id !== canvas.workspaceId)
                    .map((ws) => (
                      <button
                        key={ws.id}
                        className="ws-card__menu-item"
                        onClick={() => {
                          setMenuFor(null);
                          setMoveMenuFor(null);
                          onMoveCanvas(canvas.id, ws.id);
                        }}
                      >
                        <span>{ws.name}</span>
                      </button>
                    ))}
                  {workspaces.filter((ws) => ws.id !== canvas.workspaceId)
                    .length === 0 && (
                    <div className="ws-card__menu-empty">没有其他分组</div>
                  )}
                </div>
              )}
            </div>
            <div className="ws-card__menu-divider" />
            <button
              className="ws-card__menu-item ws-card__menu-item--danger"
              onClick={() => {
                setMenuFor(null);
                onCanvasDelete(canvas.id);
              }}
            >
              {TrashIcon}
              <span>删除</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 触发器按钮（左上角，官方 hamburger 之前） */}
      <button
        type="button"
        className={clsx("ws-trigger", {
          "ws-trigger--active": isOpen,
        })}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="画布目录"
        title="画布目录"
      >
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
          <path
            d="M14.807 9.249a.75.75 0 0 0-1.059-.056l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 0 0 1.004-1.115l-1.048-.942h3.546a.75.75 0 1 0 0-1.5h-3.546l1.048-.942a.75.75 0 0 0 .055-1.059ZM2 17.251A2.75 2.75 0 0 0 4.75 20h14.5A2.75 2.75 0 0 0 22 17.25V6.75A2.75 2.75 0 0 0 19.25 4H4.75A2.75 2.75 0 0 0 2 6.75v10.5Zm2.75 1.25c-.69 0-1.25-.56-1.25-1.25V6.749c0-.69.56-1.25 1.25-1.25h3.254V18.5H4.75Zm4.754 0V5.5h9.746c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H9.504Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {/* 遮罩（点击关闭） */}
      {isOpen && <div className="ws-overlay" onClick={() => setIsOpen(false)} />}

      {/* 左侧滑出面板 */}
      <div
        className={clsx("ws-panel", { "ws-panel--open": isOpen })}
        data-testid="workspace-sidebar"
      >
        {/* 顶部：标题 + 新建分组 */}
        <div className="ws-panel__header">
          <div className="ws-panel__title-row">
            <h2 className="ws-panel__title">我的画布</h2>
            <button
              className="ws-panel__icon-btn"
              title="新建分组"
              onClick={() => setShowCreateWorkspace(true)}
            >
              {PlusIcon}
            </button>
          </div>

          {/* 分组选择 */}
          <div className="ws-panel__group-select">
            <button
              className={clsx("ws-panel__group-option", {
                "ws-panel__group-option--active": activeWorkspaceId === null,
              })}
              onClick={() => onWorkspaceFilterChange(null)}
            >
              全部
            </button>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={clsx("ws-panel__group-option", {
                  "ws-panel__group-option--active":
                    activeWorkspaceId === ws.id,
                })}
                onClick={() => onWorkspaceFilterChange(ws.id)}
              >
                {ws.name}
              </button>
            ))}
          </div>
        </div>

        {/* 搜索框 */}
        <div className="ws-panel__search">
          {searchIcon}
          <input
            className="ws-panel__search-input"
            placeholder="搜索画布…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <span className="ws-panel__search-hint">
              {visibleCanvases.length} 个结果
            </span>
          )}
        </div>

        {/* 画布列表（唯一滚动区） */}
        <div className="ws-panel__content">
          {!activeWorkspaceId && grouped && grouped.length === 0 ? (
            <div className="ws-panel__empty">
              <p>还没有画布</p>
              <span>在下方创建第一个画布</span>
            </div>
          ) : visibleCanvases.length === 0 ? (
            <div className="ws-panel__empty">
              <p>{searchQuery ? "没有匹配的画布" : "这个分组还是空的"}</p>
              <span>
                {searchQuery ? "换个关键词试试" : "在下方创建画布并选择此分组"}
              </span>
            </div>
          ) : activeWorkspaceId ? (
            <div className="ws-panel__group">
              {visibleCanvases.map(renderCanvasRow)}
            </div>
          ) : (
            grouped!.map(({ workspace, items }) => {
              const collapsed = collapsedGroups.has(workspace.id);
              if (items.length === 0 && !showCreateWorkspace) {
                return null;
              }
              return (
                <div key={workspace.id} className="ws-panel__group">
                  <div className="ws-panel__group-header">
                    <button
                      className="ws-panel__group-toggle"
                      onClick={() => toggleGroup(workspace.id)}
                    >
                      <span
                        className={clsx("ws-panel__chevron", {
                          "ws-panel__chevron--open": !collapsed,
                        })}
                      >
                        {chevronDownIcon}
                      </span>
                      <span className="ws-panel__group-name">
                        {workspace.name}
                      </span>
                      <span className="ws-panel__group-count">
                        {items.length}
                      </span>
                    </button>
                    {workspace.id !== "default" && (
                      <div className="ws-panel__group-actions">
                        <button
                          className="ws-panel__group-action"
                          title={`重命名分组「${workspace.name}」`}
                          onClick={() => {
                            setRenamingWorkspace(workspace);
                            setRenameValue(workspace.name);
                          }}
                        >
                          {pencilIcon}
                        </button>
                        <button
                          className="ws-panel__group-action ws-panel__group-action--danger"
                          title={`删除分组「${workspace.name}」`}
                          onClick={() => handleDeleteWorkspace(workspace)}
                        >
                          {TrashIcon}
                        </button>
                      </div>
                    )}
                  </div>
                  {!collapsed && items.map(renderCanvasRow)}
                </div>
              );
            })
          )}
        </div>

        {/* 底部：新建画布（归属当前选中分组） */}
        <div className="ws-panel__footer">
          <FilledButton
            label="新建画布"
            onClick={() => {
              onCreateCanvas();
              setIsOpen(false);
            }}
            fullWidth
          >
            {PlusIcon}
            <span className="ws-panel__footer-label">新建画布</span>
          </FilledButton>
        </div>

        {/* 新建分组对话框 */}
        {showCreateWorkspace && (
          <div
            className="ws-dialog-overlay"
            onClick={() => setShowCreateWorkspace(false)}
          >
            <div className="ws-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>新建分组</h3>
              <div className="ws-dialog__content">
                <div className="ws-dialog__form-group">
                  <label>分组名称</label>
                  <input
                    autoFocus
                    value={newWorkspaceName}
                    placeholder="例如：项目A、灵感收集…"
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateWorkspace();
                      }
                    }}
                  />
                </div>
                <div className="ws-dialog__form-group">
                  <label>备注（可选）</label>
                  <input
                    value={newWorkspaceNote}
                    placeholder="这个分组放什么…"
                    onChange={(e) => setNewWorkspaceNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="ws-dialog__actions">
                <button
                  className="ws-dialog__cancel"
                  onClick={() => setShowCreateWorkspace(false)}
                >
                  取消
                </button>
                <button
                  className="ws-dialog__confirm"
                  disabled={!newWorkspaceName.trim()}
                  onClick={handleCreateWorkspace}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 重命名分组对话框 */}
        {renamingWorkspace && (
          <div
            className="ws-dialog-overlay"
            onClick={() => setRenamingWorkspace(null)}
          >
            <div className="ws-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>重命名分组</h3>
              <div className="ws-dialog__content">
                <div className="ws-dialog__form-group">
                  <label>分组名称</label>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRenameWorkspaceSubmit();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="ws-dialog__actions">
                <button
                  className="ws-dialog__cancel"
                  onClick={() => setRenamingWorkspace(null)}
                >
                  取消
                </button>
                <button
                  className="ws-dialog__confirm"
                  disabled={!renameValue.trim()}
                  onClick={handleRenameWorkspaceSubmit}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default WorkspaceSidebar;
