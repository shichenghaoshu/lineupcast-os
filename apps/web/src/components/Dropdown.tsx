"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Render a submenu when the item is activated. */
  children?: DropdownItem[];
  /** Called when the item is selected. Ignored when `children` is set. */
  onClick?: () => void;
}

export interface DropdownProps {
  /** The element that toggles the dropdown. Receives `open` state and a ref for positioning. */
  trigger: ReactNode | ((props: { open: boolean }) => ReactNode);
  /** Flat or nested list of menu items. */
  items: DropdownItem[];
  /** Show a search / filter input at the top of the menu. */
  searchable?: boolean;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Horizontal alignment of the menu relative to the trigger. */
  align?: "left" | "right";
  /** Explicit width for the menu (Tailwind class, e.g. "w-56"). */
  width?: string;
  /** Called when the dropdown closes. */
  onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function filterItems(items: DropdownItem[], query: string): DropdownItem[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.reduce<DropdownItem[]>((acc, item) => {
    const labelMatch = item.label.toLowerCase().includes(lower);
    const childrenMatch = item.children
      ? filterItems(item.children, query).length > 0
      : false;
    if (labelMatch || childrenMatch) {
      acc.push({
        ...item,
        children: item.children
          ? filterItems(item.children, query)
          : undefined,
      });
    }
    return acc;
  }, []);
}

/** Collect all visible (non-disabled, non-separator) item ids in depth-first order. */
function collectIds(items: DropdownItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.disabled) continue;
    // Skip separators (empty label + disabled)
    if (item.label === "") continue;
    ids.push(item.id);
    if (item.children) ids.push(...collectIds(item.children));
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MenuItem({
  item,
  active,
  depth = 0,
  onSelect,
  onHover,
}: {
  item: DropdownItem;
  active: boolean;
  depth?: number;
  onSelect: (item: DropdownItem) => void;
  onHover: (id: string) => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isSeparator = item.label === "" && item.disabled;

  // Render a visual separator line for divider items
  if (isSeparator) {
    return (
      <div
        role="separator"
        className="my-1 border-t border-[var(--border-color)]"
      />
    );
  }

  return (
    <div>
      <button
        role="menuitem"
        disabled={item.disabled}
        aria-disabled={item.disabled}
        aria-haspopup={hasChildren || undefined}
        data-item-id={item.id}
        onMouseEnter={() => onHover(item.id)}
        onClick={() => {
          if (item.disabled) return;
          if (!hasChildren) onSelect(item);
        }}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
          item.disabled
            ? "cursor-not-allowed text-[var(--text-muted)] opacity-50"
            : active
              ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
              : item.danger
                ? "text-[var(--accent-red)] hover:bg-red-500/10"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {item.icon && (
          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
            {item.icon}
          </span>
        )}
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.shortcut && (
          <span className="ml-2 text-[10px] text-[var(--text-muted)]">
            {item.shortcut}
          </span>
        )}
        {hasChildren && (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        )}
      </button>

      {/* Inline submenu for search results */}
      {hasChildren && active && item.children && (
        <div className="ml-2 border-l border-[var(--border-color)] pl-1">
          {item.children.map((child) => (
            <MenuItem
              key={child.id}
              item={child}
              active={false}
              depth={depth + 1}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dropdown (main export)                                             */
/* ------------------------------------------------------------------ */

export function Dropdown({
  trigger,
  items,
  searchable = false,
  searchPlaceholder = "Search...",
  align = "left",
  width = "w-56",
  onClose,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---- derived state ---- */

  const visibleItems = useMemo(
    () => (query ? filterItems(items, query) : items),
    [items, query],
  );
  const flatIds = useMemo(() => collectIds(visibleItems), [visibleItems]);

  /* ---- actions ---- */

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveId(null);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) {
        setQuery("");
        setActiveId(null);
        onClose?.();
      }
      return !prev;
    });
  }, [onClose]);

  const selectItem = useCallback(
    (item: DropdownItem) => {
      if (item.disabled) return;
      item.onClick?.();
      close();
    },
    [close],
  );

  /* ---- click outside ---- */

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  /* ---- auto-focus search ---- */

  useEffect(() => {
    if (open && searchable) {
      // Small delay so the menu has rendered.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  /* ---- keyboard navigation ---- */

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) return;

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown": {
        e.preventDefault();
        const idx = activeId ? flatIds.indexOf(activeId) : -1;
        const next = flatIds[(idx + 1) % flatIds.length];
        setActiveId(next);
        scrollIntoView(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const idx = activeId ? flatIds.indexOf(activeId) : flatIds.length;
        const prev = flatIds[(idx - 1 + flatIds.length) % flatIds.length];
        setActiveId(prev);
        scrollIntoView(prev);
        break;
      }
      case "Enter":
      case " ": {
        if (e.target === searchRef.current) break; // let space type in search
        e.preventDefault();
        if (activeId) {
          const item = findItem(items, activeId);
          if (item) selectItem(item);
        }
        break;
      }
    }
  }

  function scrollIntoView(id: string) {
    const el = menuRef.current?.querySelector(`[data-item-id="${id}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }

  function findItem(
    list: DropdownItem[],
    id: string,
  ): DropdownItem | undefined {
    for (const item of list) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItem(item.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  /* ---- render ---- */

  const isRenderProp = typeof trigger === "function";

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      {isRenderProp ? (
        <div onClick={toggle} role="button" tabIndex={0} aria-haspopup="menu" aria-expanded={open}>
          {(trigger as (p: { open: boolean }) => ReactNode)({ open })}
        </div>
      ) : (
        <div onClick={toggle} role="button" tabIndex={0} aria-haspopup="menu" aria-expanded={open}>
          {trigger}
        </div>
      )}

      {/* Menu */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden"
              onClick={close}
            />

            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className={`absolute z-50 mt-1 ${width} overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl ${
                align === "right" ? "right-0" : "left-0"
              }`}
            >
              {/* Search input */}
              {searchable && (
                <div className="border-b border-[var(--border-color)] p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setActiveId(null);
                      }}
                      placeholder={searchPlaceholder}
                      className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] py-1.5 pl-8 pr-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-blue)]"
                    />
                  </div>
                </div>
              )}

              {/* Item list */}
              <div className="max-h-64 overflow-y-auto p-1">
                {visibleItems.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                    No results
                  </div>
                ) : (
                  visibleItems.map((item) => (
                    <MenuItem
                      key={item.id}
                      item={item}
                      active={activeId === item.id}
                      onSelect={selectItem}
                      onHover={setActiveId}
                    />
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Convenience: pre-built action menu trigger                         */
/* ------------------------------------------------------------------ */

export function DropdownTrigger({
  children,
  open,
}: {
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <button
      className={`rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] ${
        open ? "bg-[var(--bg-card)] text-[var(--text-primary)]" : ""
      }`}
    >
      {children}
    </button>
  );
}
