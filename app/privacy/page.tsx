'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  Database,
  ExternalLink,
  Search,
  Printer,
  ArrowLeft,
  Mail,
  CheckCircle,
  FileText,
  UserX,
} from 'lucide-react';

const PRIVACY_SECTIONS = [
  {
    id: 'overview',
    title: '1. Privacy Overview & Core Principles',
    icon: ShieldCheck,
  },
  {
    id: 'data-collected',
    title: '2. Information We Collect',
    icon: Database,
  },
  {
    id: 'google-compliance',
    title: '3. Google & YouTube API User Data Policy Compliance',
    icon: ExternalLink,
  },
  {
    id: 'meta-tiktok',
    title: '4. Meta (Facebook/Instagram), TikTok & Other Networks',
    icon: Lock,
  },
  {
    id: 'how-we-use-data',
    title: '5. How We Use Collected Information',
    icon: ShieldCheck,
  },
  {
    id: 'no-sale',
    title: '6. Zero Data Selling & Third-Party Disclosure Policy',
    icon: EyeOff,
  },
  {
    id: 'security-storage',
    title: '7. Credential Encryption, Vault Storage & Security',
    icon: Lock,
  },
  {
    id: 'data-retention',
    title: '8. Data Retention & Automatic Cleanup',
    icon: Database,
  },
  {
    id: 'user-rights',
    title: '9. Your Rights, Data Deletion & Token Revocation',
    icon: UserX,
  },
  {
    id: 'contact',
    title: '10. Privacy Officer & Support Contact',
    icon: Mail,
  },
];

export default function PrivacyPolicyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');

  const filtered = PRIVACY_SECTIONS.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-studio-border">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-studio-surface border border-studio-border text-slate-400 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success/15 text-status-success border border-status-success/40/30">
                Privacy Protection
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Effective Date: November 2026
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              Privacy Policy
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/terms"
            className="px-3 py-1.5 rounded-lg bg-studio-surface border border-studio-border text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-accent-soft" />
            <span>Terms of Service</span>
          </Link>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg bg-studio-surface border border-studio-border text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Highlights */}
      <div className="p-4 rounded-xl bg-studio-surface border border-studio-border space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <CheckCircle className="w-4 h-4 text-status-success" />
          <span>Our Privacy Pledges</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
          <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
            <p className="font-bold text-slate-200">Zero Selling of Data</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              We never sell, rent, monetize, or broker your personal data or video media to any third parties.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
            <p className="font-bold text-slate-200">AES-256 Vault Encryption</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              All social access keys and tokens are encrypted at rest using industry-grade cryptography.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
            <p className="font-bold text-slate-200">Google Limited Use</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Strict compliance with Google API Services User Data Policy, including Limited Use requirements.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
            <p className="font-bold text-slate-200">Instant Token Deletion</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              1-click Disconnect removes all stored tokens and cached channel metrics immediately.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Left TOC on Desktop + Right Detailed Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="lg:col-span-4 sticky top-4 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search privacy topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-status-success/40 transition-colors"
            />
          </div>

          <div className="p-3 rounded-xl bg-studio-shell border border-studio-border space-y-1 max-h-[calc(100vh-140px)] overflow-y-auto">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Privacy Clauses
            </p>
            {filtered.map((sec) => {
              const Icon = sec.icon;
              const isSelected = activeSection === sec.id;
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-status-success/15 text-status-success font-bold border border-status-success/40/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span className="leading-tight">{sec.title}</span>
                </a>
              );
            })}
          </div>
        </aside>

        {/* Content Clauses */}
        <div className="lg:col-span-8 space-y-6">
          {/* Clause 1 */}
          <section
            id="overview"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck className="w-5 h-5 text-status-success" />
              <h2 className="text-base font-bold">1. Privacy Overview &amp; Core Principles</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              At <strong>Metricool Smart Publisher</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), operated by <strong>ZCodeDev</strong>, we take the confidentiality and privacy of your social media profiles and content seriously.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              This Privacy Policy explains how our web application collects, uses, protects, and handles information obtained when you connect social media platforms, schedule posts, or view analytics.
            </p>
          </section>

          {/* Clause 2 */}
          <section
            id="data-collected"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Database className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold">2. Information We Collect</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We collect only the minimum data required to deliver scheduling and analytics services:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>
                <strong>OAuth Account Identifiers:</strong> Channel ID, Page ID, profile username/handle, and avatar URL obtained via OAuth scopes.
              </li>
              <li>
                <strong>OAuth Tokens:</strong> Short-lived access tokens and refresh tokens required to interact with social media APIs on your explicit instruction.
              </li>
              <li>
                <strong>User Content:</strong> Video binaries, image thumbnails, captions, titles, tags, and scheduling parameters you upload into the Composer.
              </li>
              <li>
                <strong>Performance Metrics:</strong> Public engagement metrics (views, likes, comments, impressions, and follower counts) fetched via official analytics endpoints.
              </li>
            </ul>
          </section>

          {/* Clause 3: Google & YouTube Compliance */}
          <section
            id="google-compliance"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-accent/50/30 space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <ExternalLink className="w-5 h-5 text-accent-soft" />
              <h2 className="text-base font-bold">3. Google &amp; YouTube API User Data Policy Compliance</h2>
            </div>
            <div className="p-3.5 rounded-lg bg-accent/10 border border-accent/50/20 text-xs text-slate-200 space-y-2">
              <p className="font-semibold text-white">
                Strict Google API Services User Data Policy Adherence:
              </p>
              <p className="leading-relaxed">
                Metricool Smart Publisher&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-soft font-bold underline inline-flex items-center gap-1"
                >
                  Google API Services User Data Policy
                  <ExternalLink className="w-3 h-3 inline" />
                </a>, including the <strong>Limited Use</strong> requirements.
              </p>
              <p className="leading-relaxed">
                We also remind all users that this Platform uses YouTube API Services. You can review the{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-status-success font-bold underline"
                >
                  Google Privacy Policy
                </a>{' '}
                and revoke permissions at any time via{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-status-success font-bold underline"
                >
                  Google Security Settings
                </a>.
              </p>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We do NOT use Google or YouTube user data for training generalized artificial intelligence or machine learning models. YouTube data is strictly used to display your video statistics and upload scheduled Shorts to your authorized channel.
            </p>
          </section>

          {/* Clause 4 */}
          <section
            id="meta-tiktok"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold">4. Meta (Facebook/Instagram), TikTok &amp; Other Networks</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              For Meta Platforms, TikTok, X, LinkedIn, Threads, and Pinterest:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>Data fetched via Meta Graph API is handled strictly according to Meta Data Policy and Developer Data Use Restrictions.</li>
              <li>Tokens are used solely to query pages/accounts you manage and initiate requested publishing actions.</li>
              <li>We never access private user messages, personal contacts, or private profile information unrelated to content scheduling.</li>
            </ul>
          </section>

          {/* Clause 5 */}
          <section
            id="how-we-use-data"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck className="w-5 h-5 text-status-success" />
              <h2 className="text-base font-bold">5. How We Use Collected Information</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Your information is exclusively utilized for:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>Publishing and scheduling videos to your connected social channels at specified times.</li>
              <li>Rendering performance charts, follower evolution graphs, and audience activity heatmaps.</li>
              <li>Generating AI-tailored captions and tags within the Composer.</li>
              <li>Providing email notifications regarding successful or failed scheduled posts.</li>
            </ul>
          </section>

          {/* Clause 6 */}
          <section
            id="no-sale"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <EyeOff className="w-5 h-5 text-rose-400" />
              <h2 className="text-base font-bold">6. Zero Data Selling &amp; Third-Party Disclosure Policy</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We uphold an absolute zero-data-selling guarantee:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>We do <strong>NOT</strong> sell, trade, rent, or lease your personal information, videos, or account data to third parties, advertising brokers, or data aggregators.</li>
              <li>We do <strong>NOT</strong> use your private social content for cross-site tracking or behavioral targeted advertising.</li>
              <li>We only transfer data to third parties when strictly necessary to execute your requested upload (i.e. sending your video to YouTube or Meta).</li>
            </ul>
          </section>

          {/* Clause 7 */}
          <section
            id="security-storage"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold">7. Credential Encryption, Vault Storage &amp; Security</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We employ defense-in-depth security measures to protect your access credentials:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>Access tokens and API secrets are stored using AES-256 encryption in secure server environments.</li>
              <li>All API communication takes place exclusively over encrypted Transport Layer Security (TLS/HTTPS).</li>
              <li>Temporary video files staged during uploads are stored with unique unguessable keys and wiped immediately following successful distribution.</li>
            </ul>
          </section>

          {/* Clause 8 */}
          <section
            id="data-retention"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Database className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold">8. Data Retention &amp; Automatic Cleanup</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We retain token credentials and post logs only as long as you maintain an active connection to the Platform. Staged media files uploaded to the server are deleted automatically within 24 hours of successful publishing.
            </p>
          </section>

          {/* Clause 9 */}
          <section
            id="user-rights"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <UserX className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold">9. Your Rights, Data Deletion &amp; Token Revocation</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You possess complete autonomy over your data:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>
                <strong>1-Click Account Disconnection:</strong> Navigate to <Link href="/connections" className="text-accent-soft hover:underline">Connections</Link> and click &quot;Disconnect&quot; next to any channel to purge its stored tokens instantly.
              </li>
              <li>
                <strong>Data Deletion Requests:</strong> You may request complete erasure of all your post history and analytics records by sending an email to <a href="mailto:support@zcodedev.com" className="text-status-success underline font-mono">support@zcodedev.com</a>. Requests are completed within 48 hours.
              </li>
            </ul>
          </section>

          {/* Clause 10 */}
          <section
            id="contact"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5 text-status-success" />
              <h2 className="text-base font-bold">10. Privacy Officer &amp; Support Contact</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              For any questions, privacy concerns, or data protection requests regarding this policy, contact our Data Privacy Officer:
            </p>
            <div className="p-3.5 rounded-lg bg-studio-subtle border border-studio-border space-y-1 text-xs text-slate-300">
              <p><strong>ZCodeDev Data Protection Desk</strong></p>
              <p>
                <strong>Privacy Officer Email:</strong>{' '}
                <a href="mailto:support@zcodedev.com" className="text-status-success underline font-mono">
                  support@zcodedev.com
                </a>
              </p>
              <p>
                <strong>Lead Engineer:</strong> Zain (<a href="mailto:zain@zcodedev.com" className="text-accent-soft underline font-mono">zain@zcodedev.com</a>)
              </p>
            </div>
          </section>

          {/* Bottom Navigation */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-studio-border">
            <Link
              href="/terms"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-studio-surface border border-studio-border text-slate-200 hover:text-white text-xs font-bold text-center transition-colors"
            >
              ← Review Terms of Service
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-status-success hover:bg-[#00B08E] text-[#14161D] text-xs font-black text-center transition-colors"
            >
              Return to Metricool Workspace →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
