'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from './ui/Button';
import Field from './ui/Field';
import Notice from './ui/Notice';
import { Spinner } from './ui/LoadingSpinner';
import { LockIcon } from './ui/Icons';

export default function LoginForm({ configured }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Sign in failed.');
        setSubmitting(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {!configured && (
        <Notice tone="warning" title="Login is not configured yet">
          Set <code className="text-champagne">PORTAL_EMAIL</code>,{' '}
          <code className="text-champagne">PORTAL_PASSWORD</code> and{' '}
          <code className="text-champagne">PORTAL_SESSION_SECRET</code> in the environment, then reload.
        </Notice>
      )}

      <Field
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="username"
        placeholder="you@corebytemediallc.com"
        required
        autoFocus
      />
      <Field
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        placeholder="••••••••••"
        required
      />

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" disabled={submitting || !configured}>
        {submitting ? <Spinner size={18} /> : <LockIcon size={16} />}
        {submitting ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
