import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '@/features/home/ProductCard';
import { Columns, usePageWidth } from '@/features/main/Columns';
import { pageBackground, useMainPalette } from '@/features/main/palette';
import { useWide } from '@/features/main/useWide';
import { FlowChrome } from '@/features/setup/FlowChrome';
import { Screen, useTheme } from '@/ui';

/**
 * Shared chrome for welcome-adjacent and setup screens on web: soft brand atmosphere,
 * full-bleed logo + language + display (logo sits in the top-left glow), and (on wide web)
 * the Svaraa Fold product card beside the form. Phone layout stays a single column.
 *
 * When each side is a single box, both stretch to the same width and height. If the form
 * column has more than one child (content under the card), heights stay natural.
 */
export function FlowShell({
  children,
  footer,
  aside = 'product',
  onProductPress,
}: {
  children: ReactNode;
  footer?: ReactNode;
  /** 'product' shows the Fold card on wide web; 'none' is form-only; or pass custom aside content. */
  aside?: 'product' | 'none' | ReactNode;
  onProductPress?: () => void;
}) {
  const theme = useTheme();
  const wide = useWide();
  const web = Platform.OS === 'web';
  const palette = useMainPalette();
  const pageWidth = usePageWidth();
  const insets = useSafeAreaInsets();

  const childList = Children.toArray(children);
  /** One card left + product right → equal boxes. Extra under the form → natural heights. */
  const equalBoxes = wide && aside !== 'none' && childList.length === 1;

  const side =
    aside === 'none' ? null : aside === 'product' ? (
      <ProductCard onPress={onProductPress} fill={equalBoxes} />
    ) : (
      aside
    );

  const leftInner = equalBoxes ? stretchFill(childList[0]) : children;

  const body =
    wide && side ? (
      <Columns
        equalHeight={equalBoxes}
        left={
          <View style={{ flex: equalBoxes ? 1 : undefined, width: '100%', gap: theme.space[4] }}>
            {leftInner}
          </View>
        }
        right={<View style={{ flex: equalBoxes ? 1 : undefined, width: '100%' }}>{side}</View>}
      />
    ) : (
      <View style={{ gap: theme.space[4], flexGrow: 1 }}>
        {children}
        {/* Phone / narrow web: product under the form, same order as the old Home layout. */}
        {side}
      </View>
    );

  return (
    <View
      style={[
        { flex: 1, overflow: 'hidden' },
        web ? pageBackground(palette) : { backgroundColor: theme.colors.canvas },
      ]}
    >
      {web ? <Glow /> : null}
      {/* Full-bleed navbar — not capped by page maxWidth — so the logo sits in the glow. */}
      <View
        style={{
          width: '100%',
          paddingHorizontal: theme.space[6],
          paddingTop: theme.space[4] + insets.top,
          paddingBottom: theme.space[3],
          zIndex: 20,
        }}
      >
        <FlowChrome />
      </View>
      <Screen transparent={web} maxWidth={pageWidth} footer={footer}>
        {body}
      </Screen>
    </View>
  );
}

/** Make a single Card (or similar) fill its equal-height column. */
function stretchFill(child: ReactNode): ReactNode {
  if (!isValidElement(child)) return child;
  const el = child as ReactElement<{ style?: ViewStyle | ViewStyle[] }>;
  const prev = el.props.style;
  return cloneElement(el, {
    style: [
      { flex: 1, width: '100%', alignSelf: 'stretch' } as ViewStyle,
      ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
    ],
  });
}

/** Soft brand glow (same atmosphere as the welcome page). */
function Glow() {
  const theme = useTheme();
  const light = theme.scheme === 'light';
  const blob = (extra: ViewStyle): ViewStyle => ({
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    pointerEvents: 'none',
    ...extra,
  });
  return (
    <>
      <View
        style={blob({
          top: -120,
          left: -80,
          backgroundColor: light ? 'rgba(111,29,71,0.10)' : 'rgba(226,189,114,0.10)',
        })}
      />
      <View
        style={blob({
          bottom: -160,
          right: -100,
          backgroundColor: light ? 'rgba(184,138,68,0.12)' : 'rgba(111,29,71,0.28)',
        })}
      />
    </>
  );
}
