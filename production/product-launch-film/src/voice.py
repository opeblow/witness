"""Generates one narration clip per cue with Kokoro-82M (Apache 2.0, local ONNX).

Run with the tts venv:  ../../../tts/.venv/Scripts/python.exe src/voice.py [voice]
Writes build/voice/<id>.wav and build/voice/durations.json.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT.parents[2] / "tts" / "models"
OUT = ROOT / "build" / "voice"
OUT.mkdir(parents=True, exist_ok=True)

voice = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
only = set(sys.argv[2:])
kokoro = Kokoro(str(MODELS / "kokoro-v1.0.fp16.onnx"), str(MODELS / "voices-v1.0.bin"))
cues = json.loads((ROOT / "narration.json").read_text(encoding="utf-8"))

durations_file = OUT / "durations.json"
durations = json.loads(durations_file.read_text()) if durations_file.exists() else {}
for cue in cues:
    if only and cue["id"] not in only:
        continue
    samples, sr = kokoro.create(cue["text"], voice=voice, speed=0.94, lang="en-us")
    samples = np.asarray(samples, dtype=np.float32)
    # Trim leading/trailing silence, then add a short, even tail.
    idx = np.where(np.abs(samples) > 0.01)[0]
    if len(idx):
        samples = samples[max(idx[0] - int(0.03 * sr), 0) : idx[-1] + int(0.12 * sr)]
    peak = float(np.max(np.abs(samples))) or 1.0
    samples = samples / peak * 0.89
    sf.write(OUT / f"{cue['id']}.wav", samples, sr)
    durations[cue["id"]] = round(len(samples) / sr, 3)
    print(cue["id"], durations[cue["id"]])

durations_file.write_text(json.dumps(durations, indent=2))
print("total speech", round(sum(durations.values()), 1), "s")
