import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { CommandIcon } from '@/src/lib/commands';
import { ChevronDown } from 'lucide-react';
import { iconOptions } from './constants';
import { getLocalIconLabel, getLocalIconUrl, getIconKey, iconsMatch } from './utils';

export function Tooltip({
  content,
  shortcut,
  align = 'center',
  children,
}: {
  content: string;
  shortcut?: string;
  align?: 'center' | 'left' | 'right';
  children: React.ReactNode;
}) {
  const alignClass =
    align === 'left'
      ? 'left-0 origin-top-left'
      : align === 'right'
      ? 'right-0 origin-top-right'
      : 'left-1/2 -translate-x-1/2 origin-top';

  return (
    <div className="relative group/tooltip inline-flex items-center">
      {children}
      <div className={`absolute hidden group-hover/tooltip:flex flex-col items-center gap-0.5 bg-zinc-950 text-zinc-100 border border-zinc-800 text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-lg z-50 whitespace-nowrap top-full mt-1.5 pointer-events-none transition-all scale-95 group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 opacity-0 duration-100 ${alignClass}`}>
        <span>{content}</span>
        {shortcut && (
          <span className="text-[9px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 mt-0.5 font-mono">
            {shortcut}
          </span>
        )}
      </div>
    </div>
  );
}

export function LocalScriptIcon({ icon }: { icon: CommandIcon }) {
  if (icon.type === 'lucide') {
    const IconComponent = (LucideIcons as any)[icon.name];
    return (
      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border shrink-0 overflow-hidden">
        {IconComponent ? <IconComponent className="w-4 h-4 text-foreground" /> : <LucideIcons.Code className="w-4 h-4 text-foreground" />}
      </span>
    );
  }

  const iconUrl = getLocalIconUrl(icon);

  return (
    <span className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border text-xs font-bold shrink-0 overflow-hidden">
      {iconUrl ? <img src={iconUrl} alt="" className="w-full h-full object-cover" /> : getLocalIconLabel(icon)}
    </span>
  );
}

export function AuditIssueDot({ status }: { status: 'pass' | 'warning' | 'fail' }) {
  if (status === 'pass') return null;
  return (
    <span
      className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card ${
        status === 'fail' ? 'bg-red-400' : 'bg-amber-400'
      }`}
      title={status === 'fail' ? 'Audit issue found' : 'Audit warning found'}
      aria-label={status === 'fail' ? 'Audit issue found' : 'Audit warning found'}
    />
  );
}

export function IconSelect({
  value,
  onChange,
  variant = 'field',
}: {
  value: CommandIcon;
  onChange: (value: CommandIcon) => void;
  variant?: 'field' | 'toolbar';
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = iconOptions.find((option) => iconsMatch(option.icon, value)) ?? iconOptions[2];
  const isToolbar = variant === 'toolbar';

  return (
    <div className={`${isToolbar ? 'shrink-0' : 'flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider'} relative`}>
      {isToolbar ? null : 'Icon'}
      <div className="relative">
        <button
          className={isToolbar
            ? 'flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm hover:bg-accent/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            : 'flex h-9 w-full items-center gap-3 rounded-md border border-input bg-background pl-3 pr-4 py-1.5 text-xs text-foreground shadow-sm hover:bg-accent/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left'}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choose script icon"
          onClick={() => setOpen((current) => !current)}
        >
          <LocalScriptIcon icon={selectedOption.icon} />
          {isToolbar ? null : (
            <>
              <span className="min-w-0 flex-1 flex flex-col justify-center">
                <strong className="text-xs font-semibold text-foreground truncate block">{selectedOption.label}</strong>
                <em className="text-[9px] text-muted-foreground truncate block not-italic font-normal mt-0.5">{selectedOption.hint}</em>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 select-none ml-1" aria-hidden="true" />
            </>
          )}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1.5 z-20 w-[220px] max-h-[300px] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" role="listbox">
              {iconOptions.map((option) => {
                const isSelected = iconsMatch(option.icon, value);
                return (
                  <button
                    className={`w-full flex items-center gap-3 p-2 rounded cursor-pointer transition-colors text-left border border-transparent hover:bg-accent/40 ${
                      isSelected ? 'bg-accent border-border' : ''
                    }`}
                    key={getIconKey(option.icon)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.icon);
                      setOpen(false);
                    }}
                  >
                    <LocalScriptIcon icon={option.icon} />
                    <span className="min-w-0 flex-1 flex flex-col justify-center">
                      <strong className="text-xs font-semibold text-foreground truncate block">{option.label}</strong>
                      <em className="text-[9px] text-muted-foreground truncate block not-italic font-normal mt-0.5">{option.hint}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
