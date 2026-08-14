/**
 * Jotai atoms for notification UI state.
 *
 * Server state (notification data) is managed by React Query hooks.
 * These atoms handle only client-side UI state.
 */

import { atom } from "../../app-jotai";

// ============================================================================
// Popup State
// ============================================================================

/**
 * Whether the notification popup is currently open.
 */
export const isNotificationPopupOpenAtom = atom<boolean>(false);

/**
 * Toggle notification popup open/closed.
 *
 * @example
 * ```ts
 * const togglePopup = useSetAtom(toggleNotificationPopupAtom);
 * <button onClick={togglePopup}>Toggle</button>
 * ```
 */
export const toggleNotificationPopupAtom = atom(null, (get, set) => {
  set(isNotificationPopupOpenAtom, !get(isNotificationPopupOpenAtom));
});

/**
 * Close the notification popup.
 *
 * @example
 * ```ts
 * const closePopup = useSetAtom(closeNotificationPopupAtom);
 * // On click outside
 * closePopup();
 * ```
 */
export const closeNotificationPopupAtom = atom(null, (_get, set) => {
  set(isNotificationPopupOpenAtom, false);
});

/**
 * Open the notification popup.
 *
 * @example
 * ```ts
 * const openPopup = useSetAtom(openNotificationPopupAtom);
 * openPopup();
 * ```
 */
export const openNotificationPopupAtom = atom(null, (_get, set) => {
  set(isNotificationPopupOpenAtom, true);
});
