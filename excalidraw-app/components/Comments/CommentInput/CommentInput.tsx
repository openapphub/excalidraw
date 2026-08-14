/**
 * CommentInput - Reply input area for thread popup
 *
 * Structure: One box with two sections divided by a single line
 * - Top section: textarea (gray bg)
 * - Bottom section: toolbar (gray bg)
 * - Single border line between them
 */

import { useState, useCallback, useRef } from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import { MentionInput } from "../MentionInput";

import { InlineEmojiPicker } from "./InlineEmojiPicker";

import styles from "./CommentInput.module.scss";

import type { MentionInputHandle } from "../MentionInput";

export interface CommentInputProps {
  /** Called when user submits a comment */
  onSubmit: (content: string, mentions: string[]) => Promise<void>;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Workspace ID for @mentions */
  workspaceId: string | undefined;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus input on mount */
  autoFocus?: boolean;
}

export function CommentInput({
  onSubmit,
  isSubmitting = false,
  workspaceId,
  placeholder = "Reply, @mention someone...",
  autoFocus = false,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<MentionInputHandle>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Handle content change from MentionInput
  const handleChange = useCallback(
    (newContent: string, newMentions: string[]) => {
      setContent(newContent);
      setMentions(newMentions);
    },
    [],
  );

  // Handle emoji selection - insert at end of content
  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    // Focus back on input
    inputRef.current?.focus();
  }, []);

  // Handle @ button click - insert @ and focus input
  const handleAtClick = useCallback(() => {
    setContent((prev) => `${prev}@`);
    inputRef.current?.focus();
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSubmitting) {
      return;
    }

    try {
      await onSubmit(trimmedContent, mentions);
      // Clear input on success
      setContent("");
      setMentions([]);
    } catch (err) {
      // Error handling is done by parent
      console.error("Failed to submit comment:", err);
    }
  }, [content, mentions, isSubmitting, onSubmit]);

  // Check if can submit
  const canSubmit = content.trim().length > 0 && !isSubmitting;

  return (
    <div className={styles.container}>
      {/* One box with two sections divided by a line */}
      <div className={styles.inputBox}>
        {/* Top section: textarea */}
        <div className={styles.inputRow}>
          <MentionInput
            ref={inputRef}
            value={content}
            onChange={handleChange}
            placeholder={placeholder}
            workspaceId={workspaceId}
            disabled={isSubmitting}
            autoFocus={autoFocus}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Bottom section: toolbar (separated by border-bottom of inputRow) */}
        <div className={styles.toolbar}>
          {/* Left side: Emoji and @ buttons */}
          <div className={styles.leftTools}>
            <button
              ref={emojiButtonRef}
              type="button"
              className={`${styles.toolButton} ${
                showEmojiPicker ? styles.active : ""
              }`}
              title={t("comments.addEmoji")}
              disabled={isSubmitting}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <EmojiIcon />
            </button>
            <button
              type="button"
              className={styles.toolButton}
              title={t("comments.mentionSomeone")}
              disabled={isSubmitting}
              onClick={handleAtClick}
            >
              <AtIcon />
            </button>
          </div>
          {showEmojiPicker && (
            <InlineEmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
              anchorRef={emojiButtonRef}
            />
          )}

          {/* Right side: Send button */}
          <button
            type="button"
            className={`${styles.sendButton} ${canSubmit ? styles.active : ""}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={t("comments.send")}
          >
            {isSubmitting ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

function EmojiIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function AtIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5l0 14" />
      <path d="M16 9l-4 -4" />
      <path d="M8 9l4 -4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={styles.spinner}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
