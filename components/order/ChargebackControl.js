'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { CHARGEBACK_PENALTY } from '@/data/site';
import { formatDateTime, formatPrice } from '@/lib/utils';
import Button from '../ui/Button';
import Notice from '../ui/Notice';
import { Spinner } from '../ui/LoadingSpinner';
import { AlertIcon, CheckCircleIcon } from '../ui/Icons';

/**
 * Records a chargeback against an order, or clears one.
 *
 * Only shown to a super admin. The penalty lands on whoever took the order —
 * the server reads that from the order itself — so there is nothing to choose
 * here beyond the reason.
 *
 * Marking asks for confirmation first: it puts a charge against a colleague's
 * record, which should not happen on a stray click.
 */
export default function ChargebackControl({ record }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const marked = record.chargeback?.status === 'charged_back';

  async function send(action) {
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(record.orderId)}/chargeback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        toast({ title: data.message || 'That did not work.', variant: 'error' });
        setBusy(false);
        return;
      }

      toast({ title: data.message, variant: 'success', duration: 6000 });
      setOpen(false);
      setReason('');
      router.refresh();
    } catch {
      toast({ title: 'Could not reach the server.', variant: 'error' });
    }
    setBusy(false);
  }

  if (marked) {
    const { markedAt, markedBy, reason: why, penalty } = record.chargeback;
    return (
      <div className="space-y-3">
        <Notice tone="error" title={`Charged back — ${formatPrice(penalty || 0)} penalty`}>
          Recorded against <strong>{record.agent || 'the agent'}</strong>
          {markedAt && ` on ${formatDateTime(markedAt)}`}
          {markedBy && ` by ${markedBy}`}.
          {why && (
            <>
              <br />
              Reason: {why}
            </>
          )}
        </Notice>
        {open ? (
          <div className="space-y-3">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is it being cleared? (optional)"
              className="h-11 w-full rounded-lg border border-line bg-charcoal/60 px-4 text-sm text-cream outline-none focus:border-gold/55"
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => send('clear')}>
                {busy ? <Spinner size={14} /> : <CheckCircleIcon size={14} />}
                Clear chargeback
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Dispute won — clear it
          </Button>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        <AlertIcon size={14} />
        Mark chargeback
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/[0.05] p-4">
      <p className="text-sm text-cream">
        Record a chargeback against <strong>{record.agent || 'the agent who took this order'}</strong>?
      </p>
      <p className="text-xs leading-relaxed text-muted">
        A {formatPrice(CHARGEBACK_PENALTY)} penalty will be recorded against them and shown on their profile. The
        order itself is not changed, and you can clear this later if the dispute is won.
      </p>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (optional) — e.g. customer disputed, fraud claim"
        className="h-11 w-full rounded-lg border border-line bg-charcoal/60 px-4 text-sm text-cream outline-none focus:border-gold/55"
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => send('mark')}>
          {busy ? <Spinner size={14} /> : <AlertIcon size={14} />}
          Record {formatPrice(CHARGEBACK_PENALTY)} penalty
        </Button>
      </div>
    </div>
  );
}
