import { api, call, type NewsOut, type NewsRegion } from '@/services/api';

export type { NewsItem, NewsOut, NewsRegion } from '@/services/api';

export const NEWS_REGION_LIST: NewsRegion[] = ['world', 'IN', 'US', 'CA'];

/**
 * The top five news stories for a region, found by the backend with an AI web search (so the app holds no search key).
 * PENDING BACKEND: GET /api/v1/news/{region} is not in docs/openapi.json yet; answered by services/mocks.
 */
export const getTopNews = (region: NewsRegion): Promise<NewsOut> =>
  call(api.GET('/api/v1/news/{region}', { params: { path: { region } } }));
