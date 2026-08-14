import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

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

import { useSetAtom } from "../app-jotai";
import { createCanvasDialogAtom, renameCanvasDialogAtom } from "../app-jotai";

import "./WorkspaceSidebar.scss";

import type { CanvasMetadata, WorkspaceMetadata } from "../data/storage";

interface WorkspaceSidebarProps {
  canvases: readonly CanvasMetadata[];
  workspaces: readonly WorkspaceMetadata[];
  currentCanvasId: string | null;
  onCanvasSelect: (id: string) => void;
  onCanvasDelete: (id: string) => void;
  onCanvasRename: (canvasId: string, currentName: string) => void;
  onCreateWorkspace: (name: string, note?: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onMoveCanvas: (canvasId: string, workspaceId: string) => void;
}

/**
 * Workspaces 画布目录（复刻 AstraDraw WorkspaceSidebar / SceneCard 视觉语言）。
 * 结构：标题 + 分组选择 + 搜索框 + 分组画布列表 + 底部新建画布按钮。
 * - "全部画布" 视图按 workspace 分组展示（组头可折叠）
 * - 单个分组视图只显示该组画布
 * - 画布条目 hover 显示三点菜单：重命名 / 移动到… / 删除
 */
export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  canvases,
  workspaces,
  currentCanvasId,
  onCanvasSelect,
  onCanvasDelete,
  onCanvasRename,
  onCreateWorkspace,
  onDeleteWorkspace,
  onMoveCanvas,
}) => {
  const setCreateCanvasDialog = useSetAtom(createCanvasDialogAtom);
  const setRenameCanvasDialog = useSetAtom(renameCanvasDialogAtom);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null, // null = 全部画布
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceNote, setNewWorkspaceNote] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuFor(null);
        setMoveMenuFor(null);
      }
    };
    if (menuFor || moveMenuFor) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuFor, moveMenuFor]);

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

  const handleDeleteWorkspace = useCallback(
    (ws: WorkspaceMetadata) => {
      const count = visibleCanvases.filter((c) => c.workspaceId === ws.id)
        .length;
      const msg =
        count > 0
          ? `删除分组「${ws.name}」后，其中 ${count} 个画布将移回「默认分组」。确定删除？`
          : `确定删除分组「${ws.name}」？`;
      if (window.confirm(msg)) {
        onDeleteWorkspace(ws.id);
      }
    },
    [visibleCanvases, onDeleteWorkspace],
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
      <div className="ws-card__actions" ref={menuRef}>
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
          <div className="ws-card__menu">
            <button
              className="ws-card__menu-item"
              onClick={(e) => {
                e.stopPropagation();
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
            <div
              className="ws-card__menu-item"
              style={{ position: "relative" }}
            >
              <button
                className="ws-card__menu-item-inner"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveMenuFor(moveMenuFor === canvas.id ? null : canvas.id);
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
                        onClick={(e) => {
                          e.stopPropagation();
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
              onClick={(e) => {
                e.stopPropagation();
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
    <div className="ws-sidebar">
      {/* 顶部：标题 + 分组选择 + 新建分组 */}
      <div className="ws-sidebar__header">
        <div className="ws-sidebar__title-row">
          <h2 className="ws-sidebar__title">我的画布</h2>
          <button
            className="ws-sidebar__add-group"
            title="新建分组"
            onClick={() => setShowCreateWorkspace(true)}
          >
            {PlusIcon}
          </button>
        </div>
        <div className="ws-sidebar__group-select">
          <button
            className={clsx("ws-sidebar__group-option", {
              "ws-sidebar__group-option--active": activeWorkspaceId === null,
            })}
            onClick={() => setActiveWorkspaceId(null)}
          >
            全部画布
          </button>
          <span className="ws-sidebar__group-count">
            {visibleCanvases.length}
          </span>
          <div className="ws-sidebar__group-list">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={clsx("ws-sidebar__group-option", {
                  "ws-sidebar__group-option--active":
                    activeWorkspaceId === ws.id,
                })}
                onClick={() => setActiveWorkspaceId(ws.id)}
              >
                {ws.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="ws-sidebar__search">
        {searchIcon}
        <input
          className="ws-sidebar__search-input"
          placeholder="搜索画布…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <span className="ws-sidebar__search-hint">
            {visibleCanvases.length} 个结果
          </span>
        )}
      </div>

      {/* 画布列表 */}
      <div className="ws-sidebar__content">
        {!activeWorkspaceId && grouped && grouped.length === 0 ? (
          <div className="ws-sidebar__empty">
            <p>还没有分组</p>
            <span>点击右上角 + 新建分组</span>
          </div>
        ) : visibleCanvases.length === 0 ? (
          <div className="ws-sidebar__empty">
            <p>{searchQuery ? "没有匹配的画布" : "这个分组还是空的"}</p>
            <span>
              {searchQuery ? "换个关键词试试" : "在下方创建新画布，创建时可选择分组"}
            </span>
          </div>
        ) : activeWorkspaceId ? (
          <div className="ws-sidebar__group">
            {visibleCanvases.map(renderCanvasRow)}
          </div>
        ) : (
          grouped!.map(({ workspace, items }) => {
            const collapsed = collapsedGroups.has(workspace.id);
            if (items.length === 0) {
              return null;
            }
            return (
              <div key={workspace.id} className="ws-sidebar__group">
                <div className="ws-sidebar__group-header">
                  <button
                    className="ws-sidebar__group-toggle"
                    onClick={() => toggleGroup(workspace.id)}
                  >
                    <span
                      className={clsx("ws-sidebar__chevron", {
                        "ws-sidebar__chevron--open": !collapsed,
                      })}
                    >
                      {chevronDownIcon}
                    </span>
                    <span className="ws-sidebar__group-name">
                      {workspace.name}
                    </span>
                    <span className="ws-sidebar__group-count">
                      {items.length}
                    </span>
                  </button>
                  {workspace.id !== "default" && (
                    <button
                      className="ws-sidebar__group-delete"
                      title={`删除分组「${workspace.name}」`}
                      onClick={() => handleDeleteWorkspace(workspace)}
                    >
                      {TrashIcon}
                    </button>
                  )}
                </div>
                {!collapsed && items.map(renderCanvasRow)}
              </div>
            );
          })
        )}
      </div>

      {/* 底部：新建画布 */}
      <div className="ws-sidebar__footer">
        <FilledButton
          label="新建画布"
          onClick={() => setCreateCanvasDialog({ isOpen: true })}
          fullWidth
        >
          {PlusIcon}
          <span className="ws-sidebar__footer-label">新建画布</span>
        </FilledButton>
      </div>

      {/* 新建分组对话框（复刻 AstraDraw CreateCollectionDialog 结构） */}
      {showCreateWorkspace && (
        <div
          className="ws-dialog-overlay"
          onClick={() => setShowCreateWorkspace(false)}
        >
          <div
            className="ws-dialog"
            onClick={(e) => e.stopPropagation()}
          >
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
    </div>
  );
};

export default WorkspaceSidebar;
