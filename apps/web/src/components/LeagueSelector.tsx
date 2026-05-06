"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import type { League } from "@/lib/types";

interface LeagueSelectorProps {
  leagues: League[];
}

export function LeagueSelector({ leagues }: LeagueSelectorProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentId = searchParams.get("league") || leagues[0]?.id;
  const current = leagues.find((l) => l.id === currentId) || leagues[0];

  function select(league: League) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("league", league.id);
    router.push(`?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
      >
        <span className="text-base">{current?.countryFlag}</span>
        <span className="flex-1 text-left truncate">{current?.shortName}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg"
            >
              {leagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => select(league)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    league.id === currentId
                      ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
                  }`}
                >
                  <span className="text-base">{league.countryFlag}</span>
                  <span className="flex-1 text-left">{league.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{league.season}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
