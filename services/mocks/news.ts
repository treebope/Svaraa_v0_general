import type { NewsItem, NewsOut, NewsRegion } from '@/services/api/pending';

/**
 * PENDING BACKEND: sample stories so the News app has something to show. The real backend finds the top five
 * with an AI web search for the chosen region, so these headlines are made-up placeholders, not real news.
 */
const SAMPLES: Record<NewsRegion, [string, string, string][]> = {
  world: [
    [
      'Sample: Global health body publishes new guidance on healthy ageing',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Wire',
    ],
    [
      'Sample: Leaders agree a climate funding plan after long talks',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Times',
    ],
    [
      'Sample: New study links daily walking to a longer, healthier life',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Science',
    ],
    [
      'Sample: Markets steady as central banks hold interest rates',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Business',
    ],
    [
      'Sample: Space agencies confirm the date of the next crewed mission',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Daily',
    ],
  ],
  IN: [
    [
      'Sample: Government extends free health check-ups for senior citizens',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample India',
    ],
    [
      'Sample: Monsoon session of Parliament begins with a packed agenda',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Herald',
    ],
    [
      'Sample: Festival travel: railways add extra trains on busy routes',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Express',
    ],
    [
      'Sample: Cricket team names its squad for the coming series',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Sports',
    ],
    [
      'Sample: Fuel prices unchanged for another week',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Business India',
    ],
  ],
  US: [
    [
      'Sample: Congress debates a new bill on Medicare costs',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Post',
    ],
    [
      'Sample: Winter storm warnings issued across several states',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Weather',
    ],
    [
      'Sample: Job growth beats expectations for the third month',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Journal',
    ],
    [
      'Sample: Researchers report progress on a new flu vaccine',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Health',
    ],
    [
      'Sample: Championship game set for Sunday night',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Sports US',
    ],
  ],
  CA: [
    [
      'Sample: Provinces agree to share seniors care funding',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Globe',
    ],
    [
      'Sample: Cold snap hits the prairies, with shelters open',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Weather CA',
    ],
    [
      'Sample: Housing starts rise in the largest cities',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Business CA',
    ],
    [
      'Sample: Hockey season opens with a sold-out night',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Sports CA',
    ],
    [
      'Sample: New trails open in the national parks',
      'A placeholder summary. The real app shows two or three plain sentences about the story here.',
      'Sample Nature',
    ],
  ],
};

export const NEWS_REGIONS = Object.keys(SAMPLES) as NewsRegion[];

export function sampleNews(region: NewsRegion): NewsOut {
  const now = Date.now();
  const items: NewsItem[] = SAMPLES[region].map(([title, summary, source], i) => ({
    id: `${region}-${i + 1}`,
    rank: i + 1,
    title,
    summary,
    source,
    url: 'https://example.com/news',
    published_at: new Date(now - (i + 1) * 47 * 60_000).toISOString(),
  }));
  return { region, generated_at: new Date(now).toISOString(), items };
}
