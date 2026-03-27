"""
RollPay SFX Generator v3
Arcade / Cartoony / Polished Game Audio

Run:
    pip install numpy scipy
    python generate_sfx.py
"""

import numpy as np
from scipy.io.wavfile import write
import os, zipfile

SR = 44100

# -------------------------
# Core helpers
# -------------------------
def save(path, data):
    data = np.clip(data, -1, 1)
    write(path, SR, (data * 32767).astype(np.int16))

def tspace(dur):
    return np.linspace(0, dur, int(SR * dur), False)

def adsr(n, a=0.01, d=0.1, s=0.5, r=0.2):
    env = np.zeros(n)
    A = int(n * a)
    D = int(n * d)
    R = int(n * r)
    S = n - (A + D + R)

    if A > 0:
        env[:A] = np.linspace(0, 1, A)
    if D > 0:
        env[A:A+D] = np.linspace(1, s, D)
    if S > 0:
        env[A+D:A+D+S] = s
    if R > 0:
        env[-R:] = np.linspace(s, 0, R)

    return env

def noise(n):
    return np.random.uniform(-1, 1, n)

def sine(freq, t):
    return np.sin(2 * np.pi * freq * t)

def pitch_sweep(f0, f1, t):
    return np.sin(2*np.pi * (f0 + (f1 - f0) * t) * t)

def stereoize(mono, width=0.3):
    delay = int(0.002 * SR)
    right = np.roll(mono, delay) * (1 - width)
    left = mono
    return np.vstack([left, right]).T

# -------------------------
# SOUND DESIGN
# -------------------------

# Beer Clink
def beer_clink():
    dur = 0.25
    t = tspace(dur)
    n = len(t)

    freqs = [1400, 1900, 2400]
    freqs = [f + np.random.randint(-200, 200) for f in freqs]

    signal = sum(sine(f, t) for f in freqs)

    transient = noise(n) * 0.2
    env = adsr(n, 0.001, 0.05, 0.3, 0.4)

    return stereoize((signal + transient) * env * 0.6)

# Punch
def punch():
    dur = 0.15
    t = tspace(dur)
    n = len(t)

    thump = pitch_sweep(120, 60, t)
    snap = noise(n)

    env = adsr(n, 0.001, 0.05, 0.2, 0.3)

    return stereoize((thump * 0.7 + snap * 0.3) * env)

# Dart
def dart():
    dur = 0.25
    t = tspace(dur)
    n = len(t)

    whoosh = noise(n) * np.linspace(1, 0, n)
    hit = sine(2500 + np.random.randint(-400, 400), t) * adsr(n,0.001,0.05,0,0.1)

    return stereoize((whoosh * 0.6 + hit * 0.5))

# Roulette Spin
def roulette():
    dur = 1.2
    t = tspace(dur)
    n = len(t)

    wobble = np.sin(2*np.pi*(120 + 80*np.sin(2*np.pi*4*t))*t)
    env = np.linspace(1, 0.2, n)

    return stereoize(wobble * env * 0.5)

# Victory
def victory():
    notes = [800, 1100, 1500]
    parts = []

    for f in notes:
        dur = 0.15
        t = tspace(dur)
        parts.append(sine(f + np.random.randint(-50,50), t))

    signal = np.concatenate(parts)
    env = adsr(len(signal), 0.01, 0.1, 0.7, 0.2)

    return stereoize(signal * env * 0.6)

# Losing
def losing():
    notes = [1100, 800, 500]
    parts = []

    for f in notes:
        dur = 0.18
        t = tspace(dur)
        parts.append(sine(f, t))

    signal = np.concatenate(parts)
    env = adsr(len(signal), 0.01, 0.1, 0.5, 0.4)

    return stereoize(signal * env * 0.6)

# Fizzy
def fizzy():
    dur = 1.5
    t = tspace(dur)
    n = len(t)

    bubbles = noise(n)
    env = np.exp(-np.linspace(0, 3, n))

    return stereoize(bubbles * env * 0.5)

# -------------------------
# GENERATION
# -------------------------

SOUNDS = {
    "beer_clink": beer_clink,
    "punch": punch,
    "dart": dart,
    "roulette": roulette,
    "victory": victory,
    "losing": losing,
    "fizzy": fizzy,
}

OUTPUT = "rollpay_sfx_v3"
os.makedirs(OUTPUT, exist_ok=True)

VARIATIONS = 5

for name, func in SOUNDS.items():
    for i in range(VARIATIONS):
        audio = func()
        save(f"{OUTPUT}/{name}_{i}.wav", audio)

# Zip
zip_path = "rollpay_sfx_v3.zip"
with zipfile.ZipFile(zip_path, 'w') as z:
    for f in os.listdir(OUTPUT):
        z.write(os.path.join(OUTPUT, f), arcname=f)

print(" Done. Pro-level SFX generated.")
