"""Batch-generate Monk Soup Tower SFX candidates (3 per sound) with Stable Audio 3 Small-SFX."""
import local_env  # noqa: F401  (sets HF cache inside this folder)
import json
import time
from pathlib import Path

import torch
import torchaudio
import torchaudio.functional as AF
from stable_audio_3 import StableAudioModel

OUT = local_env.ROOT / 'outputs' / 'monk-soup-tower'
OUT.mkdir(parents=True, exist_ok=True)
SR_IN = 44100
SR_OUT = 32000
NEG = 'music, singing, speech, voices, chanting, distortion, clipping, low quality, noisy, hum'

# name, kind, generate seconds, final seconds, prompt
P = 'TrackType: SFX, '
SOUNDS = [
    ('brush-loop', 'loop', 4.5, 3.0, P + 'soft calligraphy brush stroking across rough rice paper, continuous gentle dry swishing texture, steady volume, close and intimate, no voices, no music'),
    ('step-wood', 'shot', 3.0, 0.3, P + 'single soft footstep of a cloth sandal on an old wooden temple floorboard, light creak, dry and close, no voices, no music'),
    ('step-slip', 'shot', 3.0, 0.45, P + 'a wet sandal squeaking and sliding briefly on a slick wooden floor, short slippery squelch, comedic, no voices, no music'),
    ('slosh-loop', 'loop', 4.5, 3.0, P + 'thick hot soup gently sloshing back and forth inside a ceramic bowl, continuous soft liquid lapping, steady volume, close, no splashes, no voices, no music'),
    ('spill', 'shot', 3.0, 0.9, P + 'a small splash of hot soup spilling over the rim of a bowl and splattering onto a wooden floor, short and wet, no voices, no music'),
    ('sizzle', 'shot', 3.0, 0.9, P + 'a quick hot sizzle hiss of boiling liquid hitting warm wood, short steam puff that fades out, no voices, no music'),
    ('floor-clear', 'shot', 3.0, 0.6, P + 'a single clear wooden temple block (mokugyo) knock, warm hollow tone, short natural decay, no voices, no music'),
    ('summit-bell', 'shot', 4.0, 2.6, P + 'a bright small temple bell struck once with a warm shimmering ring and a gentle wind chime sparkle, uplifting and peaceful, long natural tail, no voices, no music'),
    ('fall', 'shot', 3.0, 1.6, P + 'comedic cartoon falling whistle sliding downward in pitch, ending with a soft distant wooden thud and a ceramic bowl clatter, playful not painful, no voices, no music'),
    ('soup-cold', 'shot', 3.0, 0.9, P + 'a soft descending two-note woodblock and a faint chilly wind whoosh, a gentle uh-oh it is getting cold cue for a casual game, no voices, no music'),
    ('score-tick', 'shot', 1.0, 0.08, P + 'a single very short soft wooden tick, like a tiny bamboo tap, crisp and dry, no tail, no voices, no music'),
    ('new-record', 'shot', 3.0, 2.2, P + 'joyful short celebratory fanfare for a casual mobile game, bright plucked koto-like strings and bells rising to a final chord with a gong shimmer, triumphant but friendly, no voices'),
    ('ui-click', 'shot', 1.0, 0.15, P + 'soft short UI button tap, a rounded bamboo click with a tiny pop, clean and dry, casual mobile game, no voices, no music'),
]
import os
SEEDS = [int(x) for x in os.environ.get('SEEDS', '11,22,33').split(',')]
TAKE0 = int(os.environ.get('TAKE0', '1'))


def to_mono(a):
    if a.ndim == 3:
        a = a[0]
    return a.detach().float().cpu().mean(0, keepdim=True)


def trim_lead(a, thresh=0.02):
    idx = (a.abs()[0] > thresh * a.abs().max()).nonzero()
    start = max(0, int(idx[0]) - int(0.003 * SR_OUT)) if len(idx) else 0
    return a[:, start:]


def fade_out(a, sec):
    n = min(a.shape[1], int(sec * SR_OUT))
    if n > 0:
        a[:, -n:] *= torch.linspace(1, 0, n) ** 2
    return a


def fade_in(a, sec):
    n = min(a.shape[1], int(sec * SR_OUT))
    if n > 0:
        a[:, :n] *= torch.linspace(0, 1, n)
    return a


def make_loop(a, final_sec, xfade=0.5):
    # use the steadiest middle part; crossfade the tail into the head
    L = int(final_sec * SR_OUT)
    X = int(xfade * SR_OUT)
    start = int(0.25 * SR_OUT)
    seg = a[:, start:start + L + X].clone()
    body = seg[:, :L].clone()
    tail = seg[:, L:L + X]
    t = torch.linspace(0, 1, X)
    body[:, :X] = body[:, :X] * torch.sqrt(t) + tail * torch.sqrt(1 - t)
    return body


def normalize(a, peak=0.89):
    m = a.abs().max()
    return a * (peak / m) if m > 0 else a


import sys
ONLY = set(sys.argv[1:])
meta = []
print('Loading model...', flush=True)
model = StableAudioModel.from_pretrained('small-sfx')
print('Model on', model.device, flush=True)
for name, kind, gen_sec, final_sec, prompt in SOUNDS:
    if ONLY and name not in ONLY:
        continue
    for i, seed in enumerate(SEEDS, TAKE0):
        t0 = time.perf_counter()
        audio = model.generate(prompt=prompt, negative_prompt=NEG, duration=gen_sec, seed=seed)
        a = AF.resample(to_mono(audio), SR_IN, SR_OUT)
        if kind == 'loop':
            a = make_loop(a, final_sec)
        else:
            a = trim_lead(a)
            a = a[:, : int(final_sec * SR_OUT)]
            a = fade_in(a, 0.002)
            a = fade_out(a, min(0.45 if name in ('summit-bell','fall','new-record') else 0.25, final_sec * 0.3))
        a = normalize(a)
        fn = f'{name}-{i}.wav'
        torchaudio.save(str(OUT / fn), a, SR_OUT, encoding='PCM_S', bits_per_sample=16)
        meta.append({'name': name, 'kind': kind, 'take': i, 'seed': seed, 'file': fn,
                     'seconds': round(a.shape[1] / SR_OUT, 3), 'prompt': prompt})
        print(f'{fn} {a.shape[1] / SR_OUT:.2f}s ({time.perf_counter() - t0:.1f}s)', flush=True)

(OUT / ('candidates.json' if not ONLY else 'candidates-partial.json')).write_text(json.dumps({'negative_prompt': NEG, 'items': meta}, indent=2), encoding='utf-8')
print('DONE', OUT)
