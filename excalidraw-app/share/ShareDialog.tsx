import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import {
  copyIcon,
  LinkIcon,
  playerPlayIcon,
  playerStopFilledIcon,
  share,
  shareIOS,
  shareWindows,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useCopyStatus } from "@excalidraw/excalidraw/hooks/useCopiedIndicator";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { KEYS, getFrame } from "@excalidraw/common";
import { useEffect, useRef, useState } from "react";

import { atom, useAtom, useAtomValue, useSetAtom } from "../app-jotai";
import { activeRoomLinkAtom } from "../collab/Collab";
import {
  startCollaboration as startSceneCollabRoom,
  enableSceneCollab,
  disableSceneCollab,
} from "../auth/workspaceApi";
import {
  currentSceneIdAtom,
  sceneCollabEnabledAtom,
} from "../components/Settings/settingsState";

import "./ShareDialog.scss";
import { QRCode } from "./QRCode";

import type { CollabAPI } from "../collab/Collab";

type OnExportToBackend = () => void;
type ShareDialogType = "share" | "collaborationOnly";

export const shareDialogStateAtom = atom<
  { isOpen: false } | { isOpen: true; type: ShareDialogType }
>({ isOpen: false });

const getShareIcon = () => {
  const navigator = window.navigator as any;
  const isAppleBrowser = /Apple/.test(navigator.vendor);
  const isWindowsBrowser = navigator.appVersion.indexOf("Win") !== -1;

  if (isAppleBrowser) {
    return shareIOS;
  } else if (isWindowsBrowser) {
    return shareWindows;
  }

  return share;
};

export type ShareDialogProps = {
  collabAPI: CollabAPI | null;
  handleClose: () => void;
  onExportToBackend: OnExportToBackend;
  type: ShareDialogType;
};

const ActiveRoomDialog = ({
  collabAPI,
  activeRoomLink,
  handleClose,
}: {
  collabAPI: CollabAPI;
  activeRoomLink: string;
  handleClose: () => void;
}) => {
  const { t } = useI18n();
  const currentSceneId = useAtomValue(currentSceneIdAtom);
  const setSceneCollabEnabled = useSetAtom(sceneCollabEnabledAtom);
  const [, setJustCopied] = useState(false);
  const timerRef = useRef<number>(0);
  const ref = useRef<HTMLInputElement>(null);
  const isShareSupported = "share" in navigator;
  const { onCopy, copyStatus } = useCopyStatus();

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);
    } catch (e) {
      collabAPI.setCollabError(t("errors.copyToSystemClipboardFailed"));
    }

    setJustCopied(true);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setJustCopied(false);
    }, 3000);

    ref.current?.select();
  };

  const shareRoomLink = async () => {
    try {
      await navigator.share({
        title: t("roomDialog.shareTitle"),
        text: t("roomDialog.shareTitle"),
        url: activeRoomLink,
      });
    } catch (error: any) {
      // Just ignore.
    }
  };

  return (
    <>
      <h3 className="ShareDialog__active__header">
        {t("labels.liveCollaboration").replace(/\./g, "")}
      </h3>
      <TextField
        defaultValue={collabAPI.getUsername()}
        placeholder="Your name"
        label="Your name"
        onChange={collabAPI.setUsername}
        onKeyDown={(event) => event.key === KEYS.ENTER && handleClose()}
      />
      <div className="ShareDialog__active__linkRow">
        <TextField
          ref={ref}
          label="Link"
          readonly
          fullWidth
          value={activeRoomLink}
        />
        {isShareSupported && (
          <FilledButton
            size="large"
            variant="icon"
            label="Share"
            icon={getShareIcon()}
            className="ShareDialog__active__share"
            onClick={shareRoomLink}
          />
        )}
        <FilledButton
          size="large"
          label={t("buttons.copyLink")}
          icon={copyIcon}
          status={copyStatus}
          onClick={() => {
            copyRoomLink();
            onCopy();
          }}
        />
      </div>
      <QRCode value={activeRoomLink} />
      <div className="ShareDialog__active__description">
        <p>
          <span
            role="img"
            aria-hidden="true"
            className="ShareDialog__active__description__emoji"
          >
            🔒{" "}
          </span>
          {t("roomDialog.desc_privacy")}
        </p>
        <p>{t("roomDialog.desc_exitSession")}</p>
      </div>

      <div className="ShareDialog__active__actions">
        <FilledButton
          size="large"
          variant="outlined"
          color="danger"
          label={t("roomDialog.button_stopSession")}
          icon={playerStopFilledIcon}
          onClick={async () => {
            trackEvent("share", "room closed");
            const sceneId = currentSceneId;
            if (sceneId && collabAPI.getRoomId() === sceneId) {
              try {
                await disableSceneCollab(sceneId);
              } catch (error) {
                console.error(error);
              }
              setSceneCollabEnabled(false);
              collabAPI.stopCollaboration(false);
              handleClose();
              return;
            }
            collabAPI.stopCollaboration();
            if (!collabAPI.isCollaborating()) {
              handleClose();
            }
          }}
        />
      </div>
    </>
  );
};

const ShareDialogPicker = (props: ShareDialogProps) => {
  const { t } = useI18n();
  const currentSceneId = useAtomValue(currentSceneIdAtom);
  const setSceneCollabEnabled = useSetAtom(sceneCollabEnabledAtom);

  const { collabAPI } = props;

  const startWorkspaceCollab = async () => {
    if (!collabAPI || !currentSceneId) {
      return;
    }
    trackEvent("share", "workspace collab", `ui (${getFrame()})`);
    try {
      await enableSceneCollab(currentSceneId);
      setSceneCollabEnabled(true);
      const { roomId, roomKey } = await startSceneCollabRoom(currentSceneId);
      await collabAPI.startCollaboration({
        roomId,
        roomKey,
        isAutoCollab: true,
      });
    } catch (error) {
      console.error("Failed to enable workspace collaboration:", error);
      setSceneCollabEnabled(false);
    }
  };

  const startCollabJSX = collabAPI ? (
    <>
      <div className="ShareDialog__picker__header">
        {currentSceneId ? "允许一起编辑" : t("labels.liveCollaboration").replace(/\./g, "")}
      </div>

      <div className="ShareDialog__picker__description">
        {currentSceneId ? (
          <div>
            解锁这条工作区画布，把地址栏里的 Scene 链接发给已加入的同事，大家可以一起改、写进数据库。
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "1em" }}>{t("roomDialog.desc_intro")}</div>
            {t("roomDialog.desc_privacy")}
          </>
        )}
      </div>

      <div className="ShareDialog__picker__button">
        <FilledButton
          size="large"
          label={currentSceneId ? "允许一起编辑" : t("roomDialog.button_startSession")}
          icon={playerPlayIcon}
          onClick={() => {
            if (currentSceneId) {
              void startWorkspaceCollab();
              return;
            }
            trackEvent("share", "room creation", `ui (${getFrame()})`);
            collabAPI.startCollaboration(null);
          }}
        />
      </div>

      {currentSceneId && (
        <>
          <div className="ShareDialog__separator">
            <span>{t("shareDialog.or")}</span>
          </div>
          <div className="ShareDialog__picker__description">
            临时房间（不写工作区、关掉后不在列表里）
          </div>
          <div className="ShareDialog__picker__button">
            <FilledButton
              size="large"
              variant="outlined"
              label="开始临时房间"
              icon={playerPlayIcon}
              onClick={() => {
                trackEvent("share", "room creation", `ui (${getFrame()})`);
                collabAPI.startCollaboration(null);
              }}
            />
          </div>
        </>
      )}

      {props.type === "share" && (
        <div className="ShareDialog__separator">
          <span>{t("shareDialog.or")}</span>
        </div>
      )}
    </>
  ) : null;

  return (
    <>
      {startCollabJSX}

      {props.type === "share" && (
        <>
          <div className="ShareDialog__picker__header">
            {t("exportDialog.link_title")}
          </div>
          <div className="ShareDialog__picker__description">
            {t("exportDialog.link_details")}
          </div>

          <div className="ShareDialog__picker__button">
            <FilledButton
              size="large"
              label={t("exportDialog.link_button")}
              icon={LinkIcon}
              onClick={async () => {
                await props.onExportToBackend();
                props.handleClose();
              }}
            />
          </div>
        </>
      )}
    </>
  );
};

const ShareDialogInner = (props: ShareDialogProps) => {
  const activeRoomLink = useAtomValue(activeRoomLinkAtom);

  return (
    <Dialog size="small" onCloseRequest={props.handleClose} title={false}>
      <div className="ShareDialog">
        {props.collabAPI && activeRoomLink ? (
          <ActiveRoomDialog
            collabAPI={props.collabAPI}
            activeRoomLink={activeRoomLink}
            handleClose={props.handleClose}
          />
        ) : (
          <ShareDialogPicker {...props} />
        )}
      </div>
    </Dialog>
  );
};

export const ShareDialog = (props: {
  collabAPI: CollabAPI | null;
  onExportToBackend: OnExportToBackend;
}) => {
  const [shareDialogState, setShareDialogState] = useAtom(shareDialogStateAtom);

  const { openDialog } = useUIAppState();

  useEffect(() => {
    if (openDialog) {
      setShareDialogState({ isOpen: false });
    }
  }, [openDialog, setShareDialogState]);

  if (!shareDialogState.isOpen) {
    return null;
  }

  return (
    <ShareDialogInner
      handleClose={() => setShareDialogState({ isOpen: false })}
      collabAPI={props.collabAPI}
      onExportToBackend={props.onExportToBackend}
      type={shareDialogState.type}
    />
  );
};
