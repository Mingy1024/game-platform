"""Generate 5 background-music candidates for Monk Soup Tower with Stable Audio 3 Small-Music."""
import local_env  # noqa: F401
import json, sys, time
import torch, torchaudio
import torchaudio.functional as AF
import soundfile as sf
from stable_audio_3 import StableAudioModel

OUT = local_env.ROOT / 'outputs' / 'monk-soup-tower-bgm'
OUT.mkdir(parents=True, exist_ok=True)
SR = 44100
NEG = 'vocals, singing, speech, choir, chanting, distortion, harsh noise, low quality, lo-fi crackle, sfx, crowd'
P = 'TrackType: Music, VocalType: Instrumental, '
TRACKS = [
    ('temple-tiptoe', 90, 101,
     P + 'Genre: Asian Folk, Genre: Lighthearted. A calm but playful instrumental for a little monk carefully carrying a bowl of hot soup up a wooden pagoda. '
     'Plucked guzheng and pipa melody, soft bamboo flute, light wooden percussion and tiny bells, gentle tiptoeing rhythm with a hint of comic suspense, warm and cozy, 90 BPM.'),
    ('mountain-mist', 80, 202,
     P + 'Genre: Ambient, Genre: Asian Traditional. A peaceful misty mountain temple morning. Slow guqin and koto phrases, airy dizi bamboo flute, soft wind chimes, '
     'warm low drone, sparse temple woodblock, serene and spacious but not sleepy, gentle steady pulse, 80 BPM.'),
    ('soup-shuffle', 104, 303,
     P + 'Genre: Cartoon, Genre: Asian Folk. A sneaky comedic shuffle for a monk balancing a wobbly bowl of soup on narrow beams. Pizzicato strings, plucked pipa, '
     'muted woodblocks, little gongs and cymbal taps, bouncy bassoon-like bass line, mischievous and funny, 104 BPM.'),
    ('pagoda-climb', 112, 404,
     P + 'Genre: Cinematic, Genre: Asian Traditional. An uplifting adventure theme for climbing a five-story pagoda above the clouds. Soaring erhu melody, guzheng arpeggios, '
     'light taiko and frame drums, warm strings, hopeful and determined, light and not heavy, 112 BPM.'),
    ('tea-house-lofi', 84, 505,
     P + 'Genre: Lo-fi Hip Hop, Genre: Asian Fusion. A cozy chill beat for a relaxing casual temple game. Mellow guzheng and pipa licks, soft electric piano chords, '
     'warm round bass, gentle laid-back drums with brushed snare, clean and smooth, relaxed and friendly, 84 BPM.'),
]
BARS = 32
XF = 2.0  # loop crossfade seconds

only = set(sys.argv[1:])
print('Loading small-music...', flush=True)
model = StableAudioModel.from_pretrained('small-music')
meta = []
for tid, bpm, seed, prompt in TRACKS:
    if only and tid not in only:
        continue
    loop_sec = BARS * 4 * 60 / bpm
    bar = 4 * 60 / bpm
    EXTRA = 16  # bars of headroom so the loop can skip an intro or an outro
    t0 = time.perf_counter()
    audio = model.generate(prompt=prompt, negative_prompt=NEG, duration=loop_sec + EXTRA * bar + XF + 1.0, seed=seed)
    if audio.ndim == 3:
        audio = audio[0]
    a = audio.detach().float().cpu()
    L, X = int(loop_sec * SR), int(XF * SR)
    m = a.mean(0)
    def rms(x):
        return float(x.pow(2).mean().sqrt()) + 1e-6
    best = None
    for k in range(0, EXTRA + 1):
        off = int(k * bar * SR)
        if off + L + X > m.shape[0]:
            break
        win = rms(m[off:off + L])
        segs = [rms(m[off + i * L // 8: off + (i + 1) * L // 8]) for i in range(8)]
        head = rms(m[off:off + 2 * SR]); end = rms(m[off + L - 2 * SR: off + L]); xf = rms(m[off + L: off + L + X])
        import math
        score = sum(abs(math.log(v / win)) for v in (head, end, xf)) + 0.5 * sum(abs(math.log(v / win)) for v in segs)
        if best is None or score < best[0]:
            best = (score, k, off)
    _, k, off = best
    body = a[:, off:off + L].clone()
    tail = a[:, off + L:off + L + X]
    t = torch.linspace(0, 1, X)
    body[:, :X] = body[:, :X] * torch.sqrt(t) + tail * torch.sqrt(1 - t)
    body = body * (0.89 / body.abs().max())
    sf.write(OUT / f'{tid}.wav', body.T.numpy(), SR, subtype='PCM_16')
    sf.write(OUT / f'{tid}.mp3', body.T.numpy(), SR, format='MP3', subtype='MPEG_LAYER_III', bitrate_mode='CONSTANT', compression_level=0.7)
    meta.append({'id': tid, 'bpm': bpm, 'seed': seed, 'seconds': round(L / SR, 2), 'prompt': prompt})
    print(f'{tid}: start bar {k}, {L/SR:.1f}s ({time.perf_counter()-t0:.1f}s)', flush=True)
(OUT / ('bgm.json' if not only else 'bgm-partial.json')).write_text(json.dumps({'negative_prompt': NEG, 'items': meta}, indent=2), encoding='utf-8')
print('DONE', OUT)
