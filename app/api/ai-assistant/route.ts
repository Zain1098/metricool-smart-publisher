import { NextResponse } from 'next/server';
import { SocialPlatform } from '@/lib/types';

export const dynamic = 'force-dynamic';

type AiTone =
  | 'viral'
  | 'coding'
  | 'educational'
  | 'hinglish'
  | 'storytelling'
  | 'professional';

type AiAction =
  | 'full_pack'
  | 'improve_caption'
  | 'viral_hashtags'
  | 'youtube_seo'
  | 'first_comment';

function cleanTopicFromInput(
  prompt: string,
  fileName?: string,
  currentCaption?: string
): string {
  if (prompt && prompt.trim().length > 2) {
    return prompt.trim();
  }
  if (currentCaption && currentCaption.trim().length > 3) {
    return currentCaption
      .trim()
      .split('\n')[0]
      .replace(/#\w+/g, '')
      .trim()
      .slice(0, 90);
  }
  if (fileName && fileName.trim()) {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b(vid|video|final|short|reel|mp4|mov)\b/gi, '')
      .trim();
  }
  return 'Modern Software Engineering, AI Automation & Full-Stack Coding';
}

function extractKeywords(topic: string): string[] {
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'how',
    'to',
    'in',
    'on',
    'of',
    'a',
    'an',
    'is',
    'are',
    'this',
    'that',
    'ka',
    'ki',
    'ke',
    'se',
    'mein',
    'aur',
    'ko',
  ]);
  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const baseTags = [
    ...Array.from(new Set(words)),
    'zcodedev',
    'coding',
    'programming',
    'softwareengineering',
    'webdevelopment',
    'aiautomation',
    'techshorts',
    'developer',
    'learntocode',
    'python',
    'javascript',
    'fullstack',
  ];
  return Array.from(new Set(baseTags)).slice(0, 18);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      prompt?: string;
      fileName?: string;
      currentCaption?: string;
      tone?: AiTone;
      action?: AiAction;
      platforms?: SocialPlatform[];
    };

    const tone: AiTone = body.tone || 'viral';
    const action: AiAction = body.action || 'full_pack';
    const topic = cleanTopicFromInput(
      body.prompt || '',
      body.fileName,
      body.currentCaption
    );
    const keywords = extractKeywords(topic);
    const hashtags = keywords
      .slice(0, 12)
      .map((k) => `#${k.replace(/\s+/g, '')}`)
      .join(' ');

    // Tone-specific hooks & bodies
    const toneTemplates: Record<
      AiTone,
      {
        ytTitle: string;
        hook: string;
        bodyText: string;
        cta: string;
        firstComment: string;
      }
    > = {
      viral: {
        ytTitle: `${topic.slice(0, 68)} (99% Devs Miss This!) #Shorts`,
        hook: `Stop scrolling if you care about ${topic}! Most developers learn this the hard way.`,
        bodyText: `Here is the exact breakdown of ${topic} so you can build faster, cleaner, and smarter in 2026:\n\n1️⃣ Focus on real architecture & automation\n2️⃣ Avoid common bottlenecks before production\n3️⃣ Ship clean, maintainable solutions every time`,
        cta: `Save this for your next build & follow @zcodedev for daily engineering drops!`,
        firstComment: `🔥 Want the full source code / step-by-step guide for ${topic}? Drop a "CODE" in the comments and subscribe to @zcodedev!`,
      },
      coding: {
        ytTitle: `${topic.slice(0, 72)} — Clean Code Breakdown #Shorts`,
        hook: `Let's break down ${topic} in under 60 seconds with real production patterns.`,
        bodyText: `When implementing ${topic}, keep these 3 engineering rules in mind:\n• Write modular, testable logic\n• Measure performance before optimizing\n• Automate repetitive workflows`,
        cta: `Follow @zcodedev for more practical coding & AI engineering tutorials.`,
        firstComment: `💻 Which stack are you using for ${topic} right now? Let me know below!`,
      },
      educational: {
        ytTitle: `How ${topic.slice(0, 68)} Actually Works (Step-by-Step) #Shorts`,
        hook: `Ever wondered how ${topic} works behind the scenes? Here is the simplest explanation:`,
        bodyText: `In this guide, we cover the core concepts behind ${topic} step by step so you can apply it immediately in your own projects without confusion.`,
        cta: `Bookmark this post for reference & share it with a teammate!`,
        firstComment: `📌 Question on ${topic}? Ask in the replies below and I'll answer every single one!`,
      },
      hinglish: {
        ytTitle: `${topic.slice(0, 66)} — Full Practical Guide! 🔥 #Shorts`,
        hook: `Agar aap ${topic} par kaam kar rahe hain to yeh trick aapka ghanton ka time bacha sakti hai!`,
        bodyText: `Is video mein humne ${topic} ko bilkul simple aur practical tareeqe se explain kiya hai:\n✅ Fast setup aur real implementation\n✅ Zero fake theory — 100% working workflow\n✅ Pro developer tips jo har project mein kaam aayengi`,
        cta: `Video pasand aaye to save karein aur @zcodedev ko follow zaroor karein!`,
        firstComment: `🔥 Aapko ${topic} par next konsa detailed tutorial chahiye? Comment kar ke batayein!`,
      },
      storytelling: {
        ytTitle: `How I Solved ${topic.slice(0, 64)} in Production #Shorts`,
        hook: `I spent hours debugging ${topic} until I discovered this exact workflow...`,
        bodyText: `At first, ${topic} looked complicated. Once I simplified the pipeline and automated the core steps, everything clicked into place.`,
        cta: `Follow @zcodedev for real developer logs and lessons learned.`,
        firstComment: `🚀 Have you ever run into this issue with ${topic}? Share your experience below!`,
      },
      professional: {
        ytTitle: `${topic.slice(0, 72)} | Engineering Best Practices`,
        hook: `Key architectural insights on ${topic} for modern engineering teams:`,
        bodyText: `Implementing ${topic} effectively requires balancing developer velocity, reliability, and maintainability. Here is our proven workflow at ZCodeDev.`,
        cta: `Connect with @zcodedev for more software architecture & automation insights.`,
        firstComment: `What is your team's current approach to ${topic}? Would love to hear your thoughts.`,
      },
    };

    const tpl = toneTemplates[tone] || toneTemplates.viral;

    if (action === 'viral_hashtags') {
      const updatedCaption = `${(body.currentCaption || tpl.hook).trim()}\n\n${hashtags} #Shorts #Reels #ViralTech`;
      return NextResponse.json({
        success: true,
        globalCaption: updatedCaption,
        youtubeTags: keywords,
        message: 'Generated 15+ viral hashtags & YouTube SEO search tags!',
      });
    }

    if (action === 'improve_caption') {
      const improved = `${tpl.hook}\n\n${
        body.currentCaption?.trim() || tpl.bodyText
      }\n\n${tpl.cta}\n\n${hashtags}`;
      return NextResponse.json({
        success: true,
        globalCaption: improved,
        message: 'Caption rewritten with high-retention hook & CTA!',
      });
    }

    if (action === 'first_comment') {
      return NextResponse.json({
        success: true,
        firstComment: tpl.firstComment,
        message: 'Generated high-engagement Auto First Comment across platforms!',
      });
    }

    const masterCaption = `${tpl.hook}\n\n${tpl.bodyText}\n\n${tpl.cta}\n\n${hashtags}`;

    const platformPack: Record<
      SocialPlatform,
      {
        title?: string;
        caption: string;
        firstComment?: string;
        tags?: string[];
        audioName?: string;
      }
    > = {
      youtube: {
        title: tpl.ytTitle.slice(0, 100),
        caption: `${tpl.hook}\n\n${tpl.bodyText}\n\n🔔 Subscribe to ZCodeDev (@zcodedev): https://www.youtube.com/@zcodedev\n\nTopics Covered:\n- ${topic}\n- Practical Implementation & Best Practices\n\n${hashtags} #Shorts`,
        firstComment: tpl.firstComment,
        tags: keywords,
      },
      instagram: {
        caption: `${tpl.hook}\n\n${tpl.bodyText}\n\n💾 ${tpl.cta}\n.\n.\n${hashtags} #InstagramReels #CodingReels #ZCodeDev`,
        firstComment: tpl.firstComment,
        audioName: `ZCodeDev • ${topic.slice(0, 38)}`,
      },
      facebook: {
        title: `${topic.slice(0, 85)} | ZCodeDev`,
        caption: `${tpl.hook}\n\n${tpl.bodyText}\n\n👉 Follow ZCodeDev for daily tech & coding videos!\n\n${hashtags} #FacebookReels`,
        firstComment: tpl.firstComment,
      },
      tiktok: {
        caption: `${tpl.hook} ⚡ ${tpl.cta} ${ keywords.slice(0, 6).map((k) => `#${k}`).join(' ') } #fyp #codingtiktok #zcodedev`,
        firstComment: tpl.firstComment,
      },
      twitter: {
        caption: `${tpl.hook}\n\n⚡ ${topic.slice(0, 110)}\n\n${keywords
          .slice(0, 3)
          .map((k) => `#${k}`)
          .join(' ')}`.slice(0, 275),
        firstComment: tpl.firstComment,
      },
      linkedin: {
        title: `${topic.slice(0, 90)} — Practical Engineering Guide`,
        caption: `${tpl.hook}\n\n${tpl.bodyText}\n\n${tpl.cta}\n\n${keywords
          .slice(0, 6)
          .map((k) => `#${k}`)
          .join(' ')}`,
        firstComment: tpl.firstComment,
      },
      threads: {
        caption: `${tpl.hook}\n\n${tpl.cta} 🧵👇\n\n#${keywords[0] || 'coding'} #zcodedev`.slice(
          0,
          490
        ),
        firstComment: tpl.firstComment,
      },
      pinterest: {
        title: `${topic.slice(0, 90)} | ZCodeDev`,
        caption: `${tpl.hook} ${tpl.bodyText.slice(0, 260)} ${keywords
          .slice(0, 5)
          .map((k) => `#${k}`)
          .join(' ')}`.slice(0, 490),
      },
    };

    return NextResponse.json({
      success: true,
      topic,
      globalCaption: masterCaption,
      youtubeTags: keywords,
      firstComment: tpl.firstComment,
      platformPack,
      message: `AI Content Pack generated for "${topic.slice(0, 45)}" across all networks!`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI Assistant error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
