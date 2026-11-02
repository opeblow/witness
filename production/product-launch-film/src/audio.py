"""Builds the film's full soundtrack: an original synthesized score, sound design,
and the narration placed on the timeline, with the score ducked under the voice.

Everything here is generated from code, so the audio is fully owned (see ASSETS.md).
Run with the tts venv:  ../../../tts/.venv/Scripts/python.exe src/audio.py
Writes build/mix.wav (48 kHz stereo).
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
SR = 48000
TL = json.loads((ROOT / "timeline.json").read_text())
DUR = TL["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def hz(note: int) -> float:
    """MIDI note number to frequency."""
    return 440.0 * 2 ** ((note - 69) / 12)


def env_adsr(n, a, d, s, r):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.full(n, s, dtype=np.float32)
    e[:a] = np.linspace(0, 1, a)
    e[a : a + d] = np.linspace(1, s, d)[: max(0, min(d, n - a))]
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def add(buf, start_s, sig, gain=1.0, pan=0.0):
    i = int(start_s * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(sig), 0] += sig * gain * left
    buf[i : i + len(sig), 1] += sig * gain * right


def smooth(x, n):
    """Fast moving average (cumulative sum)."""
    c = np.cumsum(np.concatenate([np.zeros(n), x, np.zeros(n)]))
    return ((c[2 * n :] - c[: -2 * n]) / (2 * n))[: len(x)]


def pad(notes, length, gain=0.06):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n, dtype=np.float32)
    for note in notes:
        f = hz(note)
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            sig += np.sin(2 * np.pi * ff * t + rng.uniform(0, 6.28)) * 0.6
            sig += np.sin(2 * np.pi * 2 * ff * t) * 0.12
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t + rng.uniform(0, 6))
    return sig * lfo * env_adsr(n, 2.5, 0.5, 1.0, 2.5) * gain / len(notes)


def pluck(note, length=2.2, gain=0.16, bright=1.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = (
        np.sin(2 * np.pi * f * t)
        + 0.35 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3)
        + 0.12 * bright * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 6)
    )
    e = np.exp(-t * 2.4) * np.minimum(1, t / 0.004)
    return (sig * e * gain).astype(np.float32)


def bell(note, length=5.0, gain=0.12):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = sum(
        amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * decay)
        for ratio, amp, decay in ((1, 1, 0.9), (2.76, 0.4, 1.8), (5.4, 0.2, 3.2), (2.0, 0.3, 1.2))
    )
    return (sig * np.minimum(1, t / 0.003) * gain).astype(np.float32)


def noise_burst(length, cutoff_from, cutoff_to, gain):
    n = int(length * SR)
    x = rng.standard_normal(n).astype(np.float32)
    # Crude sweeping filter: blend between two fixed low-passes.
    lo = smooth(x, max(1, int(SR / cutoff_from) // 2))
    hi = smooth(x, max(1, int(SR / cutoff_to) // 2))
    mix = np.linspace(0, 1, n)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    return ((lo * (1 - mix) + hi * mix) * shape * gain).astype(np.float32)


music = np.zeros((N, 2), dtype=np.float32)

# Harmony plan (MIDI): A minor colour for the hook/problem, resolving to D major at the reveal.
sections = [
    (0, 14, [45, 52, 60, 64], 0.05),       # Am(add9) feel, sparse
    (13, 40, [41, 48, 57, 64], 0.055),     # Fmaj7, unresolved
    (39, 53, [50, 57, 62, 66, 69], 0.07),  # D major: the turn
]
for start, end, notes, g in sections:
    add(music, start, pad(notes, end - start + 2.5, g), 1.0)

# Experience: a four-chord loop under the demo, 2 bars each at 92 bpm.
loop = [[50, 57, 62, 66], [45, 52, 61, 64], [42, 54, 57, 61], [47, 54, 59, 62]]  # D A F#m Bm
beat = 60 / 92
bar = 4 * beat
t = 52.0
i = 0
while t < 147.5:
    chord = loop[i % 4]
    add(music, t, pad(chord, 2 * bar + 2.5, 0.06), 1.0)
    # Arpeggio of soft plucks, quieter while the verdict lands.
    for k in range(16):
        tt = t + k * beat / 2
        if tt >= 147.5:
            break
        note = chord[[1, 2, 3, 2][k % 4]] + 12
        g = 0.05 if 108 <= tt <= 121 else 0.075
        add(music, tt, pluck(note, 1.6, g, 0.8), 1.0, pan=0.35 if k % 2 else -0.35)
    t += 2 * bar
    i += 1

# Payoff and close: open voicing, then a final held chord.
add(music, 147.5, pad([50, 57, 62, 66, 69, 74], 14, 0.075))
add(music, 160, pad([50, 57, 62, 69, 74, 78], 14, 0.07))
for k, note in enumerate([74, 78, 81, 86]):
    add(music, 148.5 + k * 2.6, pluck(note, 3.0, 0.06, 0.6), 1.0, pan=(-0.3, 0.3)[k % 2])

# Sparse piano-like motif in the hook.
for at, note in ((0.8, 69), (3.2, 72), (6.0, 71), (9.5, 64), (12.4, 69)):
    add(music, at, pluck(note, 3.0, 0.07, 0.5), 1.0, pan=0.15)
# A quiet clock-like tick through the problem section.
for k in range(int((39 - 15) / beat)):
    add(music, 15 + k * beat, pluck(93, 0.08, 0.018, 0.2), 1.0, pan=0.5)

# Sound design.
sfx = np.zeros((N, 2), dtype=np.float32)
for cue in TL["sfx"]:
    at, kind = cue["at"], cue["kind"]
    if kind == "click":
        add(sfx, at, pluck(96, 0.05, 0.10, 1.5))
    elif kind == "tick":
        add(sfx, at, pluck(88, 0.12, 0.08, 1.0), pan=0.2)
    elif kind == "shutter":
        add(sfx, at, noise_burst(0.05, 3000, 9000, 0.25))
        add(sfx, at + 0.07, noise_burst(0.04, 3000, 9000, 0.18))
    elif kind == "whoosh":
        add(sfx, at - 0.5, noise_burst(0.9, 300, 4000, 0.06))
    elif kind == "thud":
        n = int(1.2 * SR)
        tt = np.arange(n) / SR
        f = 55 * np.exp(-tt * 1.5)
        add(sfx, at, (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.5) * 0.35).astype(np.float32))
    elif kind == "stamp":
        n = int(0.6 * SR)
        tt = np.arange(n) / SR
        add(sfx, at, (np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 9) * 0.35).astype(np.float32))
        add(sfx, at, noise_burst(0.06, 800, 3000, 0.2))
        add(sfx, at + 0.05, bell(81, 2.5, 0.05), pan=0.1)
    elif kind == "chime":
        add(sfx, at, bell(81, 4.0, 0.07), pan=-0.1)
        add(sfx, at + 0.12, bell(86, 4.0, 0.05), pan=0.1)
    elif kind == "alert":
        add(sfx, at, bell(70, 2.0, 0.06))
        add(sfx, at + 0.18, bell(69, 2.5, 0.06))

# Narration, mono centred.
voice = np.zeros((N, 2), dtype=np.float32)
for cue in TL["voice"]:
    data, sr = sf.read(BUILD / "voice" / f"{cue['id']}.wav", dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != SR:
        x_old = np.linspace(0, 1, len(data))
        x_new = np.linspace(0, 1, int(len(data) * SR / sr))
        data = np.interp(x_new, x_old, data).astype(np.float32)
    add(voice, cue["at"], data, 0.95)

# Duck the score under the voice: smoothed envelope, about -9 dB when speaking.
venv = np.abs(voice[:, 0])
win = int(0.25 * SR)
venv = smooth(venv, win // 2)
venv = np.clip(venv / (venv.max() or 1) * 6, 0, 1)
attack = int(0.35 * SR)
venv = smooth(venv, attack // 2)
duck = 1 - 0.65 * np.clip(venv, 0, 1)

# Overall music fade in/out.
fade = np.ones(N, dtype=np.float32)
fade[: int(1.0 * SR)] = np.linspace(0, 1, int(1.0 * SR))
fade[-int(4.0 * SR) :] = np.linspace(1, 0, int(4.0 * SR))

mix = voice + (music * duck[:, None] * 1.6 + sfx) * fade[:, None]
peak = float(np.max(np.abs(mix)))
mix = mix / peak * 0.9
sf.write(BUILD / "mix.wav", mix, SR, subtype="PCM_24")
print("peak before normalise", round(peak, 3), "->", BUILD / "mix.wav")
