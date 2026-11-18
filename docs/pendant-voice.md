# Pendant voice: pendant → app → voice socket

The pendant (or the Python simulator standing in for it) streams encoded audio to the phone over Bluetooth LE. The
app decodes it to 16-bit PCM and sends it to Svaraa's voice socket (`WS /api/v1/voice/ws`), exactly like the browser
call does with the computer's microphone. The spoken reply plays on the phone (default) or on the pendant.

```
pendant ──BLE──▶ BleTransport ──▶ pendantVoice ──▶ decoder ─▶ mono ─▶ 16 kHz ─▶ 100 ms chunks ──▶ voiceChannel ──WS──▶ server
                 services/pendant  services/voice   services/audio                                  services/voice
reply 'phone':           ◀── MP3 ── ReplyPlayer (phone speaker) ◀───────────────────────────────────────────────┘
reply 'pendant': pendant ◀──BLE AUDIO_RX── encoder (pendant codec) ◀─ frames ◀─ pendantReplyPlayer ◀── PCM ──┘
```

| Piece                          | File                                                               | Swap it by                                          |
| ------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------- |
| Bluetooth link and wire format | `services/pendant/ble.native.ts`, `protocol.ts`                    | another `PendantTransport`                          |
| Codec                          | `services/audio/codecs.ts` (`pcm16`, `adpcm` built in, both ways)  | `registerDecoder(...)` / `registerEncoder(...)`     |
| Backend                        | `services/voice/voiceChannel.ts` (also used by the browser call)   | `openChannel` option of `startPendantVoice`         |
| Where the reply is heard       | `replyPlayer.native.ts` (phone), `pendantReplyPlayer.ts` (pendant) | `replyTo` / `player` options of `startPendantVoice` |
| Turn logic                     | `services/voice/pendantVoice.ts`                                   | –                                                   |

Switches: `EXPO_PUBLIC_PENDANT_TRANSPORT=ble`, `EXPO_PUBLIC_PENDANT_VOICE=svaraa`, `EXPO_PUBLIC_PENDANT_REPLY`
(`phone` or `pendant`), and `EXPO_PUBLIC_WS_URL` for the server. Dev screen: `svaraa://pendant-voice` (development
builds only). While it runs, the call button in chat shows the pendant's state.

## Where the reply plays

Each player says which format it wants from the server (`ReplyPlayer.wants`); the voice socket asks for it with
`?reply_format=…&reply_rate=…`. Without the parameter the server sends MP3, as it always did.

| `EXPO_PUBLIC_PENDANT_REPLY` | Socket asks for | What happens                                                                                                                                                                                 |
| --------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phone` (default)           | nothing (MP3)   | Played on the phone's speaker. PCM would also play there (as WAV).                                                                                                                           |
| `pendant`                   | `pcm16`, 16 kHz | Resampled to the pendant's rate, cut into its frame length, encoded in its codec (hello), numbered and written to AUDIO_RX about 200 ms ahead of real time. PLAYBACK_END when it has played. |

`pendant` falls back to the phone, with a line in the log, when the reply is MP3 (an older server that ignores
`reply_format`), when the pendant's codec has no encoder here, or before the pendant's hello. A PLAYBACK_INTERRUPT
from the pendant stops the frames at once.

The server marks each reply with `{"type":"reply_start","format",…}` and `{"type":"reply_end"}`. Older servers do
not: there ~1 s without a chunk ends the reply. If a `reply_end` is lost, 15 s without a chunk ends it.

## BLE (pendant ↔ phone)

Same contract as the simulator's `simulator/transports/ble_protocol.py`. Service `96b07100-79ac-407f-88a5-23fae7871e06`:
AUDIO_TX `…7101` (notify, `[2B seq BE][frame]`), AUDIO_RX `…7102` (write without response), CONTROL `…7103`
(write + notify, `[opcode][fields]`).

| Opcode | Name               | Direction       | Fields                                                        |
| ------ | ------------------ | --------------- | ------------------------------------------------------------- |
| `0x01` | HELLO              | pendant → phone | codec u8, rate u16, channels u8, frame_ms u8, bitrate/100 u16 |
| `0x02` | WAKE_DETECTED      | pendant → phone | –                                                             |
| `0x03` | UTTERANCE_END      | pendant → phone | frames u16                                                    |
| `0x04` | PLAYBACK_INTERRUPT | pendant → phone | –                                                             |
| `0x80` | LINK_READY         | phone → pendant | mtu u16                                                       |
| `0x81` | HELLO_ACK          | phone → pendant | – (the app can decode the hello's codec)                      |
| `0x82` | PLAYBACK_END       | phone → pendant | – (reply played, or none came in 20 s)                        |
| `0x83` | ERROR              | phone → pendant | UTF-8 text ≤ 19 bytes (e.g. `codec opus unsupported`)         |

Codec ids (append only, same in Python): `pcm16` 0, `opus` 1, `adpcm` 2, `lc3` 3.

## Codecs

A packet must fit `MTU − 3` bytes (the app asks Android for MTU 185, so 182).

| Codec              | 20 ms at 16 kHz | Over BLE                                   | In the app                                                                                  |
| ------------------ | --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `adpcm` (IMA, 4:1) | 164 B + 2 B seq | fits                                       | built in                                                                                    |
| `pcm16`            | 640 B           | does not fit (use with ≤ 5 ms frames only) | built in                                                                                    |
| `opus`             | ~60 B           | fits                                       | needs a native decoder (Hermes has no WebAssembly); `registerDecoder('opus', …)` when added |

ADPCM frame: `[int16 LE predictor][u8 step index][u8 0][4-bit codes, low nibble first]`. The header is the coder state
before the frame, so each frame decodes alone. Python and TypeScript are checked against the same test frame
(`__tests__/audio-codecs.test.ts`).

## One turn

1. Phone connects, asks for MTU 185, subscribes, writes LINK_READY. The pendant sends HELLO.
2. The app answers HELLO_ACK if it can decode the codec (ERROR otherwise) and opens the voice socket early, since
   the server may take up to a minute to wake. Audio that arrives first is queued.
3. WAKE, then frames: decoded and sent as 100 ms PCM chunks.
4. UTTERANCE_END: 1.2 s of silence is sent so the server's ~1 s end-of-speech check fires straight away.
5. The reply comes back between `reply_start` and `reply_end` (older servers: ~1 s without a new chunk). It plays on
   the phone or the pendant, then PLAYBACK_END goes to the pendant.

PENDING BACKEND: the socket has no sign-in yet and no transcript frames. `pcm16` replies start after TTS has
finished (the server decodes the MP3 in one piece), so they begin a little later than MP3.
