# Master brief: Witness launch film

The user's full brief (pasted Nov 1 2026) is summarised here in their own section order. Follow it **after** the lean anchor contract is deployed on Nov 2. The Witness addendum at the bottom adds detail for this product and overrides the brief where they conflict.

## The brief (user's requirements)

1. **Understand the project first.** Read the README, code and docs, and use the live site. Verify features, don't assume them. Don't break the app. Write a short internal brief, then go straight into production without waiting for storyboard approval.
2. **Creative concept.** No generic openers. Follow the arc hook → problem → turning point → experience → proof → payoff → final impression.
3. **Specs (non-negotiable).** 2:45–3:00 (target 2:52–2:56), 16:9, 1920×1080, 30 fps, MP4, H.264, AAC stereo.
4. **Art direction.** An original visual language that respects the product's identity. No blue-purple gradients, glowing particles, glassmorphism, random floating cards or meaningless 3D.
5. **Real product, not a substitute.** Capture authentic footage (Playwright), with a shot-coverage checklist. Never fake functionality, users, statistics or testimonials, and mark any illustrative scene clearly.
6. **Voiceover.** 300–360 words, written for the ear, natural and warm. Use only legitimate TTS, and quality-check the generated audio.
7. **Music and sound.** The score evolves with the story. Restrained, purposeful sound design. Duck music under narration, no clipping. Audio must be licensed or original.
8. **Editing.** Motivated, varied transitions, and hard cuts when they're better. A very strong first 10 seconds, a middle that doesn't drag, an intentional ending.
9. **Tools.** Remotion/React/SVG, Playwright, FFmpeg, Python. Check what's installed, and keep the source maintainable.
10. **Master timeline.** Machine-readable, covering the full runtime.
11. **Full production.** Render, inspect, revise, render again. A plan or one render isn't done.
12. **Creative-director gate.** After the first render, find the five weakest moments, fix each one concretely, re-render and re-inspect. Priorities in order: story, clarity, authentic footage, art direction, pacing, sound, motion, technical polish.
13. **Technical QA.** ffprobe checks for duration, resolution, fps, codecs and decoding. No black frames, glitches or typos, audio in sync, ending not truncated. Inspect frames from the start, middle and end. Claim only checks that actually ran.
14. **Deliverables** in `production/product-launch-film/`: final MP4, narration script, creative brief, scene timeline, shot list, screen coverage checklist, SRT subtitles, production source, asset inventory with licences, and a README.
15. **Final report.** Path, specs, creative decisions, screens shown, checks performed, limitations. Separate what was rendered from what was inspected and what was verified.

## Witness addendum (Claude's improvements)

**Story spine.** The hero moment is real: a sealed photo gets edited and Witness points to the exact cells that changed. Build the film around that reveal. Open on a dispute ("They say it arrived damaged. You say it didn't.") rather than on the product.

**Authentic capture flow.** Run the real Capture page in Playwright with Chromium's fake camera (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<parcel.y4m>`), so the film shows the actual product sealing a photo, not a mock-up.

**On-chain proof shot.** Show the real extrinsic and the anchor contract on the Portaldot node console or EVM RPC, with numbers taken from `deployments/`. Say "testnet", never imply mainnet.

**Consistency.** The numbers in the film must match the pitch deck and README: test counts, cost per capture, block numbers.

**Brand.** Use the app's palette: charcoal #15130F, paper #F5F1E8 and #EAE4D6, green #1D6B4A and #7FB89A. Typefaces are Instrument Serif, IBM Plex Sans and IBM Plex Mono (already in apps/web).

**Voice: DECIDED Nov 1, user chose Kokoro-82M (AI voice, option B).** Previously the biggest quality risk. The only installed voices are Microsoft David, Zira and Mark, which sound robotic. Options, best first:

1. The user records the narration themselves. It's authentic and suits a hackathon. Claude supplies the script plus a timed guide track.
2. Kokoro-82M (Apache 2.0, local, high quality) or Piper (MIT; check each voice's licence).
3. Do not use unofficial endpoints such as edge-tts. Their licensing is unclear.

**Music.** Synthesise an original, fully owned score (Python/ffmpeg) or use a track the user picks from a clearly licensed library (YouTube Audio Library, Pixabay Music), recorded in the asset inventory.

**Machine limits.** ffmpeg 9.0.1, Python 3.12, Node 24 and Playwright 1.64 are available. Remotion is not installed. **The disk has only about 8 GB free**, so render intermediates to a scratch folder, delete them, and keep a single final MP4.

**Git.** Commit the production source and docs, but git-ignore the MP4 (too large). Upload the final cut to YouTube as unlisted for the DoraHacks submission.

**Runtime safety.** Aim for 2:52. DoraHacks caps the video at 3 minutes.
