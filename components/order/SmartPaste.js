'use client';

import { useMemo, useState } from 'react';
import { PASTE_FIELDS, parsePastedContact, toFormPatch } from '@/lib/smart-paste';
import { cn } from '@/lib/utils';
import Button from '../ui/Button';
import Notice from '../ui/Notice';
import { CheckCircleIcon, CloseIcon, CopyIcon } from '../ui/Icons';

const LABEL_BY_KEY = Object.fromEntries(PASTE_FIELDS.map((field) => [field.key, field.label]));

/**
 * Magic clipboard: paste a customer's details in one lump and let the form
 * fill itself.
 *
 * Deliberately a review step rather than a silent autofill. The parse is a
 * best guess over free text, and this form charges a card — so the agent sees
 * exactly which value is going into which box, can untick anything wrong, and
 * can undo the whole thing afterwards.
 *
 * `scope` is `customer` for billing or `shipping` for the delivery address.
 */
export default function SmartPaste({ scope = 'customer', onApply, disabled = false, initialText = '', autoOpen = false, onClose }) {
  const [opened, setOpen] = useState(false);
  const [text, setText] = useState(initialText);
  const [excluded, setExcluded] = useState(() => new Set());
  const [clipboardError, setClipboardError] = useState('');

  // A paste intercepted on the form arrives as props. Taking it during render
  // rather than in an effect means the panel is already filled in on the pass
  // that first shows it, with no extra render.
  const [lastInitial, setLastInitial] = useState(initialText);
  if (initialText !== lastInitial) {
    setLastInitial(initialText);
    setText(initialText);
    setExcluded(new Set());
  }

  // The parent opens the panel by handing over a caught paste; the button
  // below opens it by hand.
  const open = opened || autoOpen;

  const { fields, matched, leftovers } = useMemo(() => parsePastedContact(text), [text]);
  const chosen = matched.filter((field) => !excluded.has(field.key));

  // Order-level values belong to the billing block only.
  const applicable = chosen.filter((field) => field.scoped || scope === 'customer');

  function close() {
    setOpen(false);
    setText('');
    setExcluded(new Set());
    setClipboardError('');
    onClose?.();
  }

  async function readClipboard() {
    setClipboardError('');
    try {
      const contents = await navigator.clipboard.readText();
      if (!contents.trim()) {
        setClipboardError('The clipboard is empty.');
        return;
      }
      setText(contents);
      setExcluded(new Set());
    } catch {
      // Firefox has no readText for pages, and Chrome needs permission the
      // user may have denied — pasting into the box always works.
      setClipboardError('Your browser would not share the clipboard. Paste into the box below instead (Ctrl+V).');
    }
  }

  function apply() {
    const patch = toFormPatch(fields, { scope, keys: applicable.map((field) => field.key) });
    if (Object.keys(patch).length === 0) return;
    onApply(patch, applicable.length);
    close();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-gold/35 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-gold transition-colors',
          'hover:border-gold hover:bg-gold/10 hover:text-champagne disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <CopyIcon size={14} />
        Paste details
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gold/30 bg-gold/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-display text-base text-cream">
            Paste {scope === 'shipping' ? 'the shipping address' : "the customer's details"}
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Drop in an email, a message or a spreadsheet row — anything with the details in it. Check what was
            picked up, then fill the form.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close paste panel"
          className="shrink-0 rounded-full p-1.5 text-faint transition-colors hover:bg-white/5 hover:text-cream"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" onClick={readClipboard}>
          <CopyIcon size={14} />
          Read my clipboard
        </Button>
      </div>

      {clipboardError && (
        <p className="text-xs text-champagne" role="status">
          {clipboardError}
        </p>
      )}

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        autoFocus
        spellCheck={false}
        placeholder={
          scope === 'shipping'
            ? 'Jane Smith\n123 Main St, Apt 4\nAustin, TX 78701'
            : 'John Smith\nAcme, Inc\n123 Main St\nAustin, TX 78701\n(512) 555-0123\njohn@example.com'
        }
        className="w-full resize-y rounded-lg border border-line bg-charcoal/60 px-4 py-3 font-mono text-xs leading-relaxed text-cream outline-none transition-colors placeholder:text-faint focus:border-gold/55"
      />

      {text.trim() && matched.length === 0 && (
        <Notice tone="warning" title="Nothing recognised">
          No names, addresses or contact details were found in that text. Check it looks right, or type the
          fields in by hand.
        </Notice>
      )}

      {matched.length > 0 && (
        <div className="space-y-3">
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-faint">
            Found {matched.length} {matched.length === 1 ? 'field' : 'fields'} — untick anything you do not want
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {matched.map((field) => {
              const skipped = excluded.has(field.key);
              const notApplicable = !field.scoped && scope !== 'customer';
              return (
                <li key={field.key}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                      notApplicable
                        ? 'cursor-not-allowed border-line/50 opacity-50'
                        : skipped
                          ? 'border-line/60 bg-transparent'
                          : 'border-gold/30 bg-charcoal/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!skipped && !notApplicable}
                      disabled={notApplicable}
                      onChange={() =>
                        setExcluded((current) => {
                          const next = new Set(current);
                          if (next.has(field.key)) next.delete(field.key);
                          else next.add(field.key);
                          return next;
                        })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#c9a227]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-faint">
                        {LABEL_BY_KEY[field.key]}
                      </span>
                      <span className={cn('block break-words', skipped ? 'text-faint line-through' : 'text-cream')}>
                        {fields[field.key]}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {leftovers.length > 0 && (
            <p className="text-xs leading-relaxed text-faint">
              Not used: {leftovers.slice(0, 3).join(' · ')}
              {leftovers.length > 3 && ` · and ${leftovers.length - 3} more`}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-line/60 pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={close}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={apply} disabled={applicable.length === 0}>
          <CheckCircleIcon size={14} />
          Fill {applicable.length || ''} {applicable.length === 1 ? 'field' : 'fields'}
        </Button>
      </div>
    </div>
  );
}
