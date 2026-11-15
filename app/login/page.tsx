'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/shadcn/card';
import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';

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
    <main className="min-h-screen w-full bg-[#FAF6F1] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5DFCE] border border-[#EACBB4] text-[#8D451E] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            ZCodeDev Social Planner Pro
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1E1B18]">
            Your social media, <span className="text-[#C27345] italic font-serif">Finally Organized.</span>
          </h1>
          <p className="text-sm text-[#6E655D]">
            Sign in with your admin password to access your studio.
          </p>
        </div>

        <Card className="border-[#E7DFD5] bg-white shadow-[0_12px_36px_rgba(30,27,24,0.08)]">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-[#1E1B18] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#C27345]" />
                Admin Sign In
              </CardTitle>
              <Badge variant="sage" className="gap-1">
                <ShieldCheck className="w-3 h-3" />
                Protected
              </Badge>
            </div>
            <CardDescription className="text-[#6E655D]">
              Enter your workspace credentials to continue.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {authConfigured === false && (
              <div
                role="alert"
                className="rounded-xl border border-[#EACBB4] bg-[#FDF2E9] px-3.5 py-2.5 text-xs text-[#8D451E]"
              >
                <strong>Setup needed:</strong> Set <code className="font-mono font-semibold">ADMIN_PASSWORD</code> in Netlify Environment Variables (or <code className="font-mono">.env.local</code>).
              </div>
            )}

            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-[#4E463F] block">
                  Admin Email <span className="text-[#958B81]">(optional unless ADMIN_EMAIL is set)</span>
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@zcodedev.com"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-[#4E463F] block">
                  Admin Password *
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your admin password"
                    autoComplete="current-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E655D] hover:text-[#1E1B18] p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {notice && (
                <p
                  role="status"
                  className="rounded-lg border border-[#E8C5CD] bg-[#FDF2F4] px-3 py-2 text-xs text-[#8B3247] font-medium"
                >
                  {notice}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full h-10 text-sm font-semibold">
                {loading ? 'Signing in...' : 'Sign In to Studio'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
