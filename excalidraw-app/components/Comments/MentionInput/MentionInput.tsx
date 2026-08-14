/**
 * MentionInput - Rich text input with @mention autocomplete
 *
 * Features:
 * - Type @ to trigger user autocomplete
 * - Click @ button to trigger autocomplete
 * - Displays mentions as styled chips (highlighted)
 * - Stores mentions as @[Name](userId) format internally
 * - Returns mentions array of user IDs
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import { useWorkspaceMembers } from "../../../hooks/useWorkspaceMembers";

import styles from "./MentionInput.module.scss";

import type { MentionableUser } from "../../../hooks/useWorkspaceMembers";

export interface MentionInputProps {
  /** Current input value (raw format with @[Name](id)) */
  value: string;
  /** Called when value changes */
  onChange: (value: string, mentions: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Workspace ID for fetching members */
  workspaceId: string | undefined;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Called when Enter is pressed (without shift) */
  onSubmit?: () => void;
}

export interface MentionInputHandle {
  focus: () => void;
  insertMention: (user: MentionableUser) => void;
}

/**
 * Extract mention user IDs from text content
 */
function extractMentions(text: string): string[] {
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    mentions.push(match[2]); // User ID
  }

  return [...new Set(mentions)]; // Deduplicate
}

/**
 * Convert raw value to display HTML with styled mention chips
 */
function rawToDisplay(raw: string): string {
  // Replace @[Name](id) with styled span
  return raw.replace(
    /@\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="mention-chip" data-user-id="$2" contenteditable="false">$1</span>',
  );
}

/**
 * Convert display HTML back to raw format
 */
function displayToRaw(container: HTMLElement): string {
  let result = "";

  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains("mention-chip")) {
        const userId = el.getAttribute("data-user-id");
        const name = el.textContent;
        result += `@[${name}](${userId})`;
      } else if (el.tagName === "BR") {
        result += "\n";
      } else {
        // Recursively handle nested elements
        result += displayToRaw(el);
      }
    }
  });

  return result;
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  (
    {
      value,
      onChange,
      placeholder,
      workspaceId,
      disabled = false,
      autoFocus = false,
      onSubmit,
    },
    ref,
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [showDropdown, setShowDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState<{
      top: number;
      left: number;
    } | null>(null);

    // Track if we're in mention mode (after typing @)
    const mentionModeRef = useRef(false);

    const { members, isLoading } = useWorkspaceMembers({
      workspaceId,
      enabled: !!workspaceId,
    });

    // Filter members based on search query
    const filteredMembers = members.filter(
      (member) =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      insertMention: (user: MentionableUser) => {
        insertMentionAtCursor(user);
      },
    }));

    // Insert mention chip at current cursor position
    const insertMentionAtCursor = useCallback(
      (user: MentionableUser) => {
        const editor = editorRef.current;
        if (!editor) {
          return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          return;
        }

        const range = selection.getRangeAt(0);

        // If in mention mode, delete the @ and search text
        if (mentionModeRef.current) {
          // Find and remove the @ trigger and search text
          const textNode = range.startContainer;
          if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent || "";
            const cursorPos = range.startOffset;

            // Find the @ before cursor
            let atPos = -1;
            for (let i = cursorPos - 1; i >= 0; i--) {
              if (text[i] === "@") {
                atPos = i;
                break;
              }
            }

            if (atPos >= 0) {
              // Delete from @ to cursor
              const beforeAt = text.slice(0, atPos);
              const afterCursor = text.slice(cursorPos);
              textNode.textContent = beforeAt + afterCursor;

              // Set cursor position after the deletion
              range.setStart(textNode, atPos);
              range.setEnd(textNode, atPos);
            }
          }
        }

        // Create mention chip
        const chip = document.createElement("span");
        chip.className = "mention-chip";
        chip.setAttribute("data-user-id", user.id);
        chip.setAttribute("contenteditable", "false");
        chip.textContent = user.name;

        // Insert chip
        range.insertNode(chip);

        // Add a space after the chip and move cursor there
        const space = document.createTextNode("\u00A0"); // Non-breaking space
        chip.after(space);

        // Move cursor after the space
        range.setStartAfter(space);
        range.setEndAfter(space);
        selection.removeAllRanges();
        selection.addRange(range);

        // Reset dropdown state
        setShowDropdown(false);
        setSearchQuery("");
        setSelectedIndex(0);
        mentionModeRef.current = false;

        // Trigger onChange with new raw value
        const newRaw = displayToRaw(editor);
        onChange(newRaw, extractMentions(newRaw));

        // Focus editor
        editor.focus();
      },
      [onChange],
    );

    // Handle input in contenteditable
    const handleInput = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;

      if (textNode.nodeType === Node.TEXT_NODE) {
        const text = textNode.textContent || "";
        const cursorPos = range.startOffset;

        // Check for @ trigger
        let atPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
          const char = text[i];
          if (char === "@") {
            // Check if @ is at start or preceded by whitespace
            if (i === 0 || /\s/.test(text[i - 1])) {
              atPos = i;
              break;
            }
          }
          // Stop searching if we hit whitespace
          if (/\s/.test(char)) {
            break;
          }
        }

        if (atPos >= 0) {
          // We're in mention mode
          const query = text.slice(atPos + 1, cursorPos);
          mentionModeRef.current = true;
          setSearchQuery(query);
          setShowDropdown(true);
          setSelectedIndex(0);
        } else if (mentionModeRef.current) {
          // Exit mention mode
          mentionModeRef.current = false;
          setShowDropdown(false);
          setSearchQuery("");
        }
      }

      // Update raw value
      const newRaw = displayToRaw(editor);
      onChange(newRaw, extractMentions(newRaw));
    }, [onChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Stop propagation to prevent canvas shortcuts
        e.stopPropagation();

        // Allow text editing shortcuts
        const isTextEditingShortcut =
          (e.metaKey || e.ctrlKey) &&
          ["a", "c", "x", "v", "z", "y"].includes(e.key.toLowerCase());

        if (isTextEditingShortcut) {
          return;
        }

        if (showDropdown && filteredMembers.length > 0) {
          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              setSelectedIndex((prev) =>
                prev < filteredMembers.length - 1 ? prev + 1 : 0,
              );
              return;
            case "ArrowUp":
              e.preventDefault();
              setSelectedIndex((prev) =>
                prev > 0 ? prev - 1 : filteredMembers.length - 1,
              );
              return;
            case "Enter":
            case "Tab":
              e.preventDefault();
              insertMentionAtCursor(filteredMembers[selectedIndex]);
              return;
            case "Escape":
              e.preventDefault();
              setShowDropdown(false);
              mentionModeRef.current = false;
              return;
          }
        }

        // Submit on Enter (without shift)
        if (e.key === "Enter" && !e.shiftKey && !showDropdown) {
          e.preventDefault();
          onSubmit?.();
        }
      },
      [
        showDropdown,
        filteredMembers,
        selectedIndex,
        insertMentionAtCursor,
        onSubmit,
      ],
    );

    // Handle clicking a member in dropdown
    const handleMemberClick = useCallback(
      (member: MentionableUser) => {
        insertMentionAtCursor(member);
      },
      [insertMentionAtCursor],
    );

    // Calculate dropdown position when it opens
    useEffect(() => {
      if (!showDropdown || !editorRef.current) {
        setDropdownPosition(null);
        return;
      }

      const rect = editorRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top - 4,
        left: rect.left,
      });
    }, [showDropdown]);

    // Close dropdown when clicking outside
    useEffect(() => {
      if (!showDropdown) {
        return;
      }

      const handleClickOutside = (e: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node) &&
          editorRef.current &&
          !editorRef.current.contains(e.target as Node)
        ) {
          setShowDropdown(false);
          mentionModeRef.current = false;
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [showDropdown]);

    // Scroll selected item into view
    useEffect(() => {
      if (!showDropdown || !dropdownRef.current) {
        return;
      }

      const selectedItem = dropdownRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex, showDropdown]);

    // Sync external value changes to editor
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      // Only update if the raw value is different
      const currentRaw = displayToRaw(editor);
      if (currentRaw !== value) {
        editor.innerHTML = rawToDisplay(value) || "";
      }
    }, [value]);

    // Auto-focus on mount and set cursor at start
    useEffect(() => {
      if (autoFocus && editorRef.current) {
        const editor = editorRef.current;

        // Clear any browser-inserted content (like <br> tags) and set empty text
        if (!editor.textContent || editor.textContent === "\u200B") {
          editor.innerHTML = "";
          const textNode = document.createTextNode("");
          editor.appendChild(textNode);
        }

        editor.focus();

        // Set cursor at the beginning - use multiple attempts to override browser behavior
        const setCursorToStart = () => {
          const selection = window.getSelection();
          const firstNode = editor.firstChild;

          if (selection && firstNode) {
            const range = document.createRange();
            // If it's a text node, set cursor at position 0
            if (firstNode.nodeType === Node.TEXT_NODE) {
              range.setStart(firstNode, 0);
              range.setEnd(firstNode, 0);
            } else {
              // If not a text node, set cursor at start of editor
              range.setStart(editor, 0);
              range.setEnd(editor, 0);
            }
            selection.removeAllRanges();
            selection.addRange(range);
          }
        };

        // Try immediately
        setCursorToStart();

        // Try again after browser has finished its default behavior
        setTimeout(setCursorToStart, 0);
        requestAnimationFrame(() => {
          setTimeout(setCursorToStart, 10);
        });
      }
    }, [autoFocus]);

    // Check if empty for placeholder
    const isEmpty = !value || value.trim() === "";

    // Handle focus to position cursor at start when empty
    const handleFocus = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      // Check if editor is truly empty (no text content or only whitespace)
      const textContent = editor.textContent || "";
      if (textContent.trim() !== "") {
        return; // Only handle empty editor
      }

      // Ensure there's a text node for cursor positioning
      if (!editor.firstChild || editor.firstChild.nodeType !== Node.TEXT_NODE) {
        editor.textContent = "";
      }

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (selection && editor.firstChild) {
          const range = document.createRange();
          range.setStart(editor.firstChild, 0);
          range.setEnd(editor.firstChild, 0);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
    }, []);

    return (
      <div className={styles.container}>
        <div
          ref={editorRef}
          className={`${styles.editor} ${isEmpty ? styles.empty : ""}`}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          onFocus={handleFocus}
          data-placeholder={placeholder}
          role="textbox"
          aria-multiline="true"
          aria-disabled={disabled}
        />

        {/* Dropdown - uses fixed positioning to escape overflow:hidden */}
        {showDropdown && dropdownPosition && (
          <div
            ref={dropdownRef}
            className={styles.dropdown}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              transform: "translateY(-100%)",
            }}
          >
            {isLoading ? (
              <div className={styles.loading}>
                {t("comments.loadingMembers")}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className={styles.empty}>
                {searchQuery
                  ? t("comments.noMembersFound")
                  : t("comments.typeToSearch")}
              </div>
            ) : (
              filteredMembers.map((member, index) => (
                <button
                  key={member.id}
                  type="button"
                  className={`${styles.memberItem} ${
                    index === selectedIndex ? styles.selected : ""
                  }`}
                  onClick={() => handleMemberClick(member)}
                >
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className={styles.memberAvatar}
                    />
                  ) : (
                    <div className={styles.memberAvatarFallback}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{member.name}</span>
                    <span className={styles.memberEmail}>{member.email}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  },
);
