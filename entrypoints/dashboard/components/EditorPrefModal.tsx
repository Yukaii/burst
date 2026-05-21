import React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { fontFamilyOptions, fontSizeOptions, editorThemeOptions, editorKeymapOptions } from './constants';

export function EditorPrefModal({
  open,
  onClose,
  editorFontFamily,
  editorFontSize,
  editorTheme,
  editorKeymap,
  editorWordWrap,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  editorFontFamily: string;
  editorFontSize: number;
  editorTheme: string;
  editorKeymap: 'default' | 'vim' | 'emacs';
  editorWordWrap: boolean;
  onUpdate: (
    fontFamily: string,
    fontSize: number,
    theme: string,
    keymap: 'default' | 'vim' | 'emacs',
    wordWrap: boolean
  ) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Editor Preferences</h3>
        <div className="flex flex-col gap-4 mb-6">
          <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
            Font Family
            <Select value={editorFontFamily} onValueChange={(v) => onUpdate(v, editorFontSize, editorTheme, editorKeymap, editorWordWrap)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {fontFamilyOptions.map((o) => <SelectItem key={o.label} value={o.value}>{o.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
            Font Size
            <Select value={String(editorFontSize)} onValueChange={(v) => onUpdate(editorFontFamily, Number(v), editorTheme, editorKeymap, editorWordWrap)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {fontSizeOptions.map((s) => <SelectItem key={s} value={String(s)}>{s}px</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
            Syntax Theme
            <Select value={editorTheme} onValueChange={(v) => onUpdate(editorFontFamily, editorFontSize, v, editorKeymap, editorWordWrap)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {editorThemeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
            Keybindings
            <Select value={editorKeymap} onValueChange={(v) => onUpdate(editorFontFamily, editorFontSize, editorTheme, v as 'default' | 'vim' | 'emacs', editorWordWrap)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {editorKeymapOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <div className="flex items-center justify-between py-2 border-t border-border mt-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Word Wrapping</span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editorWordWrap}
                onChange={(e) => onUpdate(editorFontFamily, editorFontSize, editorTheme, editorKeymap, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
