import { useEffect } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { useMainPalette } from '@/features/main/palette';
import { useNewsRegion } from '@/features/news/store';
import { getTopNews, NEWS_REGION_LIST, type NewsItem, type NewsRegion } from '@/services/news/newsApi';
import { Button, Choice, Text, useTheme } from '@/ui';

const STALE_MS = 15 * 60_000;

/** News app: the top five stories for the chosen region (worldwide, India, US or Canada), found by AI search. */
export function NewsView() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const errorText = useErrorText();
  const region = useNewsRegion((s) => s.region);
  const setRegion = useNewsRegion((s) => s.setRegion);
  useEffect(() => void useNewsRegion.getState().load(), []);

  const news = useQuery({
    queryKey: ['news', region, i18n.language],
    queryFn: () => getTopNews(region),
    staleTime: STALE_MS,
  });

  const ago = (iso: string) => {
    // Measured from when the list was made, so it needs no clock of its own.
    const made = Date.parse(news.data?.generated_at ?? iso);
    const mins = Math.max(1, Math.round((made - Date.parse(iso)) / 60_000));
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    return mins < 60 ? rtf.format(-mins, 'minute') : rtf.format(-Math.round(mins / 60), 'hour');
  };

  const open = (item: NewsItem) => void Linking.openURL(item.url).catch(() => undefined);

  return (
    <View style={{ gap: theme.space[3] }}>
      <Choice<NewsRegion>
        label={t('news.region.label')}
        value={region}
        onChange={setRegion}
        options={NEWS_REGION_LIST.map((r) => ({ id: r, label: t(`news.region.${r}`) }))}
      />

      {news.isPending ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3], padding: theme.space[3] }}
        >
          <ActivityIndicator color={p.plum} />
          <Text style={{ color: p.muted }} accessibilityLiveRegion="polite">
            {t('news.searching')}
          </Text>
        </View>
      ) : null}

      {news.isError ? (
        <View style={{ gap: theme.space[2] }}>
          <Text tone="safety" accessibilityRole="alert">
            {errorText(news.error)}
          </Text>
          <Button label={t('news.retry')} variant="secondary" onPress={() => void news.refetch()} fullWidth />
        </View>
      ) : null}

      {news.data?.items.slice(0, 5).map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="link"
          accessibilityLabel={`${item.rank}. ${item.title}. ${item.source}`}
          onPress={() => open(item)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            gap: theme.space[3],
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.line,
            borderRadius: 15,
            padding: 14,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: p.plumSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="label" style={{ color: p.plum }}>
              {item.rank}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: p.ink, fontWeight: '600' }}>{item.title}</Text>
            <Text variant="bodySm" style={{ color: p.muted }}>
              {item.summary}
            </Text>
            <Text variant="caption" style={{ color: p.gold, fontWeight: '600' }}>
              {`${item.source} · ${ago(item.published_at)}`}
            </Text>
          </View>
        </Pressable>
      ))}

      {news.data ? (
        <View style={{ gap: theme.space[2] }}>
          <Text variant="caption" style={{ color: p.muted }}>
            {t('news.footer', {
              time: new Date(news.data.generated_at).toLocaleTimeString(i18n.language, {
                hour: 'numeric',
                minute: '2-digit',
              }),
            })}
          </Text>
          <Button
            label={t('news.refresh')}
            variant="tertiary"
            onPress={() => void news.refetch()}
            loading={news.isFetching}
          />
        </View>
      ) : null}
    </View>
  );
}
