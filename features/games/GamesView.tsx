import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GAME_IDS, useBest, useG, useOpenGame, type GameId } from '@/features/games/kit';
import { LotusPulse } from '@/features/games/LotusPulse';
import { MemoryMatch } from '@/features/games/MemoryMatch';
import { PetalSequence } from '@/features/games/PetalSequence';
import { useMainPalette } from '@/features/main/palette';
import { Button, Icon, Text, useTheme } from '@/ui';

const GAMES: Record<GameId, () => React.ReactNode> = {
  lotus: LotusPulse,
  match: MemoryMatch,
  petals: PetalSequence,
};
const GLYPH: Record<GameId, string> = { lotus: '♥', match: '✿', petals: '❁' };

/** Games app: a list of games. A game opens right here, under the app's own top bar, with a button back to the list. */
export function GamesView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const G = useG();
  const best = useBest((s) => s.best);
  const game = useOpenGame((s) => s.open);
  const setGame = useOpenGame((s) => s.setOpen);
  useEffect(() => () => setGame(undefined), [setGame]);

  if (game) {
    const Game = GAMES[game];
    return (
      <View style={{ gap: theme.space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: p.ink, fontWeight: '700', fontSize: 20 }} accessibilityRole="header">
            {t(`games.${game}.name`)}
          </Text>
          <Button label={t('games.all')} variant="secondary" size="sm" onPress={() => setGame(undefined)} />
        </View>
        <Game />
      </View>
    );
  }
  return (
    <View style={{ gap: theme.space[3] }}>
      {GAME_IDS.map((id) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityLabel={t(`games.${id}.name`)}
          onPress={() => setGame(id)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 14,
            borderRadius: 22,
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.line,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: p.plumSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 34, color: p.plum, lineHeight: 44 }}>{GLYPH[id]}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: p.ink, fontWeight: '700', fontSize: 18 }}>{t(`games.${id}.name`)}</Text>
            <Text style={{ color: p.muted, fontSize: 14 }}>{t(`games.${id}.blurb`)}</Text>
            {best[id] ? (
              <Text style={{ color: G.gold, fontSize: 13 }}>{t('games.best', { count: best[id] })}</Text>
            ) : null}
          </View>
          <Icon name="chev" size={20} color={p.plum} />
        </Pressable>
      ))}
      <Text variant="caption" style={{ color: p.muted }}>
        {t('games.footer')}
      </Text>
    </View>
  );
}
