import toast from "react-hot-toast";

/**
 * Toast notification utilities for AstraDraw.
 *
 * Provides a centralized way to show success, error, and loading notifications.
 * Replaces the duplicated showSuccess() functions and alert() calls throughout the app.
 */

/**
 * Show a success toast notification.
 * @param message The message to display
 */
export const showSuccess = (message: string) => {
  toast.success(message, { duration: 3000 });
};

/**
 * Show an error toast notification.
 * @param message The error message to display
 */
export const showError = (message: string) => {
  toast.error(message, { duration: 4000 });
};

/**
 * Show a loading toast that resolves to success or error.
 * @param promise The promise to track
 * @param messages Loading, success, and error messages
 * @returns The promise result
 */
export const showLoading = <T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string },
): Promise<T> => {
  return toast.promise(promise, messages);
};
