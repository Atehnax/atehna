'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { createArticleNoteTagId, getArticleNoteStyle, type ArticleNoteTagDefinition } from '@/shared/domain/catalog/articleNotes';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import { adminControlFocusTokenClasses, adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';

export default function ArticleNoteSettingsEditor({ tags, onChange }: {
  tags: ArticleNoteTagDefinition[];
  onChange: (tags: ArticleNoteTagDefinition[]) => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#64748b');
  const update = (id: string, updates: Partial<ArticleNoteTagDefinition>) => onChange(tags.map((tag) => tag.id === id ? { ...tag, ...updates } : tag));
  const add = () => {
    const label = newLabel.trim();
    if (!label || tags.length >= 100) return;
    onChange([...tags, { id: createArticleNoteTagId(label, tags), label, color: newColor, enabled: true }]);
    setNewLabel('');
  };
  const inputClassName = 'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 ' + adminInputFocusTokenClasses;

  return (
    <div className="grid gap-4" data-article-note-settings>
      <p className="text-xs leading-5 text-slate-500">Opombe ročno označujejo artikle in njihove različice. Sprememba zaloge ne spremeni opombe. Skrite oznake ostanejo na že označenih artiklih.</p>
      <div className="grid gap-3">
        {tags.map((tag) => (
          <div key={tag.id} className="grid items-center gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_140px_minmax(100px,0.6fr)]" data-note-tag-id={tag.id}>
            <label className="grid min-w-0 gap-1 text-[10px] font-medium text-slate-600">
              Naziv opombe
              <input aria-label={'Naziv opombe ' + tag.id} value={tag.label} maxLength={100} onChange={(event) => update(tag.id, { label: event.target.value })} className={inputClassName} />
            </label>
            <CompactHexColorField label="Barva" value={tag.color} onChange={(color) => update(tag.id, { color })} tone="light" inputAttributes={{ 'aria-label': 'Barva opombe ' + tag.id }} />
            <div className="grid justify-items-start gap-2">
              <span className="inline-flex max-w-full rounded-full border px-2.5 py-1 text-[10px] font-medium" style={getArticleNoteStyle(tag.id, tags)}>{tag.label || 'Naziv opombe'}</span>
              {tag.id !== 'na-zalogi' ? (
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <input type="checkbox" checked={tag.enabled} onChange={(event) => update(tag.id, { enabled: event.target.checked })} className="rounded border-slate-300" />
                  Prikaži v izbiri
                </label>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-lg border border-dashed border-slate-300 p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
        <label className="grid gap-1 text-[10px] font-medium text-slate-600">
          Nova opomba
          <input value={newLabel} maxLength={100} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder="Npr. Po naročilu" className={inputClassName} />
        </label>
        <CompactHexColorField label="Barva nove opombe" value={newColor} onChange={setNewColor} tone="light" />
        <button type="button" onClick={add} disabled={!newLabel.trim() || tags.length >= 100} className={'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 ' + adminControlFocusTokenClasses}><Plus className="h-3.5 w-3.5" />Dodaj opombo</button>
      </div>
    </div>
  );
}
