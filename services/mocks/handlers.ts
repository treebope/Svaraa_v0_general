import { http, HttpResponse } from 'msw';
import { env, isMocked } from '@/config/env';
import { routes } from './routes';

export { DEMO_CODE } from './routes';

const verb = {
  GET: http.get,
  POST: http.post,
  PATCH: http.patch,
  PUT: http.put,
  DELETE: http.delete,
} as const;

/** MSW handlers for web (service worker) and Jest. Built from routes.ts, minus endpoints switched to the real backend. */
export const handlers = routes
  .filter((r) => isMocked(r.method, r.path))
  .map((r) =>
    // MSW writes path parameters as :name, docs/openapi.json as {name}.
    verb[r.method](`${env.apiUrl}${r.path.replace(/\{(\w+)\}/g, ':$1')}`, async ({ request, params }) => {
      const body = r.method === 'GET' ? undefined : await request.json().catch(() => undefined);
      const out = r.respond({ body, headers: request.headers, params: params as Record<string, string> });
      if (out.body === undefined) return new HttpResponse(null, { status: out.status });
      return HttpResponse.json(out.body as Record<string, unknown>, { status: out.status });
    }),
  );
