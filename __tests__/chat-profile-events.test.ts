import { applyChatEvents } from '@/services/chat/applyChatEvents';
import { askSvaraa } from '@/services/chat/chatApi';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { useSettings } from '@/features/settings/store';
import { useWearer } from '@/features/wearer/store';
import { DEMO_CODE } from '@/services/mocks/routes';
import { INDIA, useMockBackend } from '@/test-utils/backend';
import { changeLanguage } from '@/i18n';

beforeEach(async () => {
  await useMockBackend();
  useSettings.setState({ scheme: 'light', language: 'en', homeBackground: 'rose' });
  await changeLanguage('en');
  useWearer.setState({
    userId: 'u1',
    profile: {
      name: 'Asha',
      call_as: 'Amma',
      date_of_birth: '1952-03-14',
      languages: ['en'],
      pacemaker: false,
    },
    contacts: [],
  });
});

describe('Chat profile / settings events', () => {
  it('applies a settings event locally', async () => {
    await applyChatEvents([
      {
        type: 'settings',
        action: 'update',
        scheme: 'dark',
        language: 'hi',
        home_background: 'sand',
        display_scale: 3,
      },
    ]);
    expect(useSettings.getState()).toMatchObject({
      scheme: 'dark',
      language: 'hi',
      homeBackground: 'sand',
      displayScale: 3,
    });
  });

  it('merges a wearer profile event into the local store', async () => {
    await applyChatEvents([
      { type: 'profile', action: 'wearer', call_as: 'Ammaji', languages: ['Tamil', 'Hindi'] },
    ]);
    expect(useWearer.getState().profile).toMatchObject({
      call_as: 'Ammaji',
      languages: ['ta', 'hi'],
    });
  });

  it('adds an emergency contact from a contacts event', async () => {
    await applyChatEvents([
      {
        type: 'contacts',
        action: 'added',
        contact: {
          name: 'Meera',
          relationship: 'Daughter',
          country_code: '+91',
          mobile_number: '9812344410',
        },
      },
    ]);
    expect(useWearer.getState().contacts).toEqual([
      { name: 'Meera', relationship: 'Daughter', countryCode: '+91', mobile: '9812344410' },
    ]);
  });

  it('mock chat: dark mode phrase returns events and updates scheme', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    const out = await askSvaraa('Switch to dark mode');
    expect(out.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'settings', scheme: 'dark' })]),
    );
    expect(useSettings.getState().scheme).toBe('dark');
  });

  it('mock chat: warm sand background', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await askSvaraa('Change home background to warm sand');
    expect(useSettings.getState().homeBackground).toBe('sand');
  });

  it('mock chat: 2x text size', async () => {
    useSettings.setState({ displayScale: 1 });
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await askSvaraa('Make text 2x bigger');
    expect(useSettings.getState().displayScale).toBe(2);
  });

  it('mock chat: Svaraa call me on the pendant', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await askSvaraa('Svaraa call me Amma on the pendant');
    expect(useWearer.getState().profile?.call_as).toBe('Amma');
  });

  it('mock chat: add emergency contact with number', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await askSvaraa('Add Meera as emergency contact +91 9812344410 daughter');
    expect(useWearer.getState().contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Meera', countryCode: '+91', mobile: '9812344410' }),
      ]),
    );
  });

  it('applies dark mode locally when the server replies with no events', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await useMockBackend((inner) => async (input, init) => {
      const req = input instanceof Request ? input : new Request(input as RequestInfo, init);
      if (req.method === 'POST' && new URL(req.url).pathname === '/api/v1/chat/') {
        const body = (await req.clone().json()) as { conversation_id?: string };
        return new Response(
          JSON.stringify({
            conversation_id: body.conversation_id ?? 'c-empty',
            session_id: body.conversation_id ?? 'c-empty',
            response: 'Bilkul, dark mode activate kar diya hai.',
            events: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return inner(input, init);
    });
    await askSvaraa('Switch to dark mode');
    expect(useSettings.getState().scheme).toBe('dark');
  });
});
