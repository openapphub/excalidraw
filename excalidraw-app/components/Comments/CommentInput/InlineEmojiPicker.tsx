/**
 * InlineEmojiPicker - Full-featured emoji picker popup for comment input
 *
 * Shows search, categories, and scrollable emoji grid (reuses EmojiPicker component logic)
 * Uses React Portal to render outside the parent container hierarchy
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  fetchEmojiData,
  searchEmojis,
  EMOJI_GROUPS,
  type TwemojiItem,
  type TwemojiGroup,
  type EmojiGroupSlug,
} from "../../Stickers/twemojiApi";

import styles from "./InlineEmojiPicker.module.scss";

export interface InlineEmojiPickerProps {
  /** Called when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Called when picker should close */
  onClose: () => void;
  /** Reference element for positioning */
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function InlineEmojiPicker({
  onSelect,
  onClose,
  anchorRef,
}: InlineEmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] =
    useState<EmojiGroupSlug>("smileys_emotion");
  const [emojiGroups, setEmojiGroups] = useState<TwemojiGroup[]>([]);
  const [searchResults, setSearchResults] = useState<TwemojiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate position based on anchor element
  useEffect(() => {
    if (!anchorRef.current) {
      return;
    }

    const updatePosition = () => {
      const anchorRect = anchorRef.current!.getBoundingClientRect();
      const pickerHeight = 360;
      const pickerWidth = 400;

      // Position above the anchor, aligned to left
      let top = anchorRect.top - pickerHeight - 4;
      let left = anchorRect.left;

      // If picker goes above viewport, position below instead
      if (top < 10) {
        top = anchorRect.bottom + 4;
      }

      // If picker goes off right edge, align to right
      if (left + pickerWidth > window.innerWidth - 10) {
        left = window.innerWidth - pickerWidth - 10;
      }

      // If picker goes off left edge
      if (left < 10) {
        left = 10;
      }

      setPosition({ top, left });
    };

    updatePosition();

    // Update position on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef]);

  // Load emoji data on mount
  useEffect(() => {
    const loadEmojis = async () => {
      setLoading(true);
      try {
        const data = await fetchEmojiData();
        setEmojiGroups(data);
      } catch (err) {
        console.error("Failed to load emoji data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadEmojis();
  }, []);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchEmojis(searchQuery);
        setSearchResults(results.slice(0, 50)); // Limit results
      } catch (err) {
        console.error("Failed to search emojis:", err);
      }
    }, 200);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Add listener with small delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  // Focus search input when picker opens
  useEffect(() => {
    if (searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
    },
    [onSelect],
  );

  // Get emojis for the selected group
  const currentGroupEmojis =
    emojiGroups.find((g) => g.slug === selectedGroup)?.emojis || [];

  // Determine what to display in the grid
  const displayEmojis = searchQuery.trim() ? searchResults : currentGroupEmojis;

  const pickerContent = (
    <div
      ref={pickerRef}
      className={styles.picker}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Category tabs */}
      <div className={styles.categories}>
        {EMOJI_GROUPS.map((group) => (
          <button
            key={group.slug}
            type="button"
            className={clsx(styles.category, {
              [styles.categoryActive]:
                selectedGroup === group.slug && !searchQuery,
            })}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedGroup(group.slug);
              setSearchQuery("");
            }}
            title={group.name}
          >
            {group.icon}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className={styles.search}>
        <input
          ref={searchInputRef}
          type="text"
          className={styles.searchInput}
          placeholder={t("emojiPicker.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        />
      </div>

      {/* Emoji grid */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : (
          <div className={styles.section}>
            {!searchQuery && (
              <h4 className={styles.sectionTitle}>
                {EMOJI_GROUPS.find((g) => g.slug === selectedGroup)?.name || ""}
              </h4>
            )}
            {searchQuery && searchResults.length === 0 ? (
              <div className={styles.empty}>{t("emojiPicker.noResults")}</div>
            ) : (
              <div className={styles.grid}>
                {displayEmojis.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className={styles.emoji}
                    onClick={() => handleEmojiSelect(item.emoji)}
                    title={item.name}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render picker in a portal at document body level
  return createPortal(pickerContent, document.body);
}
