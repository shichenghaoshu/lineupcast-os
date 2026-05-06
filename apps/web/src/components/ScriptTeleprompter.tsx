"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";

interface ScriptTeleprompterProps {
  text: string;
  title?: string;
}

export function ScriptTeleprompter({ text, title }: ScriptTeleprompterProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card space-y-2"
    >
      {title && (
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{title}</div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
          >
            {copied ? (
              <Check className="h-3 w-3 text-[var(--accent-green)]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto rounded bg-[var(--bg-primary)] p-3 font-mono text-sm leading-relaxed text-[var(--text-primary)]">
        {text}
      </div>
    </motion.div>
  );
}
