'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  ShieldCheck,
  ExternalLink,
  Search,
  Printer,
  ChevronRight,
  ArrowLeft,
  AlertTriangle,
  Lock,
  Cpu,
  Share2,
  Sparkles,
  HelpCircle,
  Mail,
  CheckCircle,
} from 'lucide-react';

const SECTIONS = [
  {
    id: 'agreement',
    title: '1. Agreement & Acceptance of Terms',
    icon: ShieldCheck,
    summary: 'Binding legal contract between you and Metricool Smart Publisher by ZCodeDev.',
  },
  {
    id: 'service-description',
    title: '2. Description of the Service & Cloud Engine',
    icon: Share2,
    summary: 'Multi-platform social media scheduling, video autopilot, and real-time analytics.',
  },
  {
    id: 'youtube-api',
    title: '3. YouTube API Services & Google Compliance',
    icon: ExternalLink,
    summary: 'Mandatory YouTube Terms of Service, Google Privacy Policy, and token revocation.',
  },
  {
    id: 'meta-platforms',
    title: '4. Meta Platforms (Instagram Reels & Facebook Pages)',
    icon: Share2,
    summary: 'Adherence to Meta Platform Terms, Developer Policies, and account permissions.',
  },
  {
    id: 'other-platforms',
    title: '5. TikTok, X (Twitter), LinkedIn, Threads & Pinterest',
    icon: Share2,
    summary: 'Compliance with TikTok Developer API, X Developer Agreement, and supported networks.',
  },
  {
    id: 'accounts-security',
    title: '6. User Accounts, Encrypted Tokens & Vault Security',
    icon: Lock,
    summary: 'AES encrypted credential storage, local secret vaults, and zero plain-text passwords.',
  },
  {
    id: 'intellectual-property',
    title: '7. User Content & Intellectual Property Warranty',
    icon: FileText,
    summary: 'You retain 100% full ownership and copyright of your uploaded videos and media.',
  },
  {
    id: 'acceptable-use',
    title: '8. Acceptable Use Policy & Anti-Spam Enforcements',
    icon: AlertTriangle,
    summary: 'Strict prohibition of botting, spam, copyright violations, and malicious content.',
  },
  {
    id: 'ai-disclosure',
    title: '9. AI Content Studio & Synthetic Media Disclosure',
    icon: Sparkles,
    summary: 'Mandatory labeling for AI-generated video, cloned voices, and synthetic media.',
  },
  {
    id: 'cloud-hold',
    title: '10. "Cloud Server Hold" & Service Uptime Disclaimers',
    icon: Cpu,
    summary: 'Direct scheduling via native platform servers (publishAt) and third-party rate limits.',
  },
  {
    id: 'token-revocation',
    title: '11. Revocation of Access & Data Deletion Rights',
    icon: Lock,
    summary: 'Immediate 1-click channel disconnection and Google Account permission revocation.',
  },
  {
    id: 'disclaimer-liability',
    title: '12. Disclaimer of Warranties & Limitation of Liability',
    icon: ShieldCheck,
    summary: 'Service provided on an "AS IS" and "AS AVAILABLE" basis without financial liability.',
  },
  {
    id: 'modifications',
    title: '13. Modifications to Terms of Service',
    icon: FileText,
    summary: 'Periodic updates reflecting new social network API guidelines and features.',
  },
  {
    id: 'contact',
    title: '14. Contact Information & Legal Inquiries',
    icon: Mail,
    summary: 'Official support desk at ZCodeDev for compliance, audit, and legal requests.',
  },
];

export default function TermsAndConditionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('agreement');

  const filteredSections = SECTIONS.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.summary.toLowerCase().includes(searchQuery.toLowerCase())
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
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent-soft border border-accent/50/30">
                Legal Contract
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Version 2.4 — Updated November 2026
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              Terms and Conditions of Service
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/privacy"
            className="px-3 py-1.5 rounded-lg bg-studio-surface border border-studio-border text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
            <span>Privacy Policy</span>
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

      {/* Quick Summary Highlights Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#181B22] via-[#1A1D27] to-[#181B22] border border-studio-border relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <CheckCircle className="w-4 h-4 text-status-success" />
            <span>Key Legal Commitments at a Glance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
            <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
              <p className="font-bold text-slate-200">100% Content Ownership</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                You retain complete intellectual property over all your videos, clips, and captions.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
              <p className="font-bold text-slate-200">Official YouTube Terms</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Explicit adherence to YouTube TOS and Google Privacy Policy for all YouTube Shorts.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
              <p className="font-bold text-slate-200">Zero Password Storage</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Authentication strictly via OAuth 2.0 with AES-256 encrypted credential tokens.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-studio-subtle/70 border border-studio-border">
              <p className="font-bold text-slate-200">1-Click Revocation</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Disconnect any social channel instantly with permanent local token wiping.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left TOC on Desktop + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="lg:col-span-4 sticky top-4 space-y-3">
          {/* Search Terms Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search terms, clauses, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          <div className="p-3 rounded-xl bg-studio-shell border border-studio-border space-y-1 max-h-[calc(100vh-140px)] overflow-y-auto">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Clauses &amp; Table of Contents
            </p>
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isSelected = activeSection === sec.id;
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-accent/15 text-accent-soft font-bold border border-accent/50/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span className="leading-tight">{sec.title}</span>
                </a>
              );
            })}
          </div>

          {/* Quick Help Card */}
          <div className="p-3 rounded-xl bg-studio-surface border border-studio-border text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold">
              <HelpCircle className="w-3.5 h-3.5 text-status-success" />
              <span>Questions or Legal Inquiries?</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              If you have any questions regarding these terms, our API policies, or developer audits, please contact us at:
            </p>
            <a
              href="mailto:support@zcodedev.com"
              className="text-accent-soft hover:underline font-mono text-[11px] block"
            >
              support@zcodedev.com
            </a>
          </div>
        </aside>

        {/* Detailed Legal Content Clauses */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1 */}
          <section
            id="agreement"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck className="w-5 h-5 text-accent-soft" />
              <h2 className="text-base font-bold">1. Agreement &amp; Acceptance of Terms</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Welcome to <strong>Metricool Smart Publisher &amp; Autopilot Studio</strong> (the &quot;Platform&quot;, &quot;Service&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), operated and maintained by <strong>ZCodeDev</strong>.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              By accessing, browsing, registering, connecting any social media account, or using any feature of this Platform (including but not limited to our multi-platform post composer, analytics dashboard, visual planning calendar, and cloud scheduling autopilot), you acknowledge that you have read, understood, and agree to be legally bound by these Terms and Conditions of Service (&quot;Terms&quot;) and our <Link href="/privacy" className="text-accent-soft hover:underline">Privacy Policy</Link>.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              If you do not agree to these Terms in their entirety, you must not access or use the Platform, and you must immediately disconnect any integrated social media channels.
            </p>
          </section>

          {/* Section 2 */}
          <section
            id="service-description"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Share2 className="w-5 h-5 text-status-success" />
              <h2 className="text-base font-bold">2. Description of the Service &amp; Cloud Engine</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              The Platform provides an autonomous, multi-platform social media distribution, analytics aggregation, and video scheduling workspace. Core capabilities include:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>
                <strong>Multi-Channel Video Composer:</strong> Direct upload and tailoring of vertical (9:16) and horizontal video content, custom titles, per-network captions, hashtags, and privacy tags across 8 supported social networks.
              </li>
              <li>
                <strong>&quot;Cloud Server Hold&quot; Scheduler:</strong> Native scheduling via platform API primitives (e.g. YouTube <code className="text-accent-soft">publishAt</code> and Meta <code className="text-status-success">scheduled_publish_time</code>), allowing videos to publish autonomously even when your personal computer is turned off.
              </li>
              <li>
                <strong>Evolution &amp; Performance Analytics:</strong> Retrieval and visualization of public video reach, views, likes, shares, comments, and engagement metrics via official platform APIs.
              </li>
              <li>
                <strong>AI Content Studio:</strong> Automated generation of SEO titles, caption copywriting, hashtag discovery, and platform-compliant synthetic media tagging.
              </li>
            </ul>
          </section>

          {/* Section 3: YouTube API Services Compliance (CRITICAL FOR GOOGLE OAUTH AUDIT) */}
          <section
            id="youtube-api"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-accent/50/30 relative overflow-hidden space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <ExternalLink className="w-5 h-5 text-accent-soft" />
              <h2 className="text-base font-bold">3. YouTube API Services &amp; Google Compliance</h2>
            </div>

            <div className="p-3.5 rounded-lg bg-accent/10 border border-accent/50/20 text-xs text-slate-200 space-y-2">
              <p className="font-semibold text-white">
                Mandatory Google API Services Terms &amp; YouTube User Agreement:
              </p>
              <p className="leading-relaxed">
                Metricool Smart Publisher uses the official <strong>YouTube Data API v3</strong> to upload videos, schedule YouTube Shorts, retrieve channel metrics, and display video analytics.
              </p>
              <p className="leading-relaxed">
                By connecting your YouTube account to this Platform and utilizing any YouTube-related features, you explicitly agree to be bound by the{' '}
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-soft font-bold underline inline-flex items-center gap-1"
                >
                  YouTube Terms of Service
                  <ExternalLink className="w-3 h-3 inline" />
                </a>.
              </p>
              <p className="leading-relaxed">
                You also acknowledge and agree that your data is processed in accordance with the{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-soft font-bold underline inline-flex items-center gap-1"
                >
                  Google Privacy Policy
                  <ExternalLink className="w-3 h-3 inline" />
                </a>.
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong>Right to Revoke Google &amp; YouTube Access:</strong> You can revoke this Platform&apos;s access to your YouTube and Google account data at any time via the official{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-status-success font-bold underline"
              >
                Google Security Settings Permissions Page
              </a>{' '}
              or by clicking &quot;Disconnect&quot; on the <Link href="/connections" className="text-accent-soft hover:underline font-semibold">Connections</Link> page of this Platform. Upon disconnection, all stored OAuth refresh tokens for your channel are immediately deleted from the local database.
            </p>
          </section>

          {/* Section 4: Meta Platform Policies */}
          <section
            id="meta-platforms"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Share2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold">4. Meta Platforms (Instagram Reels &amp; Facebook Pages)</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              When scheduling or publishing posts to <strong>Instagram Professional Accounts</strong> or <strong>Facebook Pages</strong>, you represent and warrant that:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>
                You comply with the{' '}
                <a
                  href="https://developers.facebook.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline font-semibold"
                >
                  Meta Platform Terms
                </a>{' '}
                and Meta Commercial Terms.
              </li>
              <li>
                You have obtained all required administrator, editor, or content creator permissions for the destination Facebook Page or Instagram Business/Creator profile.
              </li>
              <li>
                Your content conforms to the Instagram Community Guidelines and Facebook Community Standards.
              </li>
              <li>
                You acknowledge that Meta imposes strict rate limits and video encoding constraints (e.g. maximum video dimensions, codec formats, and audio sample rates) which our composer validates prior to submission.
              </li>
            </ul>
          </section>

          {/* Section 5: TikTok, X, LinkedIn, Threads, Pinterest */}
          <section
            id="other-platforms"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Share2 className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold">5. TikTok, X (Twitter), LinkedIn, Threads &amp; Pinterest</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              In addition to YouTube and Meta, the Platform supports direct integration with TikTok Commercial API, X Developer Platform, LinkedIn Member API, Meta Threads API, and Pinterest API:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>
                <strong>TikTok:</strong> You agree to TikTok&apos;s Terms of Service and Commercial API rules, including adhering to privacy settings (Public, Friends, or Only Me) and Duet/Stitch permissions configured in our Tailored Editor.
              </li>
              <li>
                <strong>X (Twitter):</strong> You agree to adhere to Twitter&apos;s Developer Agreement and Policy, including respecting character limits (280 characters) and rate limits.
              </li>
              <li>
                <strong>LinkedIn &amp; Threads:</strong> All published media, company page updates, and comments must comply with each respective provider&apos;s Professional Community Guidelines.
              </li>
            </ul>
          </section>

          {/* Section 6: User Accounts & Token Security */}
          <section
            id="accounts-security"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold">6. User Accounts, Encrypted Tokens &amp; Vault Security</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Security and data minimization are fundamental to our architecture:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>
                <strong>Zero Password Policy:</strong> We never request, capture, or store your personal social media passwords. All connections are authorized using official OAuth 2.0 authorization code flows.
              </li>
              <li>
                <strong>Encrypted Token Vault:</strong> All access tokens, refresh tokens, and channel keys are stored with industry-standard AES encryption or within protected local server-side environment vaults.
              </li>
              <li>
                <strong>User Responsibility:</strong> You are solely responsible for maintaining the confidentiality of your hosting environment, server credentials, and authorized browser sessions.
              </li>
            </ul>
          </section>

          {/* Section 7: User Content & Intellectual Property */}
          <section
            id="intellectual-property"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-status-success" />
              <h2 className="text-base font-bold">7. User Content &amp; Intellectual Property Warranty</h2>
            </div>
            <div className="p-3.5 rounded-lg bg-status-success/10 border border-status-success/40/20 text-xs text-slate-200 space-y-1.5">
              <p className="font-bold text-white">You Own 100% of Your Content:</p>
              <p className="leading-relaxed">
                Metricool Smart Publisher and ZCodeDev claim <strong>NO ownership</strong>, copyright, or intellectual property rights over any videos, audio tracks, imagery, scripts, titles, descriptions, or hashtags uploaded or processed through our Platform. Everything you create remains entirely yours.
              </p>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong>Your Warranty:</strong> You represent and warrant that you own or have obtained all necessary licenses, copyrights, releases, and permissions for all media content uploaded to the Platform. You further warrant that your content does not violate any patent, trademark, trade secret, copyright, right of privacy, or right of publicity of any third party.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong>Limited Technical License:</strong> You grant the Platform only the strictly necessary, non-exclusive, royalty-free license to temporarily store, transcode, format, and transmit your media files to the social media networks you deliberately designate.
            </p>
          </section>

          {/* Section 8: Acceptable Use */}
          <section
            id="acceptable-use"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold">8. Acceptable Use Policy &amp; Anti-Spam Enforcements</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You agree that you will NOT use the Platform to:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>Distribute unsolicited mass spam, deceptive commercial messages, or pyramid schemes.</li>
              <li>Upload malicious code, viruses, spyware, or harmful payloads.</li>
              <li>Publish hate speech, violent extremism, harassment, defamatory statements, or sexually explicit content that violates third-party community standards.</li>
              <li>Attempt to bypass API quotas, scrape proprietary user data, or conduct denial-of-service attacks against social networks.</li>
              <li>Use the Platform in any manner that could subject ZCodeDev or the Platform to liability or regulatory sanctions.</li>
            </ul>
          </section>

          {/* Section 9: AI Content Studio & Synthetic Media */}
          <section
            id="ai-disclosure"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5 text-accent-soft" />
              <h2 className="text-base font-bold">9. AI Content Studio &amp; Synthetic Media Disclosure</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Our Platform includes an integrated <strong>AI Content Studio</strong> for drafting video titles, generating caption copy, recommending trending hashtags, and selecting synthetic media flags.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong>Mandatory Disclosure Responsibility:</strong> In compliance with global regulations and social media policies (including YouTube&apos;s Altered Content disclosure and Meta&apos;s Synthetic Media guidelines), if your video contains AI-generated photorealistic people, deepfakes, synthetic voice clones, or substantially modified events, you are legally obligated to enable the <strong>&quot;Synthetic Media / AI Altered&quot;</strong> toggle in our composer before scheduling.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You acknowledge that all AI-generated suggestions are provided for inspiration, and you remain solely responsible for the final accuracy and legality of all published content.
            </p>
          </section>

          {/* Section 10: Cloud Server Hold & Uptime */}
          <section
            id="cloud-hold"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Cpu className="w-5 h-5 text-status-success" />
              <h2 className="text-base font-bold">10. &quot;Cloud Server Hold&quot; &amp; Service Uptime Disclaimers</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              When scheduling in <strong>Cloud Server Hold</strong> mode, your video file is uploaded directly to YouTube&apos;s servers (<code className="text-accent-soft">status.publishAt</code>) and Meta&apos;s servers (<code className="text-status-success">scheduled_publish_time</code>). The social networks themselves hold the video and trigger public release at the designated timestamp.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              While we design our system for high availability and failover resilience, we do not guarantee uninterrupted service. We are not liable for delayed or rejected posts resulting from third-party social media API outages, upstream server downtime, network latency, or token expiration.
            </p>
          </section>

          {/* Section 11: Revocation & Deletion */}
          <section
            id="token-revocation"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold">11. Revocation of Access &amp; Data Deletion Rights</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You retain full control over your social accounts at all times. You can disconnect any platform with a single click from the <Link href="/connections" className="text-accent-soft hover:underline">Connections</Link> dashboard.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Upon disconnection:
            </p>
            <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside pl-2">
              <li>All associated OAuth access and refresh tokens are permanently purged from the local database.</li>
              <li>Cached channel profiles and analytics data for that account are deleted.</li>
              <li>The Platform immediately ceases all automated polling and API requests to that platform on your behalf.</li>
            </ul>
          </section>

          {/* Section 12: Disclaimers & Limitation of Liability */}
          <section
            id="disclaimer-liability"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck className="w-5 h-5 text-rose-400" />
              <h2 className="text-base font-bold">12. Disclaimer of Warranties &amp; Limitation of Liability</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed uppercase font-semibold text-[11px] tracking-wide text-slate-400">
              Please read this section carefully as it limits our liability.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, IN NO EVENT SHALL ZCODEDEV, ITS DEVELOPERS, AFFILIATES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, DATA, USE, GOODWILL, OR SOCIAL MEDIA ACCOUNT SUSPENSION) ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF THE PLATFORM.
            </p>
          </section>

          {/* Section 13: Modifications */}
          <section
            id="modifications"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold">13. Modifications to Terms of Service</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We reserve the right to modify or replace these Terms at any time. When material changes are made, we will revise the &quot;Last Updated&quot; date at the top of this document. Continued use of the Platform after any revisions constitutes your acceptance of the new Terms.
            </p>
          </section>

          {/* Section 14: Contact */}
          <section
            id="contact"
            className="p-5 sm:p-6 rounded-xl bg-studio-surface border border-studio-border space-y-3 scroll-mt-6"
          >
            <div className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5 text-status-success" />
              <h2 className="text-base font-bold">14. Contact Information &amp; Legal Inquiries</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              If you have any questions, compliance requests, or legal notices concerning these Terms and Conditions, please contact our team:
            </p>
            <div className="p-3.5 rounded-lg bg-studio-subtle border border-studio-border space-y-1 text-xs text-slate-300">
              <p><strong>Entity:</strong> ZCodeDev Development &amp; Media Studio</p>
              <p><strong>Application:</strong> Metricool Smart Social Publisher &amp; Autopilot</p>
              <p>
                <strong>Legal &amp; Support Email:</strong>{' '}
                <a href="mailto:support@zcodedev.com" className="text-accent-soft underline font-mono">
                  support@zcodedev.com
                </a>
              </p>
              <p>
                <strong>Lead Developer:</strong> Zain (<a href="mailto:zain@zcodedev.com" className="text-status-success underline font-mono">zain@zcodedev.com</a>)
              </p>
            </div>
          </section>

          {/* Bottom Navigation Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-studio-border">
            <Link
              href="/"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-studio-surface border border-studio-border text-slate-200 hover:text-white text-xs font-bold text-center transition-colors"
            >
              ← Back to Analytics Dashboard
            </Link>
            <Link
              href="/privacy"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-accent hover:bg-[#E01E7B] text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Read Privacy Policy</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
