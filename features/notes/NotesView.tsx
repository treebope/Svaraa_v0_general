import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/features/auth/useErrorText';
import { InfoRow, Pill, Segmented, useMainPalette } from '@/features/main/palette';
import { BackHeader, LinkButton } from '@/features/reminders/RemindersView';
import {
  deleteNote,
  getNote,
  isProcessing,
  listNotes,
  MAX_RECORDING_SECONDS,
  NOTE_POLL_MS,
  noteContent,
  noteTitle,
  renameNote,
  retryNote,
  uploadNote,
  type Note,
  type NoteLanguage,
  type NoteListItem,
} from '@/services/notes/notesApi';
import { useNoteRecorder } from '@/services/notes/recorder';
import { Button, Checkbox, Icon, Input, Text, useTheme } from '@/ui';

type Screen = { kind: 'list' } | { kind: 'record' } | { kind: 'detail'; id: string };

/** Processing error codes the server reports on a failed note (`error.code`), each with its own text. */
const FAILURES = new Set([
  'no_speech',
  'audio_unreadable',
  'audio_too_large',
  'audio_missing',
  'transcription_failed',
  'transcription_unavailable',
  'summary_failed',
  'summary_unavailable',
  'processing_timeout',
  'internal_error',
]);

/** Notes app: record a conversation; the server writes it out and makes short notes in English and Hindi. */
export function NotesView() {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  if (screen.kind === 'record')
    return (
      <Record back={() => setScreen({ kind: 'list' })} done={(id) => setScreen({ kind: 'detail', id })} />
    );
  if (screen.kind === 'detail') return <Detail id={screen.id} back={() => setScreen({ kind: 'list' })} />;
  return (
    <List open={(id) => setScreen({ kind: 'detail', id })} record={() => setScreen({ kind: 'record' })} />
  );
}

const LIST_KEY = ['notes'] as const;

function useLanguage(): NoteLanguage {
  const { i18n } = useTranslation();
  return i18n.language === 'hi' ? 'hi' : 'en';
}

/** "4:05" or "1:02:09". */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

function useFormat() {
  const { t, i18n } = useTranslation();
  const date = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  const detail = (n: NoteListItem) =>
    [date(n.recorded_at ?? n.created_at), n.duration_seconds ? clock(n.duration_seconds) : '']
      .filter(Boolean)
      .join(' · ');
  const status = (n: NoteListItem) => t(`notes.status.${n.status}`);
  return { date, detail, status };
}

function List({ open, record }: { open: (id: string) => void; record: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const f = useFormat();
  const language = useLanguage();
  const errorText = useErrorText();
  const notes = useInfiniteQuery({
    queryKey: LIST_KEY,
    queryFn: ({ pageParam }) => listNotes(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    // While the server works on a note, ask again so its status moves on.
    refetchInterval: (q) =>
      q.state.data?.pages.some((page) => page.items.some((n) => isProcessing(n.status)))
        ? NOTE_POLL_MS
        : false,
  });
  const items = notes.data?.pages.flatMap((page) => page.items) ?? [];
  const limit = notes.data?.pages[0]?.daily_limit;
  const today = new Date().toDateString();
  const usedToday = items.filter((n) => new Date(n.created_at).toDateString() === today).length;

  const right = (n: NoteListItem) =>
    n.status === 'failed' ? (
      <Pill label={f.status(n)} tone="bad" />
    ) : isProcessing(n.status) ? (
      <Pill label={f.status(n)} tone="plum" />
    ) : undefined;

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text style={{ color: p.muted }}>{t('notes.intro')}</Text>
      <Button label={t('notes.record')} onPress={record} fullWidth />
      {limit ? (
        <Text variant="bodySm" style={{ color: p.muted }}>
          {t('notes.today', { used: usedToday, limit })}
        </Text>
      ) : null}
      {notes.isPending ? <ActivityIndicator color={p.plum} /> : null}
      {notes.isError ? (
        <View style={{ gap: theme.space[2] }}>
          <Text tone="safety" accessibilityRole="alert">
            {errorText(notes.error)}
          </Text>
          <Button
            label={t('notes.retryLoad')}
            variant="secondary"
            onPress={() => void notes.refetch()}
            fullWidth
          />
        </View>
      ) : null}
      {notes.data && !items.length ? <Text style={{ color: p.muted }}>{t('notes.empty')}</Text> : null}
      {items.map((n) => (
        <InfoRow
          key={n.id}
          title={noteTitle(n, language) ?? t('notes.untitled')}
          detail={f.detail(n)}
          right={right(n)}
          onPress={() => open(n.id)}
        />
      ))}
      {notes.hasNextPage ? (
        <Button
          label={t('notes.more')}
          variant="secondary"
          onPress={() => void notes.fetchNextPage()}
          loading={notes.isFetchingNextPage}
          fullWidth
        />
      ) : null}
      <Text variant="bodySm" style={{ color: p.muted }}>
        {t('notes.private')}
      </Text>
    </View>
  );
}

function Record({ back, done }: { back: () => void; done: (id: string) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const recorder = useNoteRecorder();
  const [agreed, setAgreed] = useState(false);
  const [title, setTitle] = useState('');
  const [denied, setDenied] = useState(false);
  const [startError, setStartError] = useState<unknown>(null);
  const upload = useMutation({
    mutationFn: uploadNote,
    onSuccess: async (note) => {
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.setQueryData(['note', note.id], note);
      done(note.id);
    },
  });

  const stopAndUpload = async () => {
    const recording = await recorder.stop();
    if (recording) upload.mutate({ ...recording, title });
  };
  // The server refuses recordings over 2 hours: stop and send at the limit.
  const stopping = useRef(false);
  useEffect(() => {
    if (recorder.recording && recorder.seconds >= MAX_RECORDING_SECONDS && !stopping.current) {
      stopping.current = true;
      void stopAndUpload();
    }
  });
  // Leaving the page while recording throws the recording away.
  const cancelRef = useRef(recorder.cancel);
  useEffect(() => {
    cancelRef.current = recorder.cancel;
  });
  useEffect(() => () => void cancelRef.current().catch(() => undefined), []);

  const start = async () => {
    setDenied(false);
    setStartError(null);
    try {
      if ((await recorder.start()) === 'denied') setDenied(true);
    } catch (e) {
      setStartError(e);
    }
  };

  if (!recorder.available)
    return (
      <View style={{ gap: theme.space[3] }}>
        <BackHeader title={t('notes.newTitle')} back={back} />
        <Text style={{ color: p.muted }}>{t('notes.cannotRecord')}</Text>
      </View>
    );

  const busy = upload.isPending;
  return (
    <View style={{ gap: theme.space[3] }}>
      <BackHeader title={t('notes.newTitle')} back={back} />
      {recorder.recording || busy ? (
        <View
          style={{
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.line,
            borderRadius: 15,
            padding: 18,
            gap: theme.space[3],
            alignItems: 'center',
          }}
        >
          <Icon name="mic" size={32} color={busy ? p.muted : p.bad} />
          <Text
            // Explicit line height: the default is shorter than a 34px number, which clipped it into the mic icon.
            style={{
              color: p.ink,
              fontSize: 34,
              lineHeight: 44,
              fontWeight: '700',
              marginTop: theme.space[1],
            }}
            accessibilityLabel={t('notes.length', { time: clock(recorder.seconds) })}
          >
            {clock(recorder.seconds)}
          </Text>
          <Text variant="bodySm" style={{ color: p.muted }} accessibilityLiveRegion="polite">
            {busy ? t('notes.uploading') : t('notes.recording')}
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ color: p.muted }}>{t('notes.recordIntro')}</Text>
          <Input
            label={t('notes.titleLabel')}
            placeholder={t('notes.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />
          <Checkbox label={t('notes.consent')} checked={agreed} onChange={setAgreed} />
        </>
      )}
      {denied ? (
        <Text tone="safety" accessibilityRole="alert">
          {t('notes.micDenied')}
        </Text>
      ) : null}
      {startError ? (
        <Text tone="safety" accessibilityRole="alert">
          {t('notes.micFailed')}
        </Text>
      ) : null}
      {upload.isError ? (
        <Text tone="safety" accessibilityRole="alert">
          {errorText(upload.error)}
        </Text>
      ) : null}
      {recorder.recording ? (
        <>
          <Button label={t('notes.stop')} onPress={() => void stopAndUpload()} fullWidth />
          <LinkButton label={t('notes.discard')} onPress={() => void recorder.cancel().then(back)} />
        </>
      ) : busy ? null : (
        <Button
          label={t('notes.start')}
          onPress={() => void start()}
          disabled={!agreed}
          accessibilityHint={agreed ? undefined : t('notes.consentFirst')}
          fullWidth
        />
      )}
    </View>
  );
}

/** A heading and its list of lines on the note page. */
function Section({ title, lines }: { title: string; lines: string[] }) {
  const p = useMainPalette();
  const theme = useTheme();
  if (!lines.length) return null;
  return (
    <View style={{ gap: theme.space[1] }}>
      <Text variant="kicker" style={{ color: p.gold }} accessibilityRole="header">
        {title}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} style={{ color: p.ink }}>
          {`• ${line}`}
        </Text>
      ))}
    </View>
  );
}

function Detail({ id, back }: { id: string; back: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const f = useFormat();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const appLanguage = useLanguage();
  const [language, setLanguage] = useState<NoteLanguage>(appLanguage);
  const [showTranscript, setShowTranscript] = useState(false);
  const [renaming, setRenaming] = useState<string | undefined>(undefined);
  const [sure, setSure] = useState(false);
  const note = useQuery({
    queryKey: ['note', id],
    queryFn: () => getNote(id),
    refetchInterval: (q) => (q.state.data && isProcessing(q.state.data.status) ? NOTE_POLL_MS : false),
  });
  const n = note.data;
  // Keep the list's row in step with what this page shows.
  const status = n?.status;
  useEffect(() => {
    if (status) void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  }, [status, queryClient]);

  const act = useMutation({
    mutationFn: async (
      action: { kind: 'retry' } | { kind: 'delete' } | { kind: 'rename'; title: string | null },
    ) => {
      if (action.kind === 'delete') {
        await deleteNote(id);
        return undefined;
      }
      return action.kind === 'retry' ? retryNote(id) : renameNote(id, action.title);
    },
    onSuccess: async (out?: Note) => {
      if (out) {
        queryClient.setQueryData(['note', id], out);
        setRenaming(undefined);
      }
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      if (!out) back();
    },
  });

  if (note.isPending) return <ActivityIndicator color={p.plum} />;
  if (!n)
    return (
      <View style={{ gap: theme.space[3] }}>
        <BackHeader title={t('notes.title')} back={back} />
        <Text tone="safety" accessibilityRole="alert">
          {errorText(note.error)}
        </Text>
      </View>
    );

  const content = noteContent(n, language);
  const title = noteTitle(n, language) ?? t('notes.untitled');
  const both = !!(n.summary?.en && n.summary?.hi);
  const failure = n.error?.code && FAILURES.has(n.error.code) ? n.error.code : 'internal_error';

  return (
    <View style={{ gap: theme.space[3] }}>
      <BackHeader title={title} back={back} />
      <Text variant="bodySm" style={{ color: p.muted }}>
        {f.detail(n)}
      </Text>

      {isProcessing(n.status) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={p.plum} />
          <Text style={{ color: p.ink, flex: 1 }} accessibilityLiveRegion="polite">
            {t(`notes.working.${n.status}`)}
          </Text>
        </View>
      ) : null}

      {n.status === 'failed' ? (
        <View style={{ gap: theme.space[2] }}>
          <Text tone="safety" accessibilityRole="alert">
            {t(`notes.failed.${failure}`)}
          </Text>
          <Button
            label={t('notes.tryAgain')}
            onPress={() => act.mutate({ kind: 'retry' })}
            loading={act.isPending}
            fullWidth
          />
        </View>
      ) : null}

      {content ? (
        <>
          {both ? (
            <Segmented<NoteLanguage>
              label={t('notes.languageLabel')}
              value={language}
              onChange={setLanguage}
              options={[
                { id: 'en', label: 'English' },
                { id: 'hi', label: 'हिंदी' },
              ]}
            />
          ) : null}
          <Text style={{ color: p.ink }}>{content.summary}</Text>
          <Section title={t('notes.keyPoints')} lines={content.key_points} />
          <Section title={t('notes.decisions')} lines={content.decisions} />
          <Section
            title={t('notes.actions')}
            lines={content.action_items.map((a) =>
              [a.text, [a.owner, a.due].filter(Boolean).join(', ')].filter(Boolean).join(' — '),
            )}
          />
        </>
      ) : null}

      {n.utterances?.length || n.transcript ? (
        <View style={{ gap: theme.space[2] }}>
          <LinkButton
            label={showTranscript ? t('notes.hideTranscript') : t('notes.showTranscript')}
            onPress={() => setShowTranscript((v) => !v)}
          />
          {showTranscript ? (
            n.utterances?.length ? (
              n.utterances.map((u, i) => (
                <Text key={i} style={{ color: p.ink }}>
                  {u.speaker !== null && u.speaker !== undefined ? (
                    <Text style={{ color: p.muted, fontWeight: '700' }}>
                      {`${t('notes.speaker', { n: u.speaker + 1 })}: `}
                    </Text>
                  ) : null}
                  {u.text}
                </Text>
              ))
            ) : (
              <Text style={{ color: p.ink }}>{n.transcript}</Text>
            )
          ) : null}
        </View>
      ) : null}

      {act.isError ? (
        <Text tone="safety" accessibilityRole="alert">
          {errorText(act.error)}
        </Text>
      ) : null}

      {renaming !== undefined ? (
        <View style={{ gap: theme.space[2] }}>
          <Input
            label={t('notes.titleLabel')}
            value={renaming}
            onChangeText={setRenaming}
            maxLength={200}
            autoFocus
          />
          <Button
            label={t('notes.saveTitle')}
            onPress={() => act.mutate({ kind: 'rename', title: renaming })}
            loading={act.isPending}
            fullWidth
          />
          {n.title ? (
            <LinkButton
              label={t('notes.generatedTitle')}
              onPress={() => act.mutate({ kind: 'rename', title: null })}
              busy={act.isPending}
            />
          ) : null}
        </View>
      ) : (
        <LinkButton label={t('notes.rename')} onPress={() => setRenaming(n.title ?? title)} />
      )}
      <LinkButton
        label={sure ? t('notes.deleteSure') : t('notes.delete')}
        onPress={() => (sure ? act.mutate({ kind: 'delete' }) : setSure(true))}
        busy={act.isPending}
      />
    </View>
  );
}
