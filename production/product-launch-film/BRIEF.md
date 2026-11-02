# Creative brief

**Idea.** A photograph that can testify. The film opens on a dispute nobody can settle (a parcel photo, then an edited copy claiming damage) and ends with Witness pointing at the exact corner that was changed. Everything between is the real product doing that, live on the Portaldot V3 testnet.

**Audience.** Hackathon judges first, then the operators who live with photo disputes: couriers, marketplaces, rental platforms, insurers.

**Arc.** Hook (the dispute) → problem (editing is easy, detection only guesses) → turn ("It doesn't guess. It keeps a record.") → experience (capture and seal) → proof (verify original, verify the edited copy) → depth (public ledger, open SDK) → payoff (where it matters) → close.

**Look.** The app's own identity: paper #F4F1EA, ink #15130F, record red #D2451E, evidence green #1D6B4A; Instrument Serif, IBM Plex Sans and Mono. Editorial typography, real interface at full scale, slow camera moves into the detail that matters, mostly hard cuts. Ink-black frames are reserved for the turning point, the transaction diagram and the close.

**Sound.** An original score synthesised in code: an unresolved A minor/F colour under the problem, a turn to D major at the reveal, a 92 bpm arpeggio loop under the demo that thins out while the "edited" verdict lands, and a held final chord. Sound design is sparse: shutter, ticks on the sealing steps, a stamp on the certificate, a chime for "authentic", a low two-note alert for "altered". The score is ducked about 9 dB under the voice.

## Honesty rules applied

- The parcel photo is a rendered illustration, labelled "Illustrative scene" on screen.
- Every product shot is a real screenshot of the Witness web app (production build), taken by Playwright on 2 Nov 2026.
- The seal shown is a real testnet transaction: Witness id W-79E6-8834-ED43, anchored in block 296,166 of the Portaldot V3 testnet, registry `0x47d33e33e4c7932535001d4a01e4933bc4bcf0e0`. It took 10.7 s from click to certificate ("about ten seconds").
- The "altered" verdict is the real output for the edited copy, found without a certificate: one region, 0.8 % of the frame ("less than one percent").
- The statistic is the one cited in the project README: Verisk, March 2026.
- The film says "testnet" and never implies mainnet or real customers.

## Shot list and screen coverage

| Time | Shot                                      | Source                                              | Status |
| ---- | ----------------------------------------- | --------------------------------------------------- | ------ |
| 0:00 | Doorstep photo, dissolve to edited copy   | `assets/parcel-*.png` (illustration)                | Done   |
| 0:14 | "Editing takes seconds" type card         | film.html                                           | Done   |
| 0:28 | 99 % statistic                            | film.html (Verisk, Mar 2026)                        | Done   |
| 0:33 | "Detection makes a guess" strike-through  | film.html                                           | Done   |
| 0:39 | Mark draws itself, "It keeps a record."   | film.html, logo from `apps/web`                     | Done   |
| 0:46 | Landing page hero (iris in)               | `screens/home-hero.png`                             | Done   |
| 0:52 | Capture: start, import, review            | `capture-start`, `capture-review`                   | Done   |
| 1:06 | Sealing steps, live                       | `capture-sealing-0..2`                              | Done   |
| 1:11 | One atomic extrinsic diagram              | film.html (matches `packages/sdk/src/substrate.ts`) | Done   |
| 1:20 | Certificate, push to Witness id           | `capture-sealed`                                    | Done   |
| 1:30 | Verify: authentic original                | `verify-start`, `verify-original-full`              | Done   |
| 1:42 | Verify: altered, push into CHANGED        | `verify-edited-full`                                | Done   |
| 2:02 | Ledger with both live captures            | `ledger`                                            | Done   |
| 2:15 | Developers: network, registry, quickstart | `developers-full`                                   | Done   |
| 2:27 | Use cases in type                         | film.html                                           | Done   |
| 2:40 | Close: mark, line, URL                    | film.html                                           | Done   |

Screens covered: Landing, Capture (start, review, sealing, certificate), Verify (authentic, altered), Ledger, Developers. Not shown: the public record page (`/v/:id`), which repeats the certificate content.

## Asset inventory

| Asset                                | Origin                                               | Licence                    |
| ------------------------------------ | ---------------------------------------------------- | -------------------------- |
| Product screenshots                  | Witness web app, captured by `src/capture.mjs`       | Project's own (Apache 2.0) |
| Parcel photo and edited copy         | Rendered SVG by `src/make-photos.mjs`                | Original, project's own    |
| Logo mark                            | `apps/web/src/components/Logo.tsx`                   | Project's own              |
| Instrument Serif, IBM Plex Sans/Mono | `@fontsource` packages                               | SIL Open Font License 1.1  |
| Narration                            | Kokoro-82M ONNX, voice `af_heart`, generated locally | Model: Apache 2.0          |
| Score and sound effects              | Synthesised by `src/audio.py`                        | Original, project's own    |
