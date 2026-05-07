"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface TabsContextValue {
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  registerTab: () => number;
  registerPanel: () => number;
  tabRefs: React.RefObject<(HTMLElement | null)[]>;
  uid: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsCtx() {
  const ctx = useContext(TabsContext);
  if (!ctx)
    throw new Error("Tabs compound components must be used inside <Tabs>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */

interface TabsProps {
  defaultIndex?: number;
  selectedIndex?: number;
  onChange?: (index: number) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultIndex = 0,
  selectedIndex,
  onChange,
  children,
  className = "",
}: TabsProps) {
  const isControlled = selectedIndex !== undefined;
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const activeIndex = isControlled ? selectedIndex : internalIndex;

  // Separate counters for tabs and panels so indices stay aligned
  const tabCounter = useRef(0);
  const panelCounter = useRef(0);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);
  const uid = useId();

  // Reset counters on each render so registration is deterministic
  tabCounter.current = 0;
  panelCounter.current = 0;

  const registerTab = useCallback(() => {
    const idx = tabCounter.current;
    tabCounter.current += 1;
    return idx;
  }, []);

  const registerPanel = useCallback(() => {
    const idx = panelCounter.current;
    panelCounter.current += 1;
    return idx;
  }, []);

  const setActiveIndex = useCallback(
    (i: number) => {
      if (!isControlled) setInternalIndex(i);
      onChange?.(i);
    },
    [isControlled, onChange],
  );

  return (
    <TabsContext.Provider
      value={{
        activeIndex,
        setActiveIndex,
        registerTab,
        registerPanel,
        tabRefs,
        uid,
      }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  TabList                                                           */
/* ------------------------------------------------------------------ */

interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className = "" }: TabListProps) {
  const { activeIndex, setActiveIndex, tabRefs } = useTabsCtx();

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = tabRefs.current.filter(Boolean) as HTMLElement[];
    if (!tabs.length) return;

    let next = activeIndex;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        next = (activeIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        next = (activeIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        e.preventDefault();
        next = 0;
        break;
      case "End":
        e.preventDefault();
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    setActiveIndex(next);
    tabs[next]?.focus();
  }

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className={`relative flex gap-1 border-b border-[var(--border-color)] ${className}`}
    >
      {children}
      <Indicator />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated underline indicator                                      */
/* ------------------------------------------------------------------ */

function Indicator() {
  const { activeIndex, tabRefs } = useTabsCtx();
  const [style, setStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[activeIndex];
    if (!el) return;

    const parent = el.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const tabRect = el.getBoundingClientRect();

    setStyle({
      left: tabRect.left - parentRect.left,
      width: tabRect.width,
    });
  }, [activeIndex, tabRefs]);

  return (
    <motion.div
      className="absolute bottom-0 h-0.5 bg-[var(--accent-blue)]"
      initial={false}
      animate={{ left: style.left, width: style.width }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Tab                                                               */
/* ------------------------------------------------------------------ */

interface TabProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Tab({ children, className = "", disabled = false }: TabProps) {
  const { activeIndex, setActiveIndex, registerTab, tabRefs, uid } =
    useTabsCtx();
  const index = registerTab();
  const isActive = activeIndex === index;
  const ref = useRef<HTMLButtonElement>(null);

  // Store ref for keyboard navigation
  useEffect(() => {
    tabRefs.current[index] = ref.current;
  }, [index, tabRefs]);

  return (
    <button
      ref={ref}
      role="tab"
      id={`tab-${uid}-${index}`}
      aria-selected={isActive}
      aria-controls={`tabpanel-${uid}-${index}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => !disabled && setActiveIndex(index)}
      className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] ${
        disabled
          ? "cursor-not-allowed text-[var(--text-muted)] opacity-50"
          : isActive
            ? "text-[var(--accent-blue)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  TabPanels container (optional wrapper)                            */
/* ------------------------------------------------------------------ */

interface TabPanelsProps {
  children: ReactNode;
  className?: string;
}

export function TabPanels({ children, className = "" }: TabPanelsProps) {
  return <div className={className}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/*  TabPanel                                                          */
/* ------------------------------------------------------------------ */

interface TabPanelProps {
  children: ReactNode;
  className?: string;
}

export function TabPanel({ children, className = "" }: TabPanelProps) {
  const { activeIndex, registerPanel, uid } = useTabsCtx();
  const index = registerPanel();
  const isActive = activeIndex === index;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${uid}-${index}`}
      aria-labelledby={`tab-${uid}-${index}`}
      hidden={!isActive}
      tabIndex={0}
      className={`outline-none ${isActive ? "" : "hidden"} ${className}`}
    >
      {children}
    </div>
  );
}
