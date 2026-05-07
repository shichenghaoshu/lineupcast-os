"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Player } from "@/lib/types";

interface FormationPitchProps {
  players: Player[];
  formation?: string;
}

export function FormationPitch({ players, formation = "4-2-3-1" }: FormationPitchProps) {
  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      {/* Pitch SVG */}
      <svg
        viewBox="0 0 300 400"
        className="w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pitch background */}
        <rect x="0" y="0" width="300" height="400" rx="4" fill="#1a472a" />

        {/* Field markings */}
        <rect x="10" y="10" width="280" height="380" rx="2" fill="none" stroke="#2d6a3f" strokeWidth="2" />

        {/* Center line */}
        <line x1="10" y1="200" x2="290" y2="200" stroke="#2d6a3f" strokeWidth="1.5" />

        {/* Center circle */}
        <circle cx="150" cy="200" r="40" fill="none" stroke="#2d6a3f" strokeWidth="1.5" />
        <circle cx="150" cy="200" r="3" fill="#2d6a3f" />

        {/* Top penalty area */}
        <rect x="85" y="10" width="130" height="55" fill="none" stroke="#2d6a3f" strokeWidth="1.5" />
        <rect x="115" y="10" width="70" height="22" fill="none" stroke="#2d6a3f" strokeWidth="1.5" />

        {/* Bottom penalty area */}
        <rect x="85" y="335" width="130" height="55" fill="none" stroke="#2d6a3f" strokeWidth="1.5" />
        <rect x="115" y="368" width="70" height="22" fill="none" stroke="#2d6a3f" strokeWidth="1.5" />

        {/* Penalty arcs */}
        <path d="M 115 65 Q 150 85 185 65" fill="none" stroke="#2d6a3f" strokeWidth="1.5" />
        <path d="M 115 335 Q 150 315 185 335" fill="none" stroke="#2d6a3f" strokeWidth="1.5" />

        {/* Penalty spots */}
        <circle cx="150" cy="45" r="2" fill="#2d6a3f" />
        <circle cx="150" cy="355" r="2" fill="#2d6a3f" />

        {/* Corner arcs */}
        <path d="M 10 10 Q 20 10 20 20" fill="none" stroke="#2d6a3f" strokeWidth="1" />
        <path d="M 280 10 Q 290 10 290 20" fill="none" stroke="#2d6a3f" strokeWidth="1" />
        <path d="M 10 390 Q 10 380 20 380" fill="none" stroke="#2d6a3f" strokeWidth="1" />
        <path d="M 290 390 Q 290 380 280 380" fill="none" stroke="#2d6a3f" strokeWidth="1" />

        {/* Formation label */}
        <text x="150" y="395" textAnchor="middle" fill="#4ade80" fontSize="11" fontWeight="600">
          {formation}
        </text>
      </svg>

      {/* Player markers */}
      {players.map((player, i) => {
        const left = `${player.x}%`;
        const top = `${player.y}%`;
        return (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left, top }}
          >
            <Link href={`/players/${player.id}`}>
              <div className="group flex flex-col items-center gap-0.5">
                <div className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[var(--accent-blue)] text-xs font-bold text-white shadow-lg ring-2 ring-[var(--accent-blue)]/30 transition-transform group-hover:scale-110 group-active:scale-95">
                  {player.number}
                </div>
                <span className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 sm:group-hover:opacity-100 hidden sm:block">
                  {player.name}
                </span>
                {/* Always show name on mobile since no hover */}
                <span className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white sm:hidden">
                  {player.name}
                </span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
