import { useAtomValue } from "../../app-jotai";
import { sceneEditLockAtom } from "../Settings/settingsState";

import styles from "./SceneEditLockBanner.module.scss";

export const SceneEditLockBanner = () => {
  const lock = useAtomValue(sceneEditLockAtom);
  if (!lock?.locked) {
    return null;
  }
  const text = lock.isOtherTab
    ? "你已在其他窗口编辑此画布"
    : `${lock.editorName || "同事"} 正在编辑`;
  return (
    <div className={styles.banner} role="status">
      {text}
    </div>
  );
};
