import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { NewsView } from '@/features/news/NewsView';
import { useNewsRegion } from '@/features/news/store';
import { useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useNewsRegion.setState({ region: 'world' });
  await useMockBackend();
});

describe('News', () => {
  it('shows the top five stories and switches region', async () => {
    await renderApp(<NewsView />);
    expect(await screen.findByText(/Global health body/)).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(5);
    await fireEvent.press(screen.getByRole('radio', { name: 'India' }));
    expect(await screen.findByText(/free health check-ups/)).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(useNewsRegion.getState().region).toBe('IN');
  });
});
