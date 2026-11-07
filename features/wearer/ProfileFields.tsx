import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WEARER_LANGUAGES, type WearerLanguage } from '@/features/wearer/languages';
import { checkDob, formatDobInput, isoToDobInput } from '@/features/wearer/dateOfBirth';
import type { WearerProfileIn } from '@/services/household/wearerApi';
import { Checkbox, Input, MultiChoice, Text } from '@/ui';

/**
 * The wearer's basics as a form: name, date of birth (required), what Svaraa calls them, languages, health notes and
 * pacemaker. Used by C1 (About you, in setup) and by Edit profile in My Profile, so both ask the same things.
 */
export function useProfileForm(saved: WearerProfileIn | undefined, fallbackName = '') {
  const { i18n } = useTranslation();
  const [name, setName] = useState(saved?.name ?? fallbackName);
  const [dob, setDob] = useState(isoToDobInput(saved?.date_of_birth));
  const [dobTouched, setDobTouched] = useState(false);
  const [callAs, setCallAs] = useState(saved?.call_as ?? '');
  const [languages, setLanguages] = useState<WearerLanguage[]>(
    (saved?.languages as WearerLanguage[] | undefined) ?? [i18n.language === 'hi' ? 'hi' : 'en'],
  );
  const [notes, setNotes] = useState(saved?.health_notes ?? '');
  const [pacemaker, setPacemaker] = useState(saved?.pacemaker ?? false);
  const dobCheck = checkDob(dob);
  const valid = name.trim().length > 0 && languages.length > 0 && dobCheck.ok;
  /** What to save, or undefined while something required is missing. */
  const payload: WearerProfileIn | undefined = dobCheck.ok
    ? {
        name: name.trim(),
        date_of_birth: dobCheck.iso,
        call_as: callAs.trim() || null,
        languages,
        health_notes: notes.trim() || null,
        pacemaker,
      }
    : undefined;
  return {
    name,
    setName,
    dob,
    setDob,
    dobTouched,
    setDobTouched,
    callAs,
    setCallAs,
    languages,
    setLanguages,
    notes,
    setNotes,
    pacemaker,
    setPacemaker,
    dobCheck,
    valid,
    payload,
  };
}

export function ProfileFields({ form }: { form: ReturnType<typeof useProfileForm> }) {
  const { t } = useTranslation();
  const { dobCheck } = form;
  const dobError =
    dobCheck.ok || (dobCheck.reason === 'incomplete' && !form.dobTouched)
      ? undefined
      : t(`wearer.about.dobError.${dobCheck.reason}`);
  const firstName = form.name.trim().split(/\s+/)[0] ?? '';
  return (
    <>
      <Input
        label={t('wearer.about.name')}
        value={form.name}
        onChangeText={form.setName}
        autoComplete="name"
        textContentType="name"
        maxLength={100}
      />
      <Input
        label={t('wearer.about.dob')}
        hint={t('wearer.about.dobHint')}
        error={dobError}
        value={form.dob}
        onChangeText={(v) => form.setDob(formatDobInput(v))}
        onBlur={() => form.setDobTouched(true)}
        placeholder={t('wearer.about.dobPlaceholder')}
        keyboardType="number-pad"
        autoComplete="birthdate-full"
        maxLength={10}
      />
      <Input
        label={t('wearer.about.callAs')}
        hint={t('wearer.about.callAsHint')}
        value={form.callAs}
        onChangeText={form.setCallAs}
        placeholder={firstName}
        maxLength={50}
      />
      <Text variant="kicker" tone="secondary">
        {t('wearer.about.languages')}
      </Text>
      <MultiChoice
        label={t('wearer.about.languages')}
        value={form.languages}
        onChange={form.setLanguages}
        options={WEARER_LANGUAGES.map((id) => ({ id, label: t(`languages.${id}`) }))}
      />
      <Input
        label={t('wearer.about.notes')}
        value={form.notes}
        onChangeText={form.setNotes}
        multiline
        numberOfLines={3}
        maxLength={500}
      />
      <Checkbox label={t('wearer.about.pacemaker')} checked={form.pacemaker} onChange={form.setPacemaker} />
    </>
  );
}
