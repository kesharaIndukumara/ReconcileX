import React, { useEffect, useState } from 'react';
import { useHelpMode } from '../context/HelpModeContext';

interface HelpHotspotProps {
  /** Plain-language explanation shown when the marker is clicked. */
  tip: string;
  /** Short bold heading for the popover. */
  label?: string;
  /** Where the popover opens relative to the control. Default: below, left-aligned. */
  placement?: 'bottom-left' | 'bottom-right' | 'top-left';
  className?: string;
  children: React.ReactNode;
}

const PLACEMENT: Record<NonNullable<HelpHotspotProps['placement']>, string> = {
  'bottom-left': 'left-0 top-full mt-2',
  'bottom-right': 'right-0 top-full mt-2',
  'top-left': 'left-0 bottom-full mb-2',
};

/**
 * Wraps a control so that, while guided help is on, it gets a dashed outline and a
 * small amber "?" marker; clicking the marker reveals `tip`. When help is off the
 * wrapper collapses to `display: contents`, so normal layout is untouched.
 */
export const HelpHotspot: React.FC<HelpHotspotProps> = ({
  tip,
  label,
  placement = 'bottom-left',
  className = '',
  children,
}) => {
  const { helpMode } = useHelpMode();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (!helpMode) setOpen(false); }, [helpMode]);

  if (!helpMode) return <span className="contents">{children}</span>;

  return (
    <span
      className={`relative block rounded-lg outline-dashed outline-2 outline-offset-2 transition-colors ${
        open ? 'outline-amber-500' : 'outline-amber-400/70 hover:outline-amber-500'
      } ${className}`}
    >
      {children}

      <button
        type="button"
        aria-label={label ? `What is "${label}"?` : 'Explain this control'}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="absolute -right-2.5 -top-2.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold leading-none text-white shadow ring-2 ring-white cursor-help hover:bg-amber-600 dark:ring-slate-800"
      >
        ?
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <span className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <span
            role="tooltip"
            className={`absolute z-30 block w-72 rounded-xl bg-slate-900 p-3 text-xs font-normal leading-snug text-white shadow-xl ring-1 ring-black/10 dark:bg-slate-700 ${PLACEMENT[placement]}`}
          >
            {label && <span className="mb-1 block font-semibold text-amber-300">{label}</span>}
            {tip}
          </span>
        </>
      )}
    </span>
  );
};
