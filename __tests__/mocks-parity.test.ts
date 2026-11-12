import { getResponse } from 'msw';
import { createMockFetch } from '@/services/mocks/fetchMock';
import { handlers } from '@/services/mocks/handlers';
import { resetMockDb } from '@/services/mocks/db';
import { routes } from '@/services/mocks/routes';
import { env } from '@/config/env';

/** The phone (fetchMock) and web/Jest (MSW handlers) must give the same answers: both come from routes.ts. */
const unhandled = (async () => {
  throw new Error('unhandled');
}) as typeof fetch;
const phoneFetch = createMockFetch(unhandled);

const phone = { country_code: '+91', mobile_number: '9876543210' };
/** Keyed by "METHOD path". */
const bodies: Record<string, unknown[]> = {
  'POST /api/v1/auth/otp/request': [phone, { country_code: '+91', mobile_number: '12' }],
  'POST /api/v1/auth/otp/verify': [
    { ...phone, code: '0000' },
    { ...phone, code: '1234' },
  ],
  'POST /api/v1/auth/google': [{ id_token: 'abc' }, {}],
  'POST /api/v1/auth/refresh': [{ refresh_token: 'nope' }],
  'POST /api/v1/auth/mobile/request': [phone],
  'POST /api/v1/auth/mobile/verify': [{ ...phone, code: '0000' }],
  'PATCH /api/v1/users/me': [{ display_name: 'Asha' }],
};

describe('one set of mock routes', () => {
  it('has an MSW handler for every route', () => {
    expect(handlers).toHaveLength(routes.length);
  });

  describe.each(
    routes.flatMap((r) => (bodies[`${r.method} ${r.path}`] ?? [undefined]).map((body) => [r, body] as const)),
  )('%j', (route, body) => {
    it(`${route.method} ${route.path} matches on phone and MSW`, async () => {
      const init = () => ({
        method: route.method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      // Fill path parameters such as {household_id} with a sample value.
      const url = `${env.apiUrl}${route.path.replace(/\{\w+\}/g, 'sample-id')}`;
      // Each side starts from a clean backend, so state from one call cannot change the other's answer.
      resetMockDb();
      const fromPhone = await phoneFetch(url, init());
      resetMockDb();
      const fromMsw = await getResponse(handlers, new Request(url, init()));
      expect(fromMsw).toBeDefined();
      expect(fromPhone.status).toBe(fromMsw?.status);
      expect(await fromPhone.text()).toEqual(await fromMsw?.text());
    });
  });
});
