import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, MapPin, Utensils, Store } from "lucide-react";
import clsx from "clsx";

import {
  search,
  getSearchResultPath,
  type SearchResultItem,
  type SearchResultType,
} from "../lib/search-index";
import {
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
} from "../lib/search-history";

const DEBOUNCE_MS = 300;

const typeIcons: Record<SearchResultType, React.ReactNode> = {
  stall: <Store className="h-4 w-4" />,
  cuisine: <Utensils className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
};

const typeLabels: Record<SearchResultType, string> = {
  stall: "Stall",
  cuisine: "Cuisine",
  location: "Location",
};

interface SearchAutocompleteProps {
  /** Whether the search is expanded (visible input) */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Additional class names */
  className?: string;
}

export function SearchAutocomplete({
  expanded = false,
  onExpandedChange,
  className,
}: SearchAutocompleteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  // Focus input when expanded changes
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (expanded) {
          onExpandedChange?.(false);
          setShowHistory(false);
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded, onExpandedChange]);

  // Debounced search
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setShowHistory(searchQuery.length === 0);
      return;
    }

    setIsLoading(true);
    setShowHistory(false);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const searchResults = search(searchQuery, { limit: 8 });
      setResults(searchResults);
      setIsLoading(false);
      setSelectedIndex(-1);
    }, DEBOUNCE_MS);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    performSearch(value);
  };

  const handleSelect = (item: SearchResultItem | string) => {
    const searchQuery = typeof item === "string" ? item : item.title;
    
    // Add to history
    addToSearchHistory(searchQuery);
    setHistory(getSearchHistory());

    // Navigate
    if (typeof item === "string") {
      // It's a history item - go to search results page
      void navigate({ to: "/search", search: { q: item } });
    } else {
      // It's a search result
      const path = getSearchResultPath(item);
      void navigate({ to: path });
    }

    // Reset state
    setQuery("");
    setResults([]);
    setShowHistory(false);
    onExpandedChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = showHistory ? history : results;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          handleSelect(items[selectedIndex]);
        } else if (query.trim()) {
          handleSelect(query.trim());
        }
        break;
      case "Escape":
        e.preventDefault();
        setResults([]);
        setShowHistory(false);
        setQuery("");
        onExpandedChange?.(false);
        break;
      case "Tab":
        if (selectedIndex >= 0 && items[selectedIndex]) {
          e.preventDefault();
          handleSelect(items[selectedIndex]);
        }
        break;
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowHistory(true);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
  };

  const showDropdown = expanded && (results.length > 0 || (showHistory && history.length > 0));

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      {/* Search Icon / Toggle */}
      {!expanded ? (
        <button
          onClick={() => onExpandedChange?.(true)}
          className="flex items-center gap-2 rounded-md border border-border bg-surface-card px-3 py-1.5 text-sm text-foreground-faint transition-colors hover:border-border-hover hover:text-foreground"
          aria-label="Open search"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </button>
      ) : (
        /* Expanded Search Input */
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-card px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <Search className="h-4 w-4 text-foreground-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search stalls, cuisines, locations..."
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-faint focus:outline-none"
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            role="combobox"
          />
          {isLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          {query && !isLoading && (
            <button
              onClick={handleClear}
              className="text-foreground-faint hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-auto rounded-md border border-border bg-surface-card shadow-lg"
          role="listbox"
        >
          {showHistory ? (
            /* Search History */
            <div className="py-2">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs font-medium text-foreground-faint">
                  Recent Searches
                </span>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-primary hover:underline"
                >
                  Clear
                </button>
              </div>
              {history.map((item, index) => (
                <button
                  key={item}
                  onClick={() => handleSelect(item)}
                  className={clsx(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                    index === selectedIndex
                      ? "bg-primary-surface text-primary"
                      : "text-foreground hover:bg-surface"
                  )}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <Search className="h-4 w-4 text-foreground-faint" />
                  {item}
                </button>
              ))}
            </div>
          ) : (
            /* Search Results */
            <div className="py-2">
              {results.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={clsx(
                    "flex w-full items-center gap-3 px-3 py-2 text-left",
                    index === selectedIndex
                      ? "bg-primary-surface text-primary"
                      : "text-foreground hover:bg-surface"
                  )}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-foreground-faint">
                    {typeIcons[item.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    {item.subtitle && (
                      <div className="truncate text-xs text-foreground-faint">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-foreground-faint">
                    {typeLabels[item.type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
