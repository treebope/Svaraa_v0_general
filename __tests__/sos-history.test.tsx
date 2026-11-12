import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { SosHistory } from '@/features/pendant/SosHistory';
import { useDrillRecords } from '@/features/wearer/drillRecords';
import { renderApp } from '@/test-utils/render';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useDrillRecords.setState({
    records: [
      { id: 'd1', startedAt: new Date().toISOString(), status: 'passed', answeredBy: 'Meera', seconds: 20 },
    ],
  });
});

describe('SOS history', () => {
  it('shows resolved, false alarm and mock drill outcomes, and filters them', async () => {
    await renderApp(<SosHistory />);
    expect(screen.getByText('Resolved')).toBeTruthy();
    expect(screen.getByText('False alarm')).toBeTruthy();
    expect(screen.getByText('Mock drill · passed')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Mock drills' }));
    expect(screen.queryByText('Resolved')).toBeNull();
    expect(screen.getByText('Mock drill · passed')).toBeTruthy();
  });

  it('opens an event to show calling, acknowledged and reaching the person', async () => {
    await renderApp(<SosHistory />);
    await fireEvent.press(screen.getByRole('button', { name: /^Resolved,/ }));
    expect(screen.getByText('Meera did not answer')).toBeTruthy();
    expect(screen.getAllByText(/Ravi acknowledged/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ravi reached you · Home/)).toBeTruthy();
  });
});
