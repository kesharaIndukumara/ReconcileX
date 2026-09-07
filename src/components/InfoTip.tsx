import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTipProps {
  /** Plain-language explanation, one or two short sentences. */
  text: string;
  className?: string;
}

/**
 * A small "?" affordance that reveals a one-line explanation on hover or focus.
 * Also exposes the text via `title`/`aria-label` for keyboard and screen-reader users.
 */
export const InfoTip: React.FC<InfoTipProps> = ({ text, className = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={text}
        title={text}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 bottom-full z-50 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg dark:bg-slate-700"
        >
          {text}
        </span>
      )}
    </span>
  );
};
