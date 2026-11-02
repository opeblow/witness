# Witness launch film

**Final video:** `witness-launch-film.mp4` in this folder. It is git-ignored because of its size; the published copy is linked from the main README.

Spec: 2:54 (174 s), 1920×1080, 30 fps, H.264 High, AAC stereo 48 kHz, loudness normalised to −16 LUFS.

| File | What it is |
| --- | --- |
| [`BRIEF.md`](BRIEF.md) | Creative brief, shot list, screen coverage, asset inventory and licences |
| [`SCRIPT.md`](SCRIPT.md) | Narration with start times |
| [`timeline.json`](timeline.json) | Master timeline: scenes, voice cues, sound effects |
| [`narration.json`](narration.json) | Narration text per cue (the TTS input) |
| `witness-launch-film.srt` | Subtitles matching the final cut |
| [`src/`](src) | Production source (below) |
| [`MASTER_BRIEF.md`](MASTER_BRIEF.md) | The original brief |

## Reproduce

Requires Node 22+, ffmpeg, and the Kokoro venv in `../../../tts` (Kokoro-82M ONNX + `voices-v1.0.bin`).

```sh
npm install                       # Playwright only
node src/make-photos.mjs          # the illustrative parcel photo and its edited copy
# Run the notary and a production web build pointed at it, then:
BASE=http://localhost:5199 node src/capture.mjs   # real screenshots; SEALS A NEW PHOTO ON TESTNET
npm run voice                     # narration clips -> build/voice
../../../tts/.venv/Scripts/python.exe src/audio.py   # score + sound design + voice -> build/mix.wav
node src/render.mjs --stills 5,60,115              # preview frames -> build/stills
node src/render.mjs                                # final MP4
```

Set `SKIP_SEAL=/v/<content hash>` on `capture.mjs` to reuse an existing capture instead of sealing a new one. In Git Bash, also set `MSYS_NO_PATHCONV=1`.
