import { setAppLanguage, restoreLanguage } from '@/features/settings/language';
import i18n from '@/i18n';
import en from '@/i18n/en.json';
import hi from '@/i18n/hi.json';
import { fontFamily } from '@/ui/fonts';

const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [p + k] : keys(v as object, `${p}${k}.`)));

describe('i18n', () => {
  it('en and hi have identical keys', () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
  });
  it('switches language and remembers it', async () => {
    await setAppLanguage('hi');
    expect(i18n.t('common.continue')).toBe('आगे बढ़ें');
    await i18n.changeLanguage('en');
    await restoreLanguage();
    expect(i18n.language).toBe('hi');
    await setAppLanguage('en');
  });
  it('uses Noto Sans Devanagari for every Hindi style', () => {
    expect(fontFamily('hi', { face: 'display', weight: '400' })).toBe('NotoSansDevanagari_400Regular');
    expect(fontFamily('en', { face: 'display', weight: '400' })).toBe('Newsreader_400Regular');
    expect(fontFamily('en', { face: 'ui', weight: '600' })).toBe('Inter_600SemiBold');
  });
  it('uses a script Noto face for Tamil, Mandarin, Korean and Japanese', () => {
    expect(fontFamily('ta', { face: 'ui', weight: '500' })).toBe('NotoSansTamil_500Medium');
    expect(fontFamily('zh', { face: 'ui', weight: '400' })).toBe('NotoSansSC_400Regular');
    expect(fontFamily('ko', { face: 'ui', weight: '600' })).toBe('NotoSansKR_600SemiBold');
    expect(fontFamily('ja', { face: 'display', weight: '400' })).toBe('NotoSansJP_400Regular');
  });
});
