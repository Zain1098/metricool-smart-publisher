'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/login')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.configured === 'boolean') {
          setAuthConfigured(data.configured);
        }
      })
      .catch(() => {});
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setNotice('Please enter your admin password.');
      return;
    }

    setLoading(true);
    setNotice('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNotice(data.error || 'Invalid credentials.');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setNotice('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="auth-scene">
      <div className="art art-left" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span /><span /><span />
      </div>
      <div className="art art-right" aria-hidden="true">
        <span /><span /><span />
      </div>
      <section className="auth-panel" aria-label="Sign in">
        <div className="auth-content">
          <div className="brand" aria-label="Metricool Studio">
            <span>metricool</span><i>∞</i><span>studio</span>
          </div>
          <h1>Admin Sign In</h1>
          {authConfigured === false && (
            <p className="notice" role="alert">
              Server auth is not configured yet. Set ADMIN_PASSWORD in Netlify environment variables.
            </p>
          )}
          <form onSubmit={submit} noValidate>
            <label htmlFor="email">Admin Email (optional unless ADMIN_EMAIL is set)</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
            />
            <label htmlFor="password">Admin Password *</label>
            <div className="password-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your admin password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '◉' : '◌̸'}
              </button>
            </div>
            <button className="access" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="notice" role="status">{notice}</p>
          </form>
        </div>
      </section>
    </main>
  );
}
