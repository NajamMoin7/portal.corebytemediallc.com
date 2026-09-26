'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { cn, formatDateTime } from '@/lib/utils';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Field from './ui/Field';
import Notice from './ui/Notice';
import Panel from './ui/Panel';
import { Spinner } from './ui/LoadingSpinner';
import { CheckCircleIcon, PlusIcon, RefreshIcon, TrashIcon, UserIcon } from './ui/Icons';

const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'superadmin', label: 'Super admin' },
];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const emptyForm = () => ({ name: '', email: '', password: '', role: 'agent', status: 'active' });

/**
 * Super admin's staff management: create agents, edit their details, switch
 * them active/inactive, and archive the ones who have left.
 *
 * Archiving is the portal's "delete": the account stops working and leaves
 * the active list, but nothing is removed from the database and the orders
 * that person took stay in the history and the totals.
 */
export default function AgentsManager({ users, currentUserId }) {
  const router = useRouter();
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const active = users.filter((user) => !user.archived);
  const archived = users.filter((user) => user.archived);

  /** One place for every call: parses the reply, shows errors, refreshes. */
  async function send(url, options, { onSuccess, successMessage } = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      if (data.errors) setErrors(data.errors);
      toast({ title: data.message || 'That did not work.', variant: 'error' });
      return false;
    }

    setErrors({});
    onSuccess?.(data);
    if (successMessage) toast({ title: successMessage, variant: 'success' });
    router.refresh();
    return true;
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (busyId === 'new') return;
    setBusyId('new');
    await send(
      '/api/agents',
      { method: 'POST', body: JSON.stringify(form) },
      {
        successMessage: `${form.name || 'Agent'} can now sign in.`,
        onSuccess: () => {
          setForm(emptyForm());
          setCreating(false);
        },
      },
    );
    setBusyId(null);
  }

  function startEdit(user) {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, password: '', role: user.role, status: user.status });
    setErrors({});
    setConfirmArchiveId(null);
  }

  async function handleUpdate(event, user) {
    event.preventDefault();
    if (busyId === user.id) return;
    setBusyId(user.id);

    // Only send the password when one was typed, so blank means "unchanged".
    const patch = { name: editForm.name, email: editForm.email, role: editForm.role, status: editForm.status };
    if (editForm.password) patch.password = editForm.password;

    await send(
      `/api/agents/${user.id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      { successMessage: `${editForm.name} updated.`, onSuccess: () => setEditingId(null) },
    );
    setBusyId(null);
  }

  async function toggleStatus(user) {
    setBusyId(user.id);
    const next = user.status === 'active' ? 'inactive' : 'active';
    await send(
      `/api/agents/${user.id}`,
      { method: 'PATCH', body: JSON.stringify({ status: next }) },
      { successMessage: `${user.name} is now ${next}.` },
    );
    setBusyId(null);
  }

  async function archive(user) {
    setBusyId(user.id);
    await send(
      `/api/agents/${user.id}`,
      { method: 'DELETE' },
      { successMessage: `${user.name} archived. Their orders are unchanged.`, onSuccess: () => setConfirmArchiveId(null) },
    );
    setBusyId(null);
  }

  async function restore(user) {
    setBusyId(user.id);
    await send(
      `/api/agents/${user.id}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'restore' }) },
      { successMessage: `${user.name} restored as inactive. Switch them active to let them sign in.` },
    );
    setBusyId(null);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {active.length} active {active.length === 1 ? 'account' : 'accounts'}
          {archived.length > 0 && ` · ${archived.length} archived`}
        </p>
        <Button
          type="button"
          variant={creating ? 'ghost' : 'primary'}
          size="sm"
          onClick={() => {
            setCreating((open) => !open);
            setErrors({});
          }}
        >
          {creating ? 'Cancel' : <><PlusIcon size={14} /> New agent</>}
        </Button>
      </div>

      {creating && (
        <Panel>
          <form onSubmit={handleCreate} noValidate className="space-y-5">
            <h2 className="font-display text-lg text-cream">Create an agent</h2>
            <p className="text-sm text-muted">
              They sign in with this email and password. Give them the password directly — it cannot be read
              back later, only replaced.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="new-name"
                label="Full Name"
                value={form.name}
                error={errors.name}
                onChange={(value) => setForm((f) => ({ ...f, name: value }))}
                placeholder="Haziq Ahmed"
                required
              />
              <Field
                id="new-email"
                label="Email Address"
                type="email"
                value={form.email}
                error={errors.email}
                onChange={(value) => setForm((f) => ({ ...f, email: value }))}
                autoComplete="off"
                placeholder="haziq@corebytemediallc.com"
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                id="new-password"
                label="Password"
                type="text"
                value={form.password}
                error={errors.password}
                onChange={(value) => setForm((f) => ({ ...f, password: value }))}
                autoComplete="new-password"
                hint="At least 8 characters."
                required
              />
              <Field
                id="new-role"
                label="Role"
                as="select"
                options={ROLE_OPTIONS}
                value={form.role}
                error={errors.role}
                onChange={(value) => setForm((f) => ({ ...f, role: value }))}
              />
              <Field
                id="new-status"
                label="Status"
                as="select"
                options={STATUS_OPTIONS}
                value={form.status}
                error={errors.status}
                onChange={(value) => setForm((f) => ({ ...f, status: value }))}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busyId === 'new'}>
                {busyId === 'new' ? <Spinner size={16} /> : <PlusIcon size={14} />}
                Create agent
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <ul className="space-y-3">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const editing = editingId === user.id;
          const busy = busyId === user.id;

          return (
            <li key={user.id} className={cn('surface-card overflow-hidden', user.archived && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                    user.status === 'active' && !user.archived
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : 'border-line text-faint',
                  )}
                >
                  <UserIcon size={18} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-cream">{user.name}</span>
                    {user.role === 'superadmin' && <Badge tone="gold">Super admin</Badge>}
                    <Badge tone={user.status === 'active' && !user.archived ? 'outline' : 'muted'}>
                      {user.archived ? 'Archived' : user.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                    {isSelf && <span className="text-xs text-faint">(you)</span>}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {user.email}
                    {user.lastLoginAt ? ` · last signed in ${formatDateTime(user.lastLoginAt)}` : ' · never signed in'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {user.archived ? (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => restore(user)}>
                      {busy ? <Spinner size={14} /> : <RefreshIcon size={14} />}
                      Restore
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="dark"
                        size="sm"
                        disabled={busy || isSelf}
                        title={isSelf ? 'You cannot deactivate your own account.' : undefined}
                        onClick={() => toggleStatus(user)}
                      >
                        {busy ? <Spinner size={14} /> : <CheckCircleIcon size={14} />}
                        {user.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => (editing ? setEditingId(null) : startEdit(user))}>
                        {editing ? 'Close' : 'Edit'}
                      </Button>
                      {!isSelf && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirmArchiveId(confirmArchiveId === user.id ? null : user.id)}
                        >
                          <TrashIcon size={14} />
                          Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {confirmArchiveId === user.id && (
                <div className="border-t border-line/60 bg-red-500/[0.04] px-5 py-4">
                  <Notice tone="warning" title={`Archive ${user.name}?`}>
                    They will no longer be able to sign in. <strong>Nothing is deleted</strong> — their account
                    and every order they took stay in the database, and you can restore them at any time.
                  </Notice>
                  <div className="mt-4 flex justify-end gap-3">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmArchiveId(null)}>
                      Cancel
                    </Button>
                    <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => archive(user)}>
                      {busy ? <Spinner size={14} /> : <TrashIcon size={14} />}
                      Archive account
                    </Button>
                  </div>
                </div>
              )}

              {editing && (
                <form onSubmit={(event) => handleUpdate(event, user)} noValidate className="space-y-5 border-t border-line/60 px-5 py-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      id={`edit-name-${user.id}`}
                      label="Full Name"
                      value={editForm.name}
                      error={errors.name}
                      onChange={(value) => setEditForm((f) => ({ ...f, name: value }))}
                      required
                    />
                    <Field
                      id={`edit-email-${user.id}`}
                      label="Email Address"
                      type="email"
                      value={editForm.email}
                      error={errors.email}
                      onChange={(value) => setEditForm((f) => ({ ...f, email: value }))}
                      required
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field
                      id={`edit-password-${user.id}`}
                      label="New Password"
                      type="text"
                      value={editForm.password}
                      error={errors.password}
                      onChange={(value) => setEditForm((f) => ({ ...f, password: value }))}
                      autoComplete="new-password"
                      placeholder="Leave blank to keep"
                      hint="Only set this to reset their password."
                    />
                    <Field
                      id={`edit-role-${user.id}`}
                      label="Role"
                      as="select"
                      options={ROLE_OPTIONS}
                      value={editForm.role}
                      error={errors.role}
                      onChange={(value) => setEditForm((f) => ({ ...f, role: value }))}
                      disabled={isSelf}
                      hint={isSelf ? 'You cannot change your own role.' : undefined}
                    />
                    <Field
                      id={`edit-status-${user.id}`}
                      label="Status"
                      as="select"
                      options={STATUS_OPTIONS}
                      value={editForm.status}
                      error={errors.status}
                      onChange={(value) => setEditForm((f) => ({ ...f, status: value }))}
                      disabled={isSelf}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={busy}>
                      {busy ? <Spinner size={16} /> : <CheckCircleIcon size={14} />}
                      Save changes
                    </Button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
