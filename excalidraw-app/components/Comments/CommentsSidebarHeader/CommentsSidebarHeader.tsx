import React, { useState, useCallback, useRef, useEffect } from "react";

import { t } from "@excalidraw/excalidraw/i18n";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { searchIcon } from "@excalidraw/excalidraw/components/icons";

import styles from "./CommentsSidebarHeader.module.scss";

import type { ThreadFilters } from "../../../auth/api/types";

// ============================================================================
// Types
// ============================================================================

export interface CommentsSidebarHeaderProps {
  filters: ThreadFilters;
  onFiltersChange: (filters: ThreadFilters) => void;
}

// ============================================================================
// Icons
// ============================================================================

const FilterIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="2" x2="6" y1="14" y2="14" />
    <line x1="10" x2="14" y1="8" y2="8" />
    <line x1="18" x2="22" y1="16" y2="16" />
  </svg>
);

const ClearIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const SortIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14M5 12l7-7 7 7" />
  </svg>
);

// ============================================================================
// Main Component
// ============================================================================

export const CommentsSidebarHeader: React.FC<CommentsSidebarHeaderProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync local search with filters when filters change externally
  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  // Debounced search update
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the filter update
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value });
      }, 300);
    },
    [filters, onFiltersChange],
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setLocalSearch("");
    onFiltersChange({ ...filters, search: "" });
    searchInputRef.current?.focus();
  }, [filters, onFiltersChange]);

  // Toggle sort
  const handleSortChange = useCallback(
    (sort: "date" | "unread") => {
      onFiltersChange({ ...filters, sort });
    },
    [filters, onFiltersChange],
  );

  // Toggle show resolved
  const handleShowResolvedToggle = useCallback(() => {
    onFiltersChange({ ...filters, resolved: !filters.resolved });
  }, [filters, onFiltersChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const hasActiveFilters = filters.resolved || filters.sort !== "date";

  return (
    <div className={styles.header}>
      {/* Search Input using TextField component */}
      <div className={styles.searchWrapper}>
        <TextField
          ref={searchInputRef}
          value={localSearch}
          placeholder={t("comments.searchPlaceholder")}
          icon={searchIcon}
          onChange={handleSearchChange}
          onKeyDown={(e) => e.stopPropagation()}
          fullWidth
          type="search"
        />
        {localSearch && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClearSearch}
            title={t("buttons.clear")}
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {/* Filter Dropdown */}
      <div className={styles.filterContainer} ref={dropdownRef}>
        <button
          type="button"
          className={`${styles.filterButton} ${
            hasActiveFilters ? styles.filterButtonActive : ""
          }`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          title={t("comments.filterComments")}
        >
          <FilterIcon />
        </button>

        {isDropdownOpen && (
          <div className={styles.dropdown}>
            {/* Sort Options */}
            <div className={styles.dropdownSection}>
              <div className={styles.dropdownLabel}>
                {t("comments.sortLabel")}
              </div>
              <button
                type="button"
                className={`${styles.sortItem} ${
                  filters.sort === "date" ? styles.sortItemActive : ""
                }`}
                onClick={() => handleSortChange("date")}
              >
                <SortIcon />
                <span>{t("comments.sortByDate")}</span>
              </button>
              <button
                type="button"
                className={`${styles.sortItem} ${
                  filters.sort === "unread" ? styles.sortItemActive : ""
                }`}
                onClick={() => handleSortChange("unread")}
                disabled
                title="Coming soon"
              >
                <SortIcon />
                <span>{t("comments.sortByUnread")}</span>
              </button>
            </div>

            {/* Resolved Filter */}
            <div className={styles.dropdownDivider} />
            <div className={styles.dropdownSection}>
              <button
                type="button"
                className={styles.toggleItem}
                onClick={handleShowResolvedToggle}
              >
                <span>{t("comments.showResolved")}</span>
                <div
                  className={`${styles.toggle} ${
                    filters.resolved ? styles.toggleActive : ""
                  }`}
                >
                  <div className={styles.toggleThumb} />
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
