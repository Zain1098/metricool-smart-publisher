'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { SmartLinkProfile } from '@/lib/smartlinks-store';

export default function PublicSmartLinkPage({
  params,
}: {
  params: { slug: string };
}) {
  const [profile, setProfile] = useState<SmartLinkProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/smartlinks/click?slug=${encodeURIComponent(params.slug)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.profile) {
          setProfile(json.profile);
          // Record page view
          fetch('/api/smartlinks/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: params.slug }),
          }).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [params.slug]);

  const handleLinkClick = (linkId: string, url: string) => {
    fetch('/api/smartlinks/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: params.slug, linkId }),
      keepalive: true,
    }).catch(() => {});
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-content-muted gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold">Page Not Found</h1>
        <p className="text-sm text-content-muted mt-1">No SmartLink exists for @{params.slug}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-surface">
      <div className="w-full max-w-md space-y-6 text-center">
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-md"
          style={{ backgroundColor: profile.accentColor || '#C27345' }}
        >
          {profile.title.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-content-primary">{profile.title}</h1>
          {profile.bio && (
            <p className="text-sm text-content-muted mt-1 max-w-sm mx-auto">{profile.bio}</p>
          )}
        </div>
        <div className="space-y-3 pt-2">
          {profile.links
            .filter((l) => l.enabled)
            .map((lnk) => (
              <button
                key={lnk.id}
                type="button"
                onClick={() => handleLinkClick(lnk.id, lnk.url)}
                className="w-full py-3.5 px-5 rounded-xl font-semibold text-sm text-white shadow-sm hover:opacity-90 transition flex items-center justify-between"
                style={{ backgroundColor: profile.accentColor || '#C27345' }}
              >
                <span>{lnk.label}</span>
                <ExternalLink className="w-4 h-4 opacity-80" />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
