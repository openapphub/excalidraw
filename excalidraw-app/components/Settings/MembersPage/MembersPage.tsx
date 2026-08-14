import React, { useState, useEffect, useCallback } from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  listWorkspaceMembers,
  updateMemberRole,
  removeMember,
  createInviteLink,
  type WorkspaceMember,
  type WorkspaceRole,
} from "../../../auth/workspaceApi";
import { showSuccess } from "../../../utils/toast";

import styles from "./MembersPage.module.scss";

// Stop keyboard events from propagating
const stopPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

export interface MembersPageProps {
  workspaceId: string | null;
  isAdmin: boolean;
}

export const MembersPage: React.FC<MembersPageProps> = ({
  workspaceId,
  isAdmin,
}) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("MEMBER");
  const [searchQuery, setSearchQuery] = useState("");

  const loadMembers = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await listWorkspaceMembers(workspaceId);
      setMembers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load members");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    if (!workspaceId) {
      return;
    }

    try {
      await updateMemberRole(workspaceId, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
      showSuccess(t("settings.roleUpdated"));
    } catch (err: any) {
      setError(err.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!workspaceId) {
      return;
    }
    if (!confirm(t("settings.confirmRemoveMember", { name: memberName }))) {
      return;
    }

    try {
      await removeMember(workspaceId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      showSuccess(t("settings.memberRemoved"));
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
    }
  };

  const handleCreateInviteLink = async () => {
    if (!workspaceId) {
      return;
    }

    try {
      // Calculate expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const link = await createInviteLink(workspaceId, {
        role: inviteRole,
        expiresAt: expiresAt.toISOString(),
      });
      const fullUrl = `${window.location.origin}/invite/${link.code}`;
      setInviteLink(fullUrl);
    } catch (err: any) {
      setError(err.message || "Failed to create invite link");
    }
  };

  const handleCopyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      showSuccess(t("settings.linkCopied"));
    }
  };

  const getInitials = (name: string | null, email: string): string => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const getRoleBadgeStyle = (role: WorkspaceRole): string => {
    switch (role) {
      case "ADMIN":
        return styles.roleBadgeAdmin;
      case "MEMBER":
        return styles.roleBadgeMember;
      case "VIEWER":
        return styles.roleBadgeViewer;
      default:
        return styles.roleBadge;
    }
  };

  const getRoleSelectStyle = (role: WorkspaceRole): string => {
    switch (role) {
      case "MEMBER":
        return styles.roleSelectMember;
      case "VIEWER":
        return styles.roleSelectViewer;
      default:
        return styles.roleSelect;
    }
  };

  const filteredMembers = members.filter((member) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      member.user.name?.toLowerCase().includes(query) ||
      member.user.email.toLowerCase().includes(query)
    );
  });

  if (!workspaceId) {
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
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>{t("settings.members")}</h1>
            <p className={styles.subtitle}>
              {t("settings.membersDescription", { count: members.length })}
            </p>
          </div>
          {isAdmin && (
            <button
              className={styles.inviteButton}
              onClick={() => setShowInviteDialog(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              {t("settings.inviteMember")}
            </button>
          )}
        </div>

        {/* Separator after header */}
        <div className={styles.separator} />

        {/* Error messages */}
        {error && <div className={styles.errorInline}>{error}</div>}

        {/* Search */}
        <div className={styles.search}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={t("settings.searchMembers")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={stopPropagation}
            onKeyUp={stopPropagation}
          />
        </div>

        {/* Members list */}
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className={styles.emptyList}>
            {searchQuery ? (
              <p>{t("settings.noMembersFound")}</p>
            ) : (
              <p>{t("settings.noMembers")}</p>
            )}
          </div>
        ) : (
          <div className={styles.list}>
            {filteredMembers.map((member) => (
              <div key={member.id} className={styles.member}>
                <div className={styles.memberAvatar}>
                  {member.user.avatarUrl ? (
                    <img
                      src={member.user.avatarUrl}
                      alt={member.user.name || member.user.email}
                    />
                  ) : (
                    <div className={styles.memberInitials}>
                      {getInitials(member.user.name, member.user.email)}
                    </div>
                  )}
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>
                    {member.user.name || member.user.email}
                  </span>
                  {member.user.name && (
                    <span className={styles.memberEmail}>
                      {member.user.email}
                    </span>
                  )}
                </div>
                <div className={styles.memberRole}>
                  {isAdmin && member.role !== "ADMIN" ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(
                          member.id,
                          e.target.value as WorkspaceRole,
                        )
                      }
                      className={getRoleSelectStyle(member.role)}
                    >
                      <option value="MEMBER">{t("settings.roleMember")}</option>
                      <option value="VIEWER">{t("settings.roleViewer")}</option>
                    </select>
                  ) : (
                    <span className={getRoleBadgeStyle(member.role)}>
                      {member.role === "ADMIN"
                        ? t("settings.roleAdmin")
                        : member.role === "MEMBER"
                        ? t("settings.roleMember")
                        : t("settings.roleViewer")}
                    </span>
                  )}
                </div>
                {isAdmin && member.role !== "ADMIN" && (
                  <button
                    className={styles.memberRemove}
                    onClick={() =>
                      handleRemoveMember(
                        member.id,
                        member.user.name || member.user.email,
                      )
                    }
                    title={t("settings.removeMember")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      {showInviteDialog && (
        <div
          className={styles.dialogOverlay}
          onClick={() => {
            setShowInviteDialog(false);
            setInviteLink(null);
          }}
        >
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2>{t("settings.inviteMember")}</h2>
              <button
                className={styles.dialogClose}
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteLink(null);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={styles.dialogContent}>
              {!inviteLink ? (
                <>
                  <p>{t("settings.inviteDescription")}</p>
                  <div className={styles.formGroup}>
                    <label>{t("settings.inviteRole")}</label>
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as WorkspaceRole)
                      }
                      className={styles.select}
                    >
                      <option value="MEMBER">{t("settings.roleMember")}</option>
                      <option value="VIEWER">{t("settings.roleViewer")}</option>
                    </select>
                  </div>
                  <button
                    className={styles.buttonPrimary}
                    onClick={handleCreateInviteLink}
                  >
                    {t("settings.generateLink")}
                  </button>
                </>
              ) : (
                <>
                  <p>{t("settings.inviteLinkReady")}</p>
                  <div className={styles.inviteLink}>
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      onKeyDown={stopPropagation}
                      onKeyUp={stopPropagation}
                    />
                    <button
                      className={styles.copyButton}
                      onClick={handleCopyInviteLink}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                  <p className={styles.inviteHint}>
                    {t("settings.inviteLinkExpires")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersPage;
