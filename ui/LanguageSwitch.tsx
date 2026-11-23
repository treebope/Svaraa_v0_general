import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '@/features/settings/language';
import { LANGUAGE_NATIVE_LABEL, LANGUAGES, type Language } from '@/i18n';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

const MENU_MIN_WIDTH = 168;

/**
 * Compact language dropdown for chrome (welcome / setup). Opens under the control, not a bottom sheet.
 * Options are always labelled in their own script.
 */
export function LanguageSwitch() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const c = theme.colors;
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const current = (LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as Language)
    : 'en';
  const currentLabel = LANGUAGE_NATIVE_LABEL[current];

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    anchor.current?.measureInWindow((x, y, width, height) => {
      setBox({ x, y, width, height });
      setOpen(true);
    });
  }

  return (
    <View ref={anchor} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${t('common.language')}: ${currentLabel}`}
        onPress={toggle}
        style={{
          minHeight: theme.minTarget - 6,
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.full,
          backgroundColor: c.sunken,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
        }}
      >
        <Text variant="label" tone="secondary">
          {currentLabel}
        </Text>
        <Text variant="caption" tone="tertiary" accessibilityElementsHidden importantForAccessibility="no">
          {open ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setOpen(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          {box ? (
            <View
              accessibilityRole="radiogroup"
              style={{
                position: 'absolute',
                top: box.y + box.height + theme.space[1],
                left: Math.max(theme.space[3], box.x + box.width - MENU_MIN_WIDTH),
                minWidth: Math.max(MENU_MIN_WIDTH, box.width),
                paddingVertical: theme.space[1],
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surfaceSolid,
                elevation: 8,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              {LANGUAGES.map((id) => {
                const on = id === current;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={LANGUAGE_NATIVE_LABEL[id]}
                    onPress={() => {
                      void setAppLanguage(id);
                      setOpen(false);
                    }}
                    style={{
                      minHeight: theme.minTarget,
                      paddingHorizontal: theme.space[3],
                      justifyContent: 'center',
                      backgroundColor: on ? c.sunken : 'transparent',
                    }}
                  >
                    <Text variant={on ? 'heading' : 'body'}>{LANGUAGE_NATIVE_LABEL[id]}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
