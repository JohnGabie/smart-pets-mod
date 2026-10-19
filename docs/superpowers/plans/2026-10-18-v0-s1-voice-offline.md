# V0-S1 Voice Cue Recognition, Offline Part — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Project roles, tiers and the PR flow in `CLAUDE.md` and `agents/` apply to every task.

**Goal:** A pure-Java offline harness that answers, with numbers and confidence intervals from the maintainer's own recordings, whether user-trained voice cues (commands and pet names, PT-BR and EN) can be recognized reliably enough for S1: a `CueRecognizer` interface, an MFCC + DTW template matcher with a strictness parameter, a sidecar slot for an external engine, a corpus manifest and validator, a recording script, and an evaluation report (accuracy, false accepts, confusion, latency).

**Architecture:** DSP and recognizers live in `core` (`dev.smartpets.core.voice`, zero Minecraft/Fabric imports, JDK only; may graduate to V1 if ADR-0006 says so). Evaluation tooling lives in a new plain-Java Gradle project `tools/voice-eval` (`:voice-eval`, `application` plugin, depends on `:core`, never bundled into the mod jar, never graduates). External engines (Vosk, sherpa-onnx, whisper.cpp) are NOT linked into the JVM: they plug in as a sidecar process behind the same interface through a one-line stdout protocol, so no Gradle module gets a native dependency. Audio lives outside the repository in `$SMARTPETS_VOICE_CORPUS`.

**Tech Stack:** Java 25 (Temurin 25.0.4.1+1), Gradle 9.7.1 wrapper, JUnit 6.1.3 (BOM), `javax.sound.sampled` (JDK) for WAV I/O, sox `rec`/`soxi`/`play` for recording (installed per `MODLOG.md`). No third-party libraries.

**Spec:** `docs/spec/V0-SPIKES.md` (S1), `docs/spec/SPEC.md` §3 (voice DSP in `core`), §8 (cues), §17 (voice input, privacy), `specs/UNSPECIFIED.md` row 6, `docs/adr/0001-stack-pin.md`, `CLAUDE.md`.

## Global Constraints

- NO text-to-speech, voice cloning or synthetic speech anywhere: not in fixtures, tests, augmentation or demos. The only speech is the maintainer's own recordings (a second speaker is desirable, not required).
- Unit tests use mathematically generated signals (sine, chirp, uniform noise, silence) to verify DSP math and plumbing only. Test names and the ADR never claim recognition quality from them.
- Recordings are personal data. They live only under `$SMARTPETS_VOICE_CORPUS` (outside the repo; the recording script refuses a path inside it). Never commit audio, per-file reports, or the corpus path. Committed: schema, an example manifest with rows labeled `FAKE ROW`, prompts, scripts, code, aggregate reports approved by the human.
- `core` imports only `java.*`/`javax.*` (the existing `CoreBoundaryTest` scans `core/src/main/java` recursively). No native code in any module.
- Numbers in `Config.defaults()` (thresholds, margins, frame sizes) are starting EXAMPLES; they are config, chosen on the `tune` split, never on `test`/`holdout`.
- Code is GPL-3.0-or-later. Any future engine must be GPLv3-compatible, pinned, and recorded in ADR-0006 and `ASSETS.md` if it ships data.
- The strictness-to-intelligence mapping is NOT decided here (open question); the matcher only exposes `strictness` in [0, 1], 1 = strictest.
- Tiers: FAST = RÁPIDO, MEDIUM = MÉDIO, STRONG = FORTE (`agents/modelos.md`). One task = one branch = one PR; branches are stacked in task order unless marked parallel.
- Commits: Conventional Commits; trailer lines as given by the executing harness for the executing model (no model names in repo files, see `agents/modelos.md`). Run `bash scripts/qa/leak-check.sh` before every commit. Never commit to `main`.
- No absolute paths, usernames or e-mails in any committed file. Commands run from the repository root.
- Machine has ~7 GB RAM: `voice-eval` runs with `-Xmx1g`; never alongside a running game instance.

## Review Focus

- Split leakage: templates taken from `test`/`holdout`, or thresholds chosen by looking at `test`. Tests: `EvaluatorTest.enrollmentOnlyFromTune` (Task 8); `--sweep` refused outside `tune`; `holdout` needs `--allow-holdout`.
- One session split across `tune` and `test` (near-duplicate takes inflate scores). Test: `ManifestTest.sessionInTwoSplitsIsAnError` (Task 7); the recording script refuses it.
- Audio or the corpus path reaching git. Test: leak-check fails on a force-added `.wav` (Task 1).
- DSP silently wrong (FFT bin order, mel off-by-one, DCT scaling) while recognition "seems fine". Tests: known sine peak bin, Parseval, filterbank coverage, gain invariance (Tasks 2–3).
- Endpointer dropping a whole utterance (clip with no lead silence) or keeping key clicks. Test: `allLoudClipIsOneSegment` (Task 4); `minSpeechFrames` drops bursts under 80 ms.
- Strictness not monotonic (a stricter setting accepting something a looser one rejects). Test: `strictnessIsMonotonic` (Task 6).
- Quality claims from generated signals. Reviewer checks every claim in MODLOG/ADR cites a corpus report.
- `.ogg` must stay usable for future game sound assets: only `mod/src/main/resources/assets/**.ogg` is allowed by leak-check.

## File Structure

```
.gitignore                                   (modify: audio patterns, voice-corpus/)
scripts/qa/leak-check.sh                     (modify: fail on audio files and on the corpus path)
settings.gradle                              (modify: include voice-eval)
core/src/main/java/dev/smartpets/core/voice/
  Fft.java Frames.java FeatureConfig.java Mfcc.java Endpointer.java Dtw.java
  CueRecognizer.java Recognition.java TemplateMatcher.java WavIo.java
core/src/test/java/dev/smartpets/core/voice/
  Signals.java FftFramesTest.java MfccTest.java EndpointerTest.java DtwTest.java
  TemplateMatcherTest.java WavIoTest.java
tools/voice-eval/build.gradle
tools/voice-eval/src/main/java/dev/smartpets/voiceeval/
  Row.java Manifest.java Stats.java Evaluator.java Report.java ExternalProcessRecognizer.java VoiceEvalMain.java
tools/voice-eval/src/test/java/dev/smartpets/voiceeval/
  ManifestTest.java StatsTest.java EvaluatorTest.java ExternalProcessRecognizerTest.java
specs/voice/MANIFEST-SCHEMA.md  specs/voice/manifest.example.tsv  specs/voice/prompts.tsv
scripts/voice/record-prompts.sh
docs/adr/0006-voice-cue-recognition.md       (skeleton, Task 12)
$SMARTPETS_VOICE_CORPUS/ (OUTSIDE the repo)  manifest.tsv  audio/<session>/<phrase_id>__t<take>.wav  reports/
```

---

### Task 1: Privacy guards and the `voice-eval` project skeleton

Tier: FAST. Branch: `feat/s1-guards`. Depends on nothing.

**Files:**
- Modify: `.gitignore`, `scripts/qa/leak-check.sh`, `settings.gradle`
- Create: `tools/voice-eval/build.gradle`

**Interfaces:**
- Produces: project `:voice-eval` (dir `tools/voice-eval`); `./gradlew :voice-eval:run --args="..."` (main class arrives in Task 8); leak-check exit 1 on tracked audio.

- [ ] **Step 1: Append to `.gitignore`**

```
# Voice corpus: personal data, never in git (V0-S1, ADR-0006)
*.wav
*.flac
*.opus
*.mp3
*.m4a
voice-corpus/
```
(`.ogg` is deliberately not ignored: game sound assets use it.)

- [ ] **Step 2: Extend `scripts/qa/leak-check.sh`** — insert after the line `files=$(echo "$files" | grep -vE "$excl" || true)`:

```bash
audio=$(echo "$files" | sort -u | grep -iE '\.(wav|flac|ogg|opus|mp3|m4a)$' | grep -vE '^mod/src/main/resources/assets/.*\.ogg$' || true)
if [ -n "$audio" ]; then echo "LEAK CHECK FAILED (audio must stay outside git):"; echo "$audio"; exit 1; fi
if [ -n "${SMARTPETS_VOICE_CORPUS:-}" ]; then
  cp=$(echo "$files" | sort -u | xargs -r grep -lF -- "$SMARTPETS_VOICE_CORPUS" 2>/dev/null || true)
  if [ -n "$cp" ]; then echo "LEAK CHECK FAILED (voice corpus path in):"; echo "$cp"; exit 1; fi
fi
```

- [ ] **Step 3: Verify the guard fails on a force-added WAV, then clean up**

```bash
printf 'RIFF' > probe.wav && git add -f probe.wav
bash scripts/qa/leak-check.sh; echo "exit=$?"
git rm -q --cached probe.wav && rm probe.wav
bash scripts/qa/leak-check.sh
```
Expected: first run prints `LEAK CHECK FAILED (audio must stay outside git):` and `probe.wav`, `exit=1`; last run `leak-check: clean`. `git status` shows no `probe.wav`.

- [ ] **Step 4: Register the project** — in `settings.gradle` replace `include 'core', 'mod'` with:

```groovy
include 'core', 'mod', 'voice-eval'
project(':voice-eval').projectDir = file('tools/voice-eval')
```
`tools/voice-eval/build.gradle`:
```groovy
plugins { id 'application' }
repositories { mavenCentral() }
java {
	sourceCompatibility = JavaVersion.VERSION_25
	targetCompatibility = JavaVersion.VERSION_25
}
tasks.withType(JavaCompile).configureEach { it.options.release = 25 }
dependencies {
	implementation project(':core')
	testImplementation platform('org.junit:junit-bom:6.1.3')
	testImplementation 'org.junit.jupiter:junit-jupiter'
	testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}
application {
	mainClass = 'dev.smartpets.voiceeval.VoiceEvalMain'
	applicationDefaultJvmArgs = ['-Xmx1g']
}
test { useJUnitPlatform() }
```

- [ ] **Step 5: Build, log, commit**

Run: `./gradlew build` → BUILD SUCCESSFUL (`:voice-eval` has no sources yet). Confirm `unzip -l mod/build/libs/smartpets-0.0.0-dev.jar | grep -i voice` prints nothing.
Append to `MODLOG.md`: S1 guards added, audio patterns, why `.ogg` is exempt under `assets/`.
```bash
bash scripts/qa/leak-check.sh
git add .gitignore scripts/qa/leak-check.sh settings.gradle tools/voice-eval/build.gradle MODLOG.md
git commit -m "chore: add voice corpus privacy guards and voice-eval project"
```

---

### Task 2: FFT, pre-emphasis, framing, window

Tier: FAST. Branch: `feat/s1-fft`. Depends on Task 1 (parallel-safe with Task 5).

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/voice/{Fft.java, Frames.java}`, `core/src/test/java/dev/smartpets/core/voice/{Signals.java, FftFramesTest.java}`

**Interfaces:**
- Produces: `Fft.transform(double[] re, double[] im)` (in place, radix-2), `Fft.powerSpectrum(double[] frame, int n) : double[n/2+1]`; `Frames.samples(int sr, double ms)`, `preEmphasis(float[], double) : double[]`, `frame(double[], int len, int hop) : double[][]`, `hamming(int) : double[]`; test helper `Signals` (sine, chirp, noise, concat, plus, utterance).

- [ ] **Step 1: Write the test helper (generated signals, not speech)**

`core/src/test/java/dev/smartpets/core/voice/Signals.java`:
```java
package dev.smartpets.core.voice;

import java.util.Random;

/** Mathematically generated test signals. Plumbing only: never evidence of recognition quality. */
final class Signals {
	private Signals() {
	}

	static int len(double seconds, int sr) {
		return (int) Math.round(seconds * sr);
	}

	static float[] sine(double hz, double seconds, double amp, int sr) {
		float[] x = new float[len(seconds, sr)];
		for (int i = 0; i < x.length; i++) x[i] = (float) (amp * Math.sin(2 * Math.PI * hz * i / sr));
		return x;
	}

	static float[] chirp(double f0, double f1, double seconds, double amp, int sr) {
		float[] x = new float[len(seconds, sr)];
		for (int i = 0; i < x.length; i++) {
			double t = (double) i / sr;
			x[i] = (float) (amp * Math.sin(2 * Math.PI * (f0 * t + (f1 - f0) * t * t / (2 * seconds))));
		}
		return x;
	}

	static float[] noise(double seconds, double amp, int sr, long seed) {
		Random r = new Random(seed);
		float[] x = new float[len(seconds, sr)];
		for (int i = 0; i < x.length; i++) x[i] = (float) (amp * (2 * r.nextDouble() - 1));
		return x;
	}

	static float[] concat(float[]... parts) {
		int n = 0;
		for (float[] p : parts) n += p.length;
		float[] out = new float[n];
		int o = 0;
		for (float[] p : parts) {
			System.arraycopy(p, 0, out, o, p.length);
			o += p.length;
		}
		return out;
	}

	static float[] plus(float[] a, float[] b) {
		float[] out = a.clone();
		for (int i = 0; i < Math.min(a.length, b.length); i++) out[i] += b[i];
		return out;
	}

	/** 0.2 s of low noise, the signal with low noise added, 0.2 s of low noise. */
	static float[] utterance(float[] core, int sr, long seed) {
		return concat(noise(0.2, 1e-3, sr, seed), plus(core, noise((double) core.length / sr, 1e-3, sr, seed + 1)),
			noise(0.2, 1e-3, sr, seed + 2));
	}
}
```

- [ ] **Step 2: Write the failing tests**

`core/src/test/java/dev/smartpets/core/voice/FftFramesTest.java`:
```java
package dev.smartpets.core.voice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Random;
import org.junit.jupiter.api.Test;

class FftFramesTest {
	@Test
	void sineLandsInItsBin() {
		float[] s = Signals.sine(1000, 512 / 16000.0, 0.5, 16000);
		double[] frame = new double[512];
		for (int i = 0; i < 512; i++) frame[i] = s[i];
		double[] p = Fft.powerSpectrum(frame, 512);
		int arg = 0;
		for (int k = 1; k < p.length; k++) if (p[k] > p[arg]) arg = k;
		assertEquals(32, arg); // 1000 Hz * 512 / 16000 Hz
		for (int k = 0; k < p.length; k++) if (k != 32) assertTrue(p[k] < 1e-6 * p[32], "leak at bin " + k);
	}

	@Test
	void parsevalHolds() {
		Random r = new Random(7);
		int n = 256;
		double[] re = new double[n], im = new double[n];
		double time = 0;
		for (int i = 0; i < n; i++) {
			re[i] = r.nextGaussian();
			time += re[i] * re[i];
		}
		Fft.transform(re, im);
		double freq = 0;
		for (int k = 0; k < n; k++) freq += re[k] * re[k] + im[k] * im[k];
		assertEquals(time * n, freq, 1e-9 * freq);
	}

	@Test
	void preEmphasisOfConstant() {
		double[] y = Frames.preEmphasis(new float[] {1, 1, 1}, 0.97);
		assertEquals(1.0, y[0], 1e-12);
		assertEquals(0.03, y[1], 1e-6);
		assertEquals(0.03, y[2], 1e-6);
	}

	@Test
	void framingCountsAndOffsets() {
		double[] x = new double[16000];
		for (int i = 0; i < x.length; i++) x[i] = i;
		double[][] f = Frames.frame(x, Frames.samples(16000, 25), Frames.samples(16000, 10));
		assertEquals(98, f.length); // 1 + (16000 - 400) / 160
		assertEquals(400, f[0].length);
		assertEquals(160.0, f[1][0]);
		assertEquals(0, Frames.frame(new double[399], 400, 160).length);
	}

	@Test
	void hammingShape() {
		double[] w = Frames.hamming(401);
		assertEquals(0.08, w[0], 1e-12);
		assertEquals(1.0, w[200], 1e-12);
		for (int i = 0; i < w.length; i++) assertEquals(w[i], w[w.length - 1 - i], 1e-12);
	}
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `./gradlew :core:test --tests 'dev.smartpets.core.voice.*'`
Expected: FAIL (compile error: `Fft`, `Frames` not found).

- [ ] **Step 4: Implement**

`core/src/main/java/dev/smartpets/core/voice/Fft.java`:
```java
package dev.smartpets.core.voice;

/** Iterative radix-2 complex FFT (Cooley-Tukey), in place. */
public final class Fft {
	private Fft() {
	}

	public static void transform(double[] re, double[] im) {
		int n = re.length;
		if (n != im.length || Integer.bitCount(n) != 1) throw new IllegalArgumentException("length must be a power of two");
		for (int i = 1, j = 0; i < n; i++) {
			int bit = n >> 1;
			for (; (j & bit) != 0; bit >>= 1) j ^= bit;
			j ^= bit;
			if (i < j) {
				double t = re[i]; re[i] = re[j]; re[j] = t;
				t = im[i]; im[i] = im[j]; im[j] = t;
			}
		}
		for (int len = 2; len <= n; len <<= 1) {
			double ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
			int half = len / 2;
			for (int i = 0; i < n; i += len) {
				double cr = 1, ci = 0;
				for (int k = 0; k < half; k++) {
					int a = i + k, b = a + half;
					double xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
					re[b] = re[a] - xr; im[b] = im[a] - xi;
					re[a] += xr; im[a] += xi;
					double t = cr * wr - ci * wi;
					ci = cr * wi + ci * wr;
					cr = t;
				}
			}
		}
	}

	/** |X[k]|^2 for k = 0..n/2 of a real frame, zero-padded (or truncated) to n. */
	public static double[] powerSpectrum(double[] frame, int n) {
		double[] re = new double[n], im = new double[n];
		System.arraycopy(frame, 0, re, 0, Math.min(frame.length, n));
		transform(re, im);
		double[] p = new double[n / 2 + 1];
		for (int k = 0; k <= n / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
		return p;
	}
}
```
`core/src/main/java/dev/smartpets/core/voice/Frames.java`:
```java
package dev.smartpets.core.voice;

import java.util.Arrays;

public final class Frames {
	private Frames() {
	}

	public static int samples(int sampleRate, double ms) {
		return (int) Math.round(sampleRate * ms / 1000.0);
	}

	/** y[0] = x[0]; y[i] = x[i] - a * x[i-1]. */
	public static double[] preEmphasis(float[] x, double a) {
		double[] y = new double[x.length];
		for (int i = 0; i < x.length; i++) y[i] = x[i] - (i > 0 ? a * x[i - 1] : 0);
		return y;
	}

	/** Full frames only; a signal shorter than one frame yields zero frames. */
	public static double[][] frame(double[] x, int len, int hop) {
		if (len < 1 || hop < 1) throw new IllegalArgumentException("len and hop must be >= 1");
		if (x.length < len) return new double[0][];
		double[][] f = new double[1 + (x.length - len) / hop][];
		for (int i = 0; i < f.length; i++) f[i] = Arrays.copyOfRange(x, i * hop, i * hop + len);
		return f;
	}

	public static double[] hamming(int n) {
		double[] w = new double[n];
		if (n == 1) {
			w[0] = 1;
			return w;
		}
		for (int i = 0; i < n; i++) w[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1));
		return w;
	}
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `./gradlew :core:test`
Expected: BUILD SUCCESSFUL; `FftFramesTest` 5 tests pass; `CoreBoundaryTest` still passes.

- [ ] **Step 6: Leak check, log, commit**

```bash
bash scripts/qa/leak-check.sh
git add core/src && git commit -m "feat(core): add FFT and framing for voice features"
```

---

### Task 3: MFCC features

Tier: MEDIUM. Branch: `feat/s1-mfcc`. Depends on Task 2.

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/voice/{FeatureConfig.java, Mfcc.java}`, `core/src/test/java/dev/smartpets/core/voice/MfccTest.java`

**Interfaces:**
- Produces: `record FeatureConfig(double frameMs, double hopMs, double preEmphasis, int melBands, int numCeps, double lowHz, double highHz, boolean cmn, boolean deltas)` with `defaults()` = (25, 10, 0.97, 26, 13, 20, 8000, true, false); `Mfcc.compute(float[] pcm, int sampleRate, FeatureConfig) : double[frames][numCeps or 2*numCeps]`; `Mfcc.hzToMel`, `melToHz`, `filterbank(bands, nfft, sr, lowHz, highHz)`, `dct2(double[], int)`. Works at any sample rate (16 kHz and the corpus 48 kHz): frame sizes come from milliseconds, FFT size is the next power of two.

- [ ] **Step 1: Write the failing tests**

`core/src/test/java/dev/smartpets/core/voice/MfccTest.java`:
```java
package dev.smartpets.core.voice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class MfccTest {
	private static final FeatureConfig D = FeatureConfig.defaults();

	@Test
	void melScaleRoundTrips() {
		assertEquals(781.17, Mfcc.hzToMel(700), 0.01);
		for (double hz : new double[] {20, 440, 4000, 8000}) assertEquals(hz, Mfcc.melToHz(Mfcc.hzToMel(hz)), 1e-9);
	}

	@Test
	void filterbankHasNoEmptyBand() {
		for (int[] sn : new int[][] {{16000, 512}, {48000, 2048}}) {
			double[][] fb = Mfcc.filterbank(26, sn[1], sn[0], 20, 8000);
			for (int b = 0; b < fb.length; b++) {
				double max = 0;
				for (double v : fb[b]) max = Math.max(max, v);
				assertTrue(max > 0.5, "band " + b + " nearly empty at " + sn[0] + " Hz");
			}
		}
	}

	@Test
	void dctOfConstantHasOnlyC0() {
		double[] in = new double[26];
		java.util.Arrays.fill(in, 2.0);
		double[] c = Mfcc.dct2(in, 13);
		assertEquals(52.0, c[0], 1e-9);
		for (int i = 1; i < 13; i++) assertEquals(0.0, c[i], 1e-9);
	}

	@Test
	void shapeForOneSecond() {
		double[][] f = Mfcc.compute(Signals.sine(440, 1.0, 0.3, 16000), 16000, D);
		assertEquals(98, f.length);
		assertEquals(13, f[0].length);
	}

	@Test
	void gainDoesNotChangeFeaturesWithCmn() {
		float[] x = Signals.plus(Signals.chirp(300, 3000, 1.0, 0.2, 16000), Signals.noise(1.0, 0.01, 16000, 3));
		float[] y = x.clone();
		for (int i = 0; i < y.length; i++) y[i] *= 2;
		double[][] a = Mfcc.compute(x, 16000, D), b = Mfcc.compute(y, 16000, D);
		for (int t = 0; t < a.length; t++) for (int i = 0; i < a[t].length; i++) assertEquals(a[t][i], b[t][i], 1e-6);
	}

	@Test
	void differentTonesDiffer() {
		FeatureConfig noCmn = new FeatureConfig(25, 10, 0.97, 26, 13, 20, 8000, false, false);
		double[][] a = Mfcc.compute(Signals.sine(500, 0.5, 0.3, 16000), 16000, noCmn);
		double[][] b = Mfcc.compute(Signals.sine(3000, 0.5, 0.3, 16000), 16000, noCmn);
		double sum = 0;
		for (int t = 0; t < a.length; t++) for (int i = 0; i < 13; i++) sum += Math.abs(a[t][i] - b[t][i]);
		assertTrue(sum / (a.length * 13) > 1.0);
	}

	@Test
	void deltasDoubleTheWidth() {
		FeatureConfig withDeltas = new FeatureConfig(25, 10, 0.97, 26, 13, 20, 8000, true, true);
		assertEquals(26, Mfcc.compute(Signals.sine(440, 0.5, 0.3, 48000), 48000, withDeltas)[0].length);
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :core:test --tests 'dev.smartpets.core.voice.MfccTest'`
Expected: FAIL (compile error: `FeatureConfig`, `Mfcc` not found).

- [ ] **Step 3: Implement**

`core/src/main/java/dev/smartpets/core/voice/FeatureConfig.java`:
```java
package dev.smartpets.core.voice;

/** MFCC settings. Values are starting examples; tune on the corpus tune split. */
public record FeatureConfig(double frameMs, double hopMs, double preEmphasis, int melBands, int numCeps,
		double lowHz, double highHz, boolean cmn, boolean deltas) {
	public static FeatureConfig defaults() {
		return new FeatureConfig(25, 10, 0.97, 26, 13, 20, 8000, true, false);
	}
}
```
`core/src/main/java/dev/smartpets/core/voice/Mfcc.java`:
```java
package dev.smartpets.core.voice;

/** Pre-emphasis, Hamming frames, power spectrum, mel filterbank, log, DCT-II, optional CMN and deltas. */
public final class Mfcc {
	private Mfcc() {
	}

	public static double hzToMel(double hz) {
		return 2595 * Math.log10(1 + hz / 700);
	}

	public static double melToHz(double mel) {
		return 700 * (Math.pow(10, mel / 2595) - 1);
	}

	static int fftSizeFor(int frameLen) {
		int n = 1;
		while (n < frameLen) n <<= 1;
		return n;
	}

	/** Triangular filters equally spaced in mel; weights evaluated at each bin's frequency (no empty bands). */
	public static double[][] filterbank(int bands, int nfft, int sr, double lowHz, double highHz) {
		double ml = hzToMel(lowHz), mh = hzToMel(Math.min(highHz, sr / 2.0));
		double[] edge = new double[bands + 2];
		for (int i = 0; i < edge.length; i++) edge[i] = melToHz(ml + (mh - ml) * i / (bands + 1));
		double[][] fb = new double[bands][nfft / 2 + 1];
		for (int b = 0; b < bands; b++) {
			double l = edge[b], c = edge[b + 1], r = edge[b + 2];
			for (int k = 0; k <= nfft / 2; k++) {
				double f = (double) k * sr / nfft;
				if (f > l && f < r) fb[b][k] = f <= c ? (f - l) / (c - l) : (r - f) / (r - c);
			}
		}
		return fb;
	}

	/** Unnormalized DCT-II: c[i] = sum_m x[m] cos(pi i (m + 0.5) / M). */
	public static double[] dct2(double[] x, int n) {
		double[] c = new double[n];
		for (int i = 0; i < n; i++) {
			double s = 0;
			for (int m = 0; m < x.length; m++) s += x[m] * Math.cos(Math.PI * i * (m + 0.5) / x.length);
			c[i] = s;
		}
		return c;
	}

	public static double[][] compute(float[] pcm, int sr, FeatureConfig cfg) {
		int fl = Frames.samples(sr, cfg.frameMs()), hop = Frames.samples(sr, cfg.hopMs());
		double[][] frames = Frames.frame(Frames.preEmphasis(pcm, cfg.preEmphasis()), fl, hop);
		if (frames.length == 0) return new double[0][];
		double[] w = Frames.hamming(fl);
		int nfft = fftSizeFor(fl);
		double[][] fb = filterbank(cfg.melBands(), nfft, sr, cfg.lowHz(), cfg.highHz());
		double[][] out = new double[frames.length][];
		for (int t = 0; t < frames.length; t++) {
			double[] fr = frames[t];
			for (int i = 0; i < fl; i++) fr[i] *= w[i];
			double[] p = Fft.powerSpectrum(fr, nfft);
			double[] logE = new double[cfg.melBands()];
			for (int b = 0; b < logE.length; b++) {
				double e = 0;
				for (int k = 0; k < p.length; k++) e += fb[b][k] * p[k];
				logE[b] = Math.log(Math.max(e, 1e-10));
			}
			out[t] = dct2(logE, cfg.numCeps());
		}
		if (cfg.cmn()) {
			for (int i = 0; i < cfg.numCeps(); i++) {
				double mean = 0;
				for (double[] v : out) mean += v[i];
				mean /= out.length;
				for (double[] v : out) v[i] -= mean;
			}
		}
		if (!cfg.deltas()) return out;
		int n = cfg.numCeps();
		double[][] wide = new double[out.length][2 * n];
		for (int t = 0; t < out.length; t++) {
			double[] prev = out[Math.max(0, t - 1)], next = out[Math.min(out.length - 1, t + 1)];
			System.arraycopy(out[t], 0, wide[t], 0, n);
			for (int i = 0; i < n; i++) wide[t][n + i] = (next[i] - prev[i]) / 2;
		}
		return wide;
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :core:test`
Expected: BUILD SUCCESSFUL; `MfccTest` 7 tests pass.

- [ ] **Step 5: Leak check, commit**

```bash
bash scripts/qa/leak-check.sh
git add core/src && git commit -m "feat(core): add MFCC feature extraction"
```

---

### Task 4: Energy endpoint detection

Tier: MEDIUM. Branch: `feat/s1-endpoint`. Depends on Task 2.

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/voice/Endpointer.java`, `core/src/test/java/dev/smartpets/core/voice/EndpointerTest.java`

**Interfaces:**
- Produces: `Endpointer.Config(frameMs, hopMs, marginDb, floorPercentile, absoluteMinDb, ceilingDb, minSpeechFrames, hangoverFrames, padFrames)` with `defaults()` = (20, 10, 12, 0.10, -55, -30, 8, 15, 5); `record Segment(int start, int end)` (samples, end exclusive); `segments(float[], int sr, Config) : List<Segment>`; `trim(float[], int sr, Config) : float[]` (first start to last end; empty when no speech). Threshold = `max(absoluteMinDb, min(floor + marginDb, ceilingDb))`, floor = energy percentile: a clip with no lead silence still yields speech (ceiling); runs shorter than 80 ms (key clicks) are dropped.

- [ ] **Step 1: Write the failing tests**

`core/src/test/java/dev/smartpets/core/voice/EndpointerTest.java`:
```java
package dev.smartpets.core.voice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class EndpointerTest {
	private static final int SR = 16000;
	private static final Endpointer.Config C = Endpointer.Config.defaults();

	private static float[] quiet(double s, long seed) {
		return Signals.noise(s, 1e-3, SR, seed);
	}

	@Test
	void findsOneBurstWithPadding() {
		float[] x = Signals.concat(quiet(0.3, 1), Signals.sine(440, 0.5, 0.3, SR), quiet(0.3, 2));
		List<Endpointer.Segment> s = Endpointer.segments(x, SR, C);
		assertEquals(1, s.size());
		double start = s.get(0).start() / (double) SR, end = s.get(0).end() / (double) SR;
		assertTrue(start >= 0.18 && start <= 0.31, "start " + start);
		assertTrue(end >= 0.79 && end <= 0.92, "end " + end);
	}

	@Test
	void silenceHasNoSpeech() {
		assertTrue(Endpointer.segments(quiet(1.0, 3), SR, C).isEmpty());
		assertEquals(0, Endpointer.trim(quiet(1.0, 3), SR, C).length);
	}

	@Test
	void twoBurstsFarApartAreTwoSegments() {
		float[] x = Signals.concat(quiet(0.3, 4), Signals.sine(440, 0.4, 0.3, SR), quiet(1.0, 5),
			Signals.sine(880, 0.4, 0.3, SR), quiet(0.3, 6));
		assertEquals(2, Endpointer.segments(x, SR, C).size());
		float[] t = Endpointer.trim(x, SR, C);
		assertTrue(t.length > Signals.len(1.8, SR) && t.length < x.length);
	}

	@Test
	void allLoudClipIsOneSegment() {
		float[] x = Signals.sine(440, 1.0, 0.3, SR);
		List<Endpointer.Segment> s = Endpointer.segments(x, SR, C);
		assertEquals(1, s.size());
		assertEquals(0, s.get(0).start());
	}

	@Test
	void shortClickIsDropped() {
		float[] x = Signals.concat(quiet(0.3, 7), Signals.noise(0.03, 0.5, SR, 8), quiet(0.5, 9));
		assertTrue(Endpointer.segments(x, SR, C).isEmpty());
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :core:test --tests 'dev.smartpets.core.voice.EndpointerTest'`
Expected: FAIL (compile error: `Endpointer` not found).

- [ ] **Step 3: Implement**

`core/src/main/java/dev/smartpets/core/voice/Endpointer.java`:
```java
package dev.smartpets.core.voice;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Energy-based speech endpoint detection with an adaptive noise floor. */
public final class Endpointer {
	public record Config(double frameMs, double hopMs, double marginDb, double floorPercentile, double absoluteMinDb,
			double ceilingDb, int minSpeechFrames, int hangoverFrames, int padFrames) {
		public static Config defaults() {
			return new Config(20, 10, 12, 0.10, -55, -30, 8, 15, 5);
		}
	}

	public record Segment(int start, int end) {
	}

	private Endpointer() {
	}

	public static List<Segment> segments(float[] x, int sr, Config c) {
		int fl = Frames.samples(sr, c.frameMs()), hop = Frames.samples(sr, c.hopMs());
		if (x.length < fl) return List.of();
		int nf = 1 + (x.length - fl) / hop;
		double[] db = new double[nf];
		for (int f = 0; f < nf; f++) {
			double s = 0;
			for (int i = f * hop; i < f * hop + fl; i++) s += (double) x[i] * x[i];
			db[f] = 10 * Math.log10(s / fl + 1e-12);
		}
		double[] sorted = db.clone();
		Arrays.sort(sorted);
		double floor = sorted[(int) Math.floor(c.floorPercentile() * (nf - 1))];
		double thr = Math.max(c.absoluteMinDb(), Math.min(floor + c.marginDb(), c.ceilingDb()));
		List<int[]> runs = new ArrayList<>();
		int start = -1, last = -1;
		for (int f = 0; f < nf; f++) {
			if (db[f] > thr) {
				if (start < 0) start = f;
				last = f;
			} else if (start >= 0 && f - last > c.hangoverFrames()) {
				runs.add(new int[] {start, last});
				start = -1;
			}
		}
		if (start >= 0) runs.add(new int[] {start, last});
		List<Segment> out = new ArrayList<>();
		for (int[] r : runs) {
			if (r[1] - r[0] + 1 < c.minSpeechFrames()) continue;
			int s = Math.max(0, r[0] - c.padFrames()) * hop;
			int e = Math.min(x.length, Math.min(nf - 1, r[1] + c.padFrames()) * hop + fl);
			out.add(new Segment(s, e));
		}
		return out;
	}

	public static float[] trim(float[] x, int sr, Config c) {
		List<Segment> s = segments(x, sr, c);
		return s.isEmpty() ? new float[0] : Arrays.copyOfRange(x, s.get(0).start(), s.get(s.size() - 1).end());
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :core:test`
Expected: BUILD SUCCESSFUL; `EndpointerTest` 5 tests pass. If `findsOneBurstWithPadding` fails by a few ms, print the segment and report it to the reviewer; do not widen the bounds alone.

- [ ] **Step 5: Leak check, commit**

```bash
bash scripts/qa/leak-check.sh
git add core/src && git commit -m "feat(core): add energy endpoint detection"
```

---

### Task 5: DTW with a Sakoe-Chiba band

Tier: FAST. Branch: `feat/s1-dtw`. Depends on Task 1 (parallel-safe with Tasks 2–4).

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/voice/Dtw.java`, `core/src/test/java/dev/smartpets/core/voice/DtwTest.java`

**Interfaces:**
- Produces: `Dtw.distance(double[][] a, double[][] b, double bandFraction) : double` — Euclidean frame cost, steps (1,0)/(0,1)/(1,1), band half-width `max(|n-m|, ceil(band * max(n,m)))`, total cost divided by `n + m`; empty input gives `+Infinity`.

- [ ] **Step 1: Write the failing tests**

`core/src/test/java/dev/smartpets/core/voice/DtwTest.java`:
```java
package dev.smartpets.core.voice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DtwTest {
	private static double[][] curve(int n, double a, double b) {
		double[][] s = new double[n][];
		for (int t = 0; t < n; t++) s[t] = new double[] {Math.sin(t / a), Math.cos(t / b)};
		return s;
	}

	@Test
	void identicalIsZero() {
		double[][] a = curve(40, 5, 7);
		assertEquals(0.0, Dtw.distance(a, a, 0.1), 1e-12);
	}

	@Test
	void symmetric() {
		double[][] a = curve(40, 5, 7), b = curve(33, 3, 2);
		assertEquals(Dtw.distance(a, b, 0.2), Dtw.distance(b, a, 0.2), 1e-12);
	}

	@Test
	void timeWarpedCopyIsCloserThanADifferentSequence() {
		double[][] a = curve(40, 5, 7);
		List<double[]> w = new ArrayList<>();
		for (int t = 0; t < a.length; t++) {
			w.add(a[t]);
			if (t % 3 == 0) w.add(a[t]);
		}
		double[][] warped = w.toArray(new double[0][]);
		double[][] other = curve(40, 2, 3);
		assertTrue(Dtw.distance(a, warped, 0.3) < Dtw.distance(a, other, 0.3));
		assertEquals(0.0, Dtw.distance(a, warped, 0.3), 1e-12);
	}

	@Test
	void zeroBandIsTheDiagonal() {
		double[][] a = curve(20, 5, 7), b = curve(20, 3, 2);
		double sum = 0;
		for (int i = 0; i < 20; i++) sum += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
		assertEquals(sum / 40, Dtw.distance(a, b, 0.0), 1e-12);
	}

	@Test
	void emptyIsInfinite() {
		assertEquals(Double.POSITIVE_INFINITY, Dtw.distance(new double[0][], curve(5, 1, 1), 0.1));
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :core:test --tests 'dev.smartpets.core.voice.DtwTest'`
Expected: FAIL (compile error: `Dtw` not found).

- [ ] **Step 3: Implement**

`core/src/main/java/dev/smartpets/core/voice/Dtw.java`:
```java
package dev.smartpets.core.voice;

import java.util.Arrays;

/** Dynamic time warping with a Sakoe-Chiba band; cost normalized by n + m. */
public final class Dtw {
	private Dtw() {
	}

	public static double distance(double[][] a, double[][] b, double bandFraction) {
		int n = a.length, m = b.length;
		if (n == 0 || m == 0) return Double.POSITIVE_INFINITY;
		int w = Math.max(Math.abs(n - m), (int) Math.ceil(bandFraction * Math.max(n, m)));
		double inf = Double.POSITIVE_INFINITY;
		double[] prev = new double[m + 1], cur = new double[m + 1];
		Arrays.fill(prev, inf);
		prev[0] = 0;
		for (int i = 1; i <= n; i++) {
			Arrays.fill(cur, inf);
			for (int j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
				double best = Math.min(prev[j - 1], Math.min(prev[j], cur[j - 1]));
				cur[j] = euclid(a[i - 1], b[j - 1]) + best;
			}
			double[] t = prev;
			prev = cur;
			cur = t;
		}
		return prev[m] / (n + m);
	}

	static double euclid(double[] x, double[] y) {
		double s = 0;
		for (int k = 0; k < x.length; k++) s += (x[k] - y[k]) * (x[k] - y[k]);
		return Math.sqrt(s);
	}
}
```

- [ ] **Step 4: Run to verify it passes, leak check, commit**

Run: `./gradlew :core:test` → BUILD SUCCESSFUL; `DtwTest` 5 tests pass.
```bash
bash scripts/qa/leak-check.sh
git add core/src && git commit -m "feat(core): add banded DTW distance"
```

---

### Task 6: `CueRecognizer` interface and the template matcher

Tier: MEDIUM (STRONG review). Branch: `feat/s1-matcher`. Depends on Tasks 3, 4, 5.

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/voice/{CueRecognizer.java, Recognition.java, TemplateMatcher.java}`, `core/src/test/java/dev/smartpets/core/voice/TemplateMatcherTest.java`

**Interfaces:**
- Produces (contract for every engine; not thread-safe, one worker thread per instance; PCM is mono float in [-1, 1] at any sample rate):
  - `CueRecognizer`: `String id()`, `void enroll(String cueId, String phraseText, float[] pcm, int sampleRate)`, `void setStrictness(double s)` (0 lenient .. 1 strict), `Recognition recognize(float[] pcm, int sampleRate)`, `default void close()`.
  - `record Recognition(String cueId, double confidence, List<Candidate> nbest)`, `Recognition.NONE = "NONE"`, `accepted()`, `none(List)`; `record Candidate(String cueId, double distance)`.
  - `TemplateMatcher(Config)`, `Config(FeatureConfig features, Endpointer.Config endpoint, double band, double singleTemplateSpread, double minSpread, double looseFactor, double strictFactor, double minMargin)`, `defaults()` = (defaults, defaults, 0.15, 25.0, 1.0, 2.0, 1.0, 0.05). Rule: best cue = smallest min-DTW over its templates; threshold = `max(minSpread, spread) * (loose + (strict - loose) * strictness)` where spread = mean pairwise DTW among the cue's templates (or `singleTemplateSpread` with one template); accept iff `best <= threshold` and `second - best >= minMargin * best`.

- [ ] **Step 1: Write the failing tests**

`core/src/test/java/dev/smartpets/core/voice/TemplateMatcherTest.java`:
```java
package dev.smartpets.core.voice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Generated chirps exercise the plumbing only. Recognition quality is measured on the maintainer's corpus. */
class TemplateMatcherTest {
	private static final int SR = 16000;

	private static float[] up(double s, long seed) {
		return Signals.utterance(Signals.chirp(300, 3000, s, 0.3, SR), SR, seed);
	}

	private static float[] down(double s, long seed) {
		return Signals.utterance(Signals.chirp(3000, 300, s, 0.3, SR), SR, seed);
	}

	private static float[] noiseBurst() {
		return Signals.utterance(Signals.noise(0.5, 0.3, SR, 99), SR, 98);
	}

	private static TemplateMatcher enrolled() {
		TemplateMatcher m = new TemplateMatcher(TemplateMatcher.Config.defaults());
		double[] d = {0.45, 0.5, 0.55};
		for (int i = 0; i < 3; i++) {
			m.enroll("UP", "up", up(d[i], 10 + i), SR);
			m.enroll("DOWN", "down", down(d[i], 20 + i), SR);
		}
		return m;
	}

	@Test
	void picksTheEnrolledPattern() {
		TemplateMatcher m = enrolled();
		assertEquals("UP", m.recognize(up(0.52, 30), SR).cueId());
		assertEquals("DOWN", m.recognize(down(0.48, 31), SR).cueId());
	}

	@Test
	void silenceIsNone() {
		Recognition r = enrolled().recognize(Signals.noise(1.0, 1e-3, SR, 5), SR);
		assertFalse(r.accepted());
	}

	@Test
	void noiseBurstRejectedWhenStrict() {
		TemplateMatcher m = enrolled();
		m.setStrictness(1.0);
		assertEquals(Recognition.NONE, m.recognize(noiseBurst(), SR).cueId());
	}

	@Test
	void strictnessIsMonotonic() {
		TemplateMatcher m = enrolled();
		for (float[] p : List.of(up(0.52, 40), down(0.48, 41), up(0.7, 42), noiseBurst())) {
			m.setStrictness(1.0);
			Recognition strict = m.recognize(p, SR);
			m.setStrictness(0.0);
			Recognition loose = m.recognize(p, SR);
			if (strict.accepted()) assertEquals(strict.cueId(), loose.cueId());
		}
	}

	@Test
	void rejectsBadInput() {
		TemplateMatcher m = enrolled();
		assertThrows(IllegalArgumentException.class, () -> m.setStrictness(1.5));
		assertThrows(IllegalArgumentException.class, () -> m.enroll("X", "x", Signals.noise(1, 1e-3, SR, 1), SR));
		assertFalse(new TemplateMatcher(TemplateMatcher.Config.defaults()).recognize(up(0.5, 1), SR).accepted());
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :core:test --tests 'dev.smartpets.core.voice.TemplateMatcherTest'`
Expected: FAIL (compile error: `TemplateMatcher` not found).

- [ ] **Step 3: Implement**

`core/src/main/java/dev/smartpets/core/voice/CueRecognizer.java`:
```java
package dev.smartpets.core.voice;

/**
 * One engine that maps an utterance to a learned cue id or NONE. Not thread-safe: one worker thread per instance.
 * PCM is mono float in [-1, 1] at the given sample rate. Template engines learn from the audio; vocabulary engines
 * may use only phraseText.
 */
public interface CueRecognizer extends AutoCloseable {
	String id();

	void enroll(String cueId, String phraseText, float[] pcm, int sampleRate);

	/** 0 = most lenient, 1 = strictest; each engine maps it to its own threshold. */
	void setStrictness(double strictness);

	Recognition recognize(float[] pcm, int sampleRate);

	@Override
	default void close() {
	}
}
```
`core/src/main/java/dev/smartpets/core/voice/Recognition.java`:
```java
package dev.smartpets.core.voice;

import java.util.List;

public record Recognition(String cueId, double confidence, List<Candidate> nbest) {
	public static final String NONE = "NONE";

	public record Candidate(String cueId, double distance) {
	}

	public Recognition {
		nbest = List.copyOf(nbest);
	}

	public static Recognition none(List<Candidate> nbest) {
		return new Recognition(NONE, 0, nbest);
	}

	public boolean accepted() {
		return !NONE.equals(cueId);
	}
}
```
`core/src/main/java/dev/smartpets/core/voice/TemplateMatcher.java`:
```java
package dev.smartpets.core.voice;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** User-trained cues: MFCC templates from a few examples, matched by banded DTW. Language-agnostic. */
public final class TemplateMatcher implements CueRecognizer {
	public record Config(FeatureConfig features, Endpointer.Config endpoint, double band, double singleTemplateSpread,
			double minSpread, double looseFactor, double strictFactor, double minMargin) {
		public static Config defaults() {
			return new Config(FeatureConfig.defaults(), Endpointer.Config.defaults(), 0.15, 25.0, 1.0, 2.0, 1.0, 0.05);
		}
	}

	private final Config cfg;
	private final Map<String, List<double[][]>> templates = new LinkedHashMap<>();
	private final Map<String, Double> spread = new HashMap<>();
	private double strictness = 0.5;

	public TemplateMatcher(Config cfg) {
		this.cfg = cfg;
	}

	@Override
	public String id() {
		return "template-mfcc-dtw";
	}

	@Override
	public void setStrictness(double s) {
		if (!(s >= 0 && s <= 1)) throw new IllegalArgumentException("strictness must be in [0, 1]: " + s);
		strictness = s;
	}

	@Override
	public void enroll(String cueId, String phraseText, float[] pcm, int sampleRate) {
		if (Recognition.NONE.equals(cueId)) throw new IllegalArgumentException("NONE is not a cue");
		double[][] f = features(pcm, sampleRate);
		if (f.length == 0) throw new IllegalArgumentException("no speech found in enrollment for " + cueId);
		List<double[][]> list = templates.computeIfAbsent(cueId, k -> new ArrayList<>());
		list.add(f);
		if (list.size() < 2) return;
		double sum = 0;
		int pairs = 0;
		for (int i = 0; i < list.size(); i++) {
			for (int j = i + 1; j < list.size(); j++) {
				sum += Dtw.distance(list.get(i), list.get(j), cfg.band());
				pairs++;
			}
		}
		spread.put(cueId, sum / pairs);
	}

	@Override
	public Recognition recognize(float[] pcm, int sampleRate) {
		if (templates.isEmpty()) return Recognition.none(List.of());
		double[][] f = features(pcm, sampleRate);
		if (f.length == 0) return Recognition.none(List.of());
		List<Recognition.Candidate> c = new ArrayList<>();
		for (var e : templates.entrySet()) {
			double best = Double.POSITIVE_INFINITY;
			for (double[][] t : e.getValue()) best = Math.min(best, Dtw.distance(f, t, cfg.band()));
			c.add(new Recognition.Candidate(e.getKey(), best));
		}
		c.sort(Comparator.comparingDouble(Recognition.Candidate::distance));
		Recognition.Candidate top = c.get(0);
		double thr = threshold(top.cueId());
		boolean margin = c.size() < 2 || c.get(1).distance() - top.distance() >= cfg.minMargin() * top.distance();
		if (top.distance() <= thr && margin) return new Recognition(top.cueId(), 1 - top.distance() / thr, c);
		return Recognition.none(c);
	}

	double threshold(String cueId) {
		double factor = cfg.looseFactor() + (cfg.strictFactor() - cfg.looseFactor()) * strictness;
		return Math.max(cfg.minSpread(), spread.getOrDefault(cueId, cfg.singleTemplateSpread())) * factor;
	}

	private double[][] features(float[] pcm, int sampleRate) {
		float[] speech = Endpointer.trim(pcm, sampleRate, cfg.endpoint());
		return speech.length == 0 ? new double[0][] : Mfcc.compute(speech, sampleRate, cfg.features());
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :core:test`
Expected: BUILD SUCCESSFUL; `TemplateMatcherTest` 5 tests pass; `CoreBoundaryTest` passes. If `noiseBurstRejectedWhenStrict` or `picksTheEnrolledPattern` fails, do not edit the test or `defaults()`: print the `nbest` distances and the thresholds and escalate to the reviewer (the numbers are a finding).

- [ ] **Step 5: Leak check, log, commit**

Append to `MODLOG.md`: matcher rule, defaults as examples, "chirp tests prove plumbing only".
```bash
bash scripts/qa/leak-check.sh
git add core/src MODLOG.md && git commit -m "feat(core): add CueRecognizer and MFCC+DTW template matcher"
```

---

### Task 7: WAV I/O, manifest schema and validator

Tier: MEDIUM. Branch: `feat/s1-corpus`. Depends on Task 1 (parallel-safe with Tasks 2–6 except `WavIo` used later).

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/voice/WavIo.java`, `core/src/test/java/dev/smartpets/core/voice/WavIoTest.java`
- Create: `tools/voice-eval/src/main/java/dev/smartpets/voiceeval/{Row.java, Manifest.java}`, `tools/voice-eval/src/test/java/dev/smartpets/voiceeval/ManifestTest.java`
- Create: `specs/voice/MANIFEST-SCHEMA.md`, `specs/voice/manifest.example.tsv`

**Interfaces:**
- Produces: `WavIo.readMono16(Path) : WavIo.Audio(float[] samples, int sampleRate)` (IOException unless PCM signed 16-bit mono), `WavIo.writeMono16(Path, float[], int)`; `Row` record (16 columns, `positive()`); `Manifest.COLUMNS`, `read(Path)`, `checkRows(List<Row>) : List<String>`, `checkFiles(Path corpus, List<Row>) : List<String>`.
- Schema (one row per WAV; UTF-8; tab-separated; header exactly): `file sha256 speaker session split lang phrase_id category expected transcript style mic environment take duration_ms notes`. `split` ∈ tune/test/holdout and is the same for every row of a session. `category` ∈ cue, name (positives, `expected` = cue id) or near_miss, embedded, unrelated, silence, noise (negatives, `expected` = `NONE`). `speaker` is a pseudonym `spkNN`. `lang` ∈ pt-BR, en, none. Files are `audio/<session>/<phrase_id>__t<take>.wav`, 48 kHz mono 16-bit, `duration_ms` within 20 ms of the file.

- [ ] **Step 1: Write the schema doc and the FAKE example**

`specs/voice/MANIFEST-SCHEMA.md`: the schema bullet above verbatim, plus: "Rows of the real manifest live only in `$SMARTPETS_VOICE_CORPUS/manifest.tsv` (outside git). `transcript` is what was actually said (fix it by hand if you misspoke). `notes` never holds personal data. Validator: `./gradlew :voice-eval:run --args=\"check --corpus $SMARTPETS_VOICE_CORPUS\"`."
`specs/voice/manifest.example.tsv` (tabs between columns; 64 zeros as sha256):
```
file	sha256	speaker	session	split	lang	phrase_id	category	expected	transcript	style	mic	environment	take	duration_ms	notes
audio/sFAKE-a/cmd.sit.pt__t1.wav	0000000000000000000000000000000000000000000000000000000000000000	spk01	sFAKE-a	tune	pt-BR	cmd.sit.pt	cue	SIT	senta	normal	headset	quiet_room	1	812	FAKE ROW: example only, no such file
audio/sFAKE-a/nm.sente.pt__t1.wav	0000000000000000000000000000000000000000000000000000000000000000	spk01	sFAKE-a	tune	pt-BR	nm.sente.pt	near_miss	NONE	sente	normal	headset	quiet_room	1	790	FAKE ROW: example only, no such file
audio/sFAKE-b/sil.room__t1.wav	0000000000000000000000000000000000000000000000000000000000000000	spk01	sFAKE-b	test	none	sil.room	silence	NONE	(silence)	normal	laptop	fan	1	60000	FAKE ROW: example only, no such file
```

- [ ] **Step 2: Write the failing tests**

`core/src/test/java/dev/smartpets/core/voice/WavIoTest.java`:
```java
package dev.smartpets.core.voice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Path;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class WavIoTest {
	@Test
	void roundTripsAt48k(@TempDir Path dir) throws IOException {
		float[] x = Signals.sine(440, 0.1, 0.5, 48000);
		Path f = dir.resolve("t.wav");
		WavIo.writeMono16(f, x, 48000);
		WavIo.Audio a = WavIo.readMono16(f);
		assertEquals(48000, a.sampleRate());
		assertEquals(4800, a.samples().length);
		for (int i = 0; i < x.length; i++) assertEquals(x[i], a.samples()[i], 1.0 / 16000);
	}

	@Test
	void rejectsStereo(@TempDir Path dir) throws IOException {
		Path f = dir.resolve("s.wav");
		AudioFormat st = new AudioFormat(48000, 16, 2, true, false);
		try (AudioInputStream in = new AudioInputStream(new ByteArrayInputStream(new byte[400]), st, 100)) {
			AudioSystem.write(in, AudioFileFormat.Type.WAVE, f.toFile());
		}
		assertThrows(IOException.class, () -> WavIo.readMono16(f));
	}
}
```
`tools/voice-eval/src/test/java/dev/smartpets/voiceeval/ManifestTest.java`:
```java
package dev.smartpets.voiceeval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ManifestTest {
	private static final Path EXAMPLE = Path.of("../../specs/voice/manifest.example.tsv");

	private static Row with(Row r, String session, String split, String category, String expected) {
		return new Row(r.file().replace(".wav", "x.wav"), r.sha256(), r.speaker(), session, split, r.lang(), r.phraseId(), category,
			expected, r.transcript(), r.style(), r.mic(), r.environment(), r.take(), r.durationMs(), r.notes());
	}

	@Test
	void exampleIsValid() throws IOException {
		List<Row> rows = Manifest.read(EXAMPLE);
		assertEquals(3, rows.size());
		assertEquals(List.of(), Manifest.checkRows(rows));
	}

	@Test
	void sessionInTwoSplitsIsAnError() throws IOException {
		List<Row> rows = new ArrayList<>(Manifest.read(EXAMPLE));
		rows.add(with(rows.get(0), "sFAKE-a", "test", "cue", "SIT"));
		assertTrue(Manifest.checkRows(rows).stream().anyMatch(e -> e.contains("sFAKE-a")));
	}

	@Test
	void positiveCategoryNeedsACue() throws IOException {
		List<Row> rows = new ArrayList<>(Manifest.read(EXAMPLE));
		rows.add(with(rows.get(0), "sFAKE-a", "tune", "cue", "NONE"));
		assertEquals(1, Manifest.checkRows(rows).size());
	}

	@Test
	void wrongHeaderFails(@TempDir Path dir) throws IOException {
		Path f = dir.resolve("m.tsv");
		Files.writeString(f, "file\tsha\n");
		assertThrows(IOException.class, () -> Manifest.read(f));
	}
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `./gradlew :core:test :voice-eval:test`
Expected: FAIL (compile errors: `WavIo`, `Row`, `Manifest` not found).

- [ ] **Step 4: Implement**

`core/src/main/java/dev/smartpets/core/voice/WavIo.java`:
```java
package dev.smartpets.core.voice;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Path;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.UnsupportedAudioFileException;

/** WAV PCM 16-bit mono read/write with the JDK only. */
public final class WavIo {
	public record Audio(float[] samples, int sampleRate) {
	}

	private WavIo() {
	}

	public static Audio readMono16(Path p) throws IOException {
		try (AudioInputStream in = AudioSystem.getAudioInputStream(p.toFile())) {
			AudioFormat f = in.getFormat();
			if (f.getEncoding() != AudioFormat.Encoding.PCM_SIGNED || f.getSampleSizeInBits() != 16 || f.getChannels() != 1) {
				throw new IOException("expected PCM signed 16-bit mono, got " + f + " in " + p.getFileName());
			}
			byte[] b = in.readAllBytes();
			boolean be = f.isBigEndian();
			float[] s = new float[b.length / 2];
			for (int i = 0; i < s.length; i++) {
				int lo = b[2 * i + (be ? 1 : 0)] & 0xff, hi = b[2 * i + (be ? 0 : 1)];
				s[i] = (short) ((hi << 8) | lo) / 32768f;
			}
			return new Audio(s, Math.round(f.getSampleRate()));
		} catch (UnsupportedAudioFileException e) {
			throw new IOException("not a readable WAV: " + p.getFileName(), e);
		}
	}

	public static void writeMono16(Path p, float[] s, int sampleRate) throws IOException {
		byte[] b = new byte[s.length * 2];
		for (int i = 0; i < s.length; i++) {
			int v = Math.round(Math.max(-1f, Math.min(1f, s[i])) * 32767f);
			b[2 * i] = (byte) v;
			b[2 * i + 1] = (byte) (v >> 8);
		}
		AudioFormat f = new AudioFormat(sampleRate, 16, 1, true, false);
		try (AudioInputStream in = new AudioInputStream(new ByteArrayInputStream(b), f, s.length)) {
			AudioSystem.write(in, AudioFileFormat.Type.WAVE, p.toFile());
		}
	}
}
```
`tools/voice-eval/src/main/java/dev/smartpets/voiceeval/Row.java`:
```java
package dev.smartpets.voiceeval;

public record Row(String file, String sha256, String speaker, String session, String split, String lang,
		String phraseId, String category, String expected, String transcript, String style, String mic,
		String environment, int take, int durationMs, String notes) {
	public boolean positive() {
		return !"NONE".equals(expected);
	}
}
```
`tools/voice-eval/src/main/java/dev/smartpets/voiceeval/Manifest.java`:
```java
package dev.smartpets.voiceeval;

import dev.smartpets.core.voice.WavIo;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class Manifest {
	public static final List<String> COLUMNS = List.of("file", "sha256", "speaker", "session", "split", "lang",
		"phrase_id", "category", "expected", "transcript", "style", "mic", "environment", "take", "duration_ms", "notes");
	public static final Set<String> SPLITS = Set.of("tune", "test", "holdout");
	public static final Set<String> POSITIVE = Set.of("cue", "name");
	public static final Set<String> NEGATIVE = Set.of("near_miss", "embedded", "unrelated", "silence", "noise");
	public static final Set<String> LANGS = Set.of("pt-BR", "en", "none");
	public static final int SAMPLE_RATE = 48000;

	private Manifest() {
	}

	public static List<Row> read(Path tsv) throws IOException {
		List<String> lines = Files.readAllLines(tsv);
		if (lines.isEmpty() || !List.of(lines.get(0).split("\t", -1)).equals(COLUMNS)) {
			throw new IOException("manifest header must be: " + String.join("\\t", COLUMNS));
		}
		List<Row> rows = new ArrayList<>();
		for (int n = 1; n < lines.size(); n++) {
			if (lines.get(n).isBlank()) continue;
			String[] c = lines.get(n).split("\t", -1);
			if (c.length != COLUMNS.size()) throw new IOException("line " + (n + 1) + ": expected 16 columns, got " + c.length);
			try {
				rows.add(new Row(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11], c[12],
					Integer.parseInt(c[13]), Integer.parseInt(c[14]), c[15]));
			} catch (NumberFormatException e) {
				throw new IOException("line " + (n + 1) + ": take/duration_ms must be integers", e);
			}
		}
		return rows;
	}

	public static List<String> checkRows(List<Row> rows) {
		List<String> err = new ArrayList<>();
		Map<String, String> sessionSplit = new HashMap<>();
		Set<String> files = new HashSet<>();
		for (Row r : rows) {
			String at = r.file() + ": ";
			if (!files.add(r.file())) err.add(at + "duplicate file");
			if (!r.file().startsWith("audio/") || r.file().contains("..") || !r.file().endsWith(".wav")) err.add(at + "file must be audio/<...>.wav");
			if (!r.sha256().matches("[0-9a-f]{64}")) err.add(at + "sha256 must be 64 lowercase hex");
			if (!r.speaker().matches("spk[0-9]{2}")) err.add(at + "speaker must be a pseudonym spkNN");
			if (!SPLITS.contains(r.split())) err.add(at + "bad split " + r.split());
			if (!LANGS.contains(r.lang())) err.add(at + "bad lang " + r.lang());
			boolean pos = POSITIVE.contains(r.category());
			if (!pos && !NEGATIVE.contains(r.category())) err.add(at + "bad category " + r.category());
			if (pos == "NONE".equals(r.expected())) err.add(at + "category " + r.category() + " does not fit expected " + r.expected());
			if (r.take() < 1 || r.durationMs() < 1) err.add(at + "take and duration_ms must be >= 1");
			String prev = sessionSplit.putIfAbsent(r.session(), r.split());
			if (prev != null && !prev.equals(r.split())) err.add(at + "session " + r.session() + " is in splits " + prev + " and " + r.split());
		}
		return err;
	}

	public static List<String> checkFiles(Path corpus, List<Row> rows) {
		List<String> err = new ArrayList<>();
		Path root = corpus.toAbsolutePath().normalize();
		for (Row r : rows) {
			Path p = root.resolve(r.file()).normalize();
			String at = r.file() + ": ";
			if (!p.startsWith(root) || !Files.isRegularFile(p)) {
				err.add(at + "missing");
				continue;
			}
			try {
				if (!sha256(p).equals(r.sha256())) err.add(at + "sha256 mismatch");
				WavIo.Audio a = WavIo.readMono16(p);
				if (a.sampleRate() != SAMPLE_RATE) err.add(at + "sample rate " + a.sampleRate() + ", expected " + SAMPLE_RATE);
				long ms = Math.round(a.samples().length * 1000.0 / a.sampleRate());
				if (Math.abs(ms - r.durationMs()) > 20) err.add(at + "duration " + ms + " ms, manifest says " + r.durationMs());
			} catch (IOException e) {
				err.add(at + e.getMessage());
			}
		}
		return err;
	}

	static String sha256(Path p) throws IOException {
		try {
			return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(p)));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
```

- [ ] **Step 5: Run to verify it passes, leak check, commit**

Run: `./gradlew :core:test :voice-eval:test` → BUILD SUCCESSFUL; `WavIoTest` 2 and `ManifestTest` 4 tests pass.
```bash
bash scripts/qa/leak-check.sh
git add core/src tools/voice-eval/src specs/voice && git commit -m "feat(s1): add WAV I/O, corpus manifest schema and validator"
```

---

### Task 8: Metrics, evaluator, report and CLI

Tier: MEDIUM (STRONG review). Branch: `feat/s1-eval`. Depends on Tasks 6, 7.

**Files:**
- Create: `tools/voice-eval/src/main/java/dev/smartpets/voiceeval/{Stats.java, Evaluator.java, Report.java, VoiceEvalMain.java}`, `tools/voice-eval/src/test/java/dev/smartpets/voiceeval/{StatsTest.java, EvaluatorTest.java}`

**Interfaces:**
- Produces: `Stats.wilson(k, n, z)`, `percentile(double[], q)` (nearest rank), `bootstrapMedianCi(double[], iters, seed)`; `Evaluator.enroll(rows, rec, takesPerCue, loader) : List<Row>` (only `tune` positives, first N per cue by session/phrase/take); `Evaluator.score(rows, split, templates, rec, strictness, maxUtteranceSeconds, loader) : Result` (template rows excluded; negatives longer than `maxUtteranceSeconds` are cut by `Endpointer` and every accepted segment is a false accept); `Report.summarize`, `markdown`, `perFileTsv`, `sweepTable`.
- CLI: `./gradlew :voice-eval:run --args="check --corpus <dir>"` and `--args="eval --corpus <dir> --split tune|test|holdout [--allow-holdout] [--engine template|external] [--external-cmd '<cmd>'] [--strictness 0.5 | --sweep 0,0.25,0.5,0.75,1] [--enroll-takes 3]"`. `--sweep` only on `tune`. Writes `<corpus>/reports/<engine>-<split>-s<strictness>.{md,tsv}` and prints the markdown.

- [ ] **Step 1: Write the failing tests**

`tools/voice-eval/src/test/java/dev/smartpets/voiceeval/StatsTest.java`:
```java
package dev.smartpets.voiceeval;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class StatsTest {
	@Test
	void wilson95of100() {
		double[] ci = Stats.wilson(95, 100, 1.96);
		assertEquals(0.8882, ci[0], 1e-3);
		assertEquals(0.9785, ci[1], 1e-3);
	}

	@Test
	void wilsonZeroOf150IsAbout2Point5Percent() {
		double[] ci = Stats.wilson(0, 150, 1.96);
		assertEquals(0.0, ci[0], 1e-12);
		assertEquals(0.02497, ci[1], 1e-4); // <= 2% with zero errors needs n >= 189
	}

	@Test
	void nearestRankPercentile() {
		double[] xs = new double[100];
		for (int i = 0; i < 100; i++) xs[i] = 100 - i;
		assertEquals(95.0, Stats.percentile(xs, 0.95));
		assertEquals(50.0, Stats.percentile(xs, 0.5));
	}

	@Test
	void bootstrapIsDeterministicAndBracketsTheMedian() {
		double[] xs = {5, 7, 9, 11, 13, 15, 17, 19, 21, 23};
		double[] a = Stats.bootstrapMedianCi(xs, 1000, 42), b = Stats.bootstrapMedianCi(xs, 1000, 42);
		assertArrayEquals(a, b);
		assertTrue(a[0] <= 13 && a[1] >= 13);
	}
}
```
`tools/voice-eval/src/test/java/dev/smartpets/voiceeval/EvaluatorTest.java`:
```java
package dev.smartpets.voiceeval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.smartpets.core.voice.CueRecognizer;
import dev.smartpets.core.voice.Recognition;
import dev.smartpets.core.voice.WavIo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Bookkeeping only: a scripted fake recognizer, no audio. */
class EvaluatorTest {
	private final List<Row> rows = new ArrayList<>();
	private final List<String> answers = new ArrayList<>();

	private Row add(String session, String split, String cat, String expected, int take, String answer) {
		Row r = new Row("audio/" + session + "/" + rows.size() + ".wav", "0".repeat(64), "spk01", session, split, "en",
			expected.toLowerCase(), cat, expected, "x", "normal", "m", "e", take, 500, "");
		rows.add(r);
		answers.add(answer);
		return r;
	}

	private final Evaluator.AudioLoader loader = r -> new WavIo.Audio(new float[] {rows.indexOf(r)}, 16000);

	private final CueRecognizer fake = new CueRecognizer() {
		public String id() { return "fake"; }
		public void enroll(String cueId, String text, float[] pcm, int sr) { }
		public void setStrictness(double s) { }
		public Recognition recognize(float[] pcm, int sr) {
			String a = answers.get((int) pcm[0]);
			return a.equals(Recognition.NONE) ? Recognition.none(List.of()) : new Recognition(a, 1, List.of());
		}
	};

	@Test
	void countsHitsMissesSubstitutionsAndFalseAccepts() throws IOException {
		Row sit1 = add("s1", "tune", "cue", "SIT", 1, "SIT");
		add("s1", "tune", "cue", "SIT", 2, "SIT");
		Row down1 = add("s1", "tune", "cue", "DOWN", 1, "DOWN");
		add("s2", "test", "cue", "SIT", 1, "SIT");
		add("s2", "test", "cue", "SIT", 2, Recognition.NONE);
		add("s2", "test", "cue", "DOWN", 1, "SIT");
		add("s2", "test", "near_miss", "NONE", 1, "SIT");
		add("s2", "test", "silence", "NONE", 1, Recognition.NONE);
		List<Row> templates = Evaluator.enroll(rows, fake, 1, loader);
		assertEquals(List.of(down1, sit1), templates);
		Report.Summary s = Report.summarize(Evaluator.score(rows, "test", templates, fake, 0.5, 10, loader).items());
		assertEquals(3, s.positives());
		assertEquals(1, s.correct());
		assertEquals(1, s.misses());
		assertEquals(1, s.substitutions());
		assertEquals(2, s.negatives());
		assertEquals(1, s.falseAccepts());
	}

	@Test
	void enrollmentOnlyFromTuneAndNeverScoredTwice() throws IOException {
		add("s9", "test", "cue", "SIT", 1, "SIT");
		Row t = add("s1", "tune", "cue", "COME", 1, "COME");
		add("s1", "tune", "cue", "COME", 2, "COME");
		List<Row> templates = Evaluator.enroll(rows, fake, 3, loader);
		assertEquals(2, templates.size());
		assertTrue(templates.stream().allMatch(r -> r.split().equals("tune")));
		var items = Evaluator.score(rows, "tune", List.of(t), fake, 0.5, 10, loader).items();
		assertEquals(1, items.size());
		assertTrue(items.stream().noneMatch(i -> i.row().equals(t)));
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :voice-eval:test`
Expected: FAIL (compile errors: `Stats`, `Evaluator`, `Report` not found).

- [ ] **Step 3: Implement `Stats` and `Evaluator`**

`tools/voice-eval/src/main/java/dev/smartpets/voiceeval/Stats.java`:
```java
package dev.smartpets.voiceeval;

import java.util.Arrays;
import java.util.Random;

public final class Stats {
	private Stats() {
	}

	/** Wilson score interval for k successes in n trials. */
	public static double[] wilson(int k, int n, double z) {
		if (n == 0) return new double[] {0, 1};
		double p = (double) k / n, z2 = z * z, d = 1 + z2 / n;
		double c = (p + z2 / (2.0 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z2 / (4.0 * n * n)) / d;
		return new double[] {Math.max(0, c - h), Math.min(1, c + h)};
	}

	public static double percentile(double[] xs, double q) {
		if (xs.length == 0) return Double.NaN;
		double[] s = xs.clone();
		Arrays.sort(s);
		return s[Math.min(s.length - 1, Math.max(0, (int) Math.ceil(q * s.length) - 1))];
	}

	public static double[] bootstrapMedianCi(double[] xs, int iters, long seed) {
		if (xs.length == 0) return new double[] {Double.NaN, Double.NaN};
		Random r = new Random(seed);
		double[] m = new double[iters], b = new double[xs.length];
		for (int it = 0; it < iters; it++) {
			for (int j = 0; j < b.length; j++) b[j] = xs[r.nextInt(xs.length)];
			m[it] = percentile(b, 0.5);
		}
		return new double[] {percentile(m, 0.025), percentile(m, 0.975)};
	}
}
```
`tools/voice-eval/src/main/java/dev/smartpets/voiceeval/Evaluator.java`:
```java
package dev.smartpets.voiceeval;

import dev.smartpets.core.voice.CueRecognizer;
import dev.smartpets.core.voice.Endpointer;
import dev.smartpets.core.voice.Recognition;
import dev.smartpets.core.voice.WavIo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

public final class Evaluator {
	public interface AudioLoader {
		WavIo.Audio load(Row row) throws IOException;
	}

	/** millis is NaN for continuous negatives; falseAccepts counts accepted segments of a negative. */
	public record Item(Row row, String got, double millis, int falseAccepts) {
	}

	public record Result(String engine, String split, double strictness, List<Row> templates, List<Item> items,
			double continuousSeconds) {
	}

	private Evaluator() {
	}

	public static List<Row> enroll(List<Row> rows, CueRecognizer rec, int takesPerCue, AudioLoader loader) throws IOException {
		Map<String, List<Row>> byCue = new TreeMap<>();
		rows.stream().filter(r -> r.split().equals("tune") && r.positive())
			.sorted(Comparator.comparing(Row::session).thenComparing(Row::phraseId).thenComparingInt(Row::take).thenComparing(Row::file))
			.forEach(r -> byCue.computeIfAbsent(r.expected(), k -> new ArrayList<>()).add(r));
		List<Row> out = new ArrayList<>();
		for (List<Row> l : byCue.values()) out.addAll(l.subList(0, Math.min(takesPerCue, l.size())));
		for (Row t : out) {
			WavIo.Audio a = loader.load(t);
			rec.enroll(t.expected(), t.transcript(), a.samples(), a.sampleRate());
		}
		return out;
	}

	public static Result score(List<Row> rows, String split, List<Row> templates, CueRecognizer rec, double strictness,
			double maxUtteranceSeconds, AudioLoader loader) throws IOException {
		rec.setStrictness(strictness);
		Set<Row> used = new HashSet<>(templates);
		List<Item> items = new ArrayList<>();
		double contSec = 0;
		for (Row r : rows) {
			if (!r.split().equals(split) || used.contains(r)) continue;
			WavIo.Audio a = loader.load(r);
			boolean continuous = !r.positive() && a.samples().length > maxUtteranceSeconds * a.sampleRate();
			List<float[]> parts = new ArrayList<>();
			if (continuous) {
				contSec += (double) a.samples().length / a.sampleRate();
				for (Endpointer.Segment s : Endpointer.segments(a.samples(), a.sampleRate(), Endpointer.Config.defaults())) {
					parts.add(Arrays.copyOfRange(a.samples(), s.start(), s.end()));
				}
			} else {
				parts.add(a.samples());
			}
			String got = Recognition.NONE;
			int fa = 0;
			double ms = Double.NaN;
			for (float[] p : parts) {
				long t0 = System.nanoTime();
				Recognition res = rec.recognize(p, a.sampleRate());
				ms = (System.nanoTime() - t0) / 1e6;
				if (res.accepted()) {
					if (got.equals(Recognition.NONE)) got = res.cueId();
					fa++;
				}
			}
			items.add(new Item(r, got, continuous ? Double.NaN : ms, r.positive() ? 0 : fa));
		}
		return new Result(rec.id(), split, strictness, templates, items, contSec);
	}
}
```

- [ ] **Step 4: Implement `Report`**

`tools/voice-eval/src/main/java/dev/smartpets/voiceeval/Report.java`:
```java
package dev.smartpets.voiceeval;

import dev.smartpets.core.voice.Recognition;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class Report {
	public record Summary(int positives, int correct, int misses, int substitutions, int negatives, int falseAccepts) {
	}

	private Report() {
	}

	public static Summary summarize(List<Evaluator.Item> items) {
		int p = 0, c = 0, m = 0, s = 0, n = 0, fa = 0;
		for (Evaluator.Item i : items) {
			if (i.row().positive()) {
				p++;
				if (i.got().equals(i.row().expected())) c++;
				else if (i.got().equals(Recognition.NONE)) m++;
				else s++;
			} else if (!Double.isNaN(i.millis())) {
				n++;
				if (!i.got().equals(Recognition.NONE)) fa++;
			}
		}
		return new Summary(p, c, m, s, n, fa);
	}

	private static String pct(double x) {
		return String.format("%.1f%%", 100 * x);
	}

	private static String ci(int k, int n) {
		double[] w = Stats.wilson(k, n, 1.96);
		return pct(w[0]) + " – " + pct(w[1]);
	}

	public static String markdown(Evaluator.Result r) {
		StringBuilder b = new StringBuilder();
		long speakers = r.items().stream().map(i -> i.row().speaker()).distinct().count();
		b.append("# Voice eval: ").append(r.engine()).append(", split ").append(r.split())
			.append(", strictness ").append(r.strictness()).append("\n\n");
		b.append("Speakers: ").append(speakers).append(speakers == 1 ? " (SINGLE SPEAKER: no claim for other voices)" : "")
			.append(". Templates: ").append(r.templates().size()).append(" rows from split tune.\n\n");
		b.append("| positives | n | correct | accuracy | 95% CI | misses | substitutions |\n|---|---|---|---|---|---|---|\n");
		Map<String, List<Evaluator.Item>> byLang = new TreeMap<>(r.items().stream().filter(i -> i.row().positive())
			.collect(Collectors.groupingBy(i -> i.row().lang())));
		byLang.put("all", r.items().stream().filter(i -> i.row().positive()).toList());
		byLang.forEach((lang, l) -> {
			Summary s = summarize(l);
			b.append("| ").append(lang).append(" | ").append(s.positives()).append(" | ").append(s.correct()).append(" | ")
				.append(s.positives() == 0 ? "-" : pct((double) s.correct() / s.positives())).append(" | ")
				.append(ci(s.correct(), s.positives())).append(" | ").append(s.misses()).append(" | ").append(s.substitutions()).append(" |\n");
		});
		b.append("\n| negatives (short) | n | false accepts | rate | 95% CI |\n|---|---|---|---|---|\n");
		Map<String, List<Evaluator.Item>> byCat = new TreeMap<>(r.items().stream()
			.filter(i -> !i.row().positive() && !Double.isNaN(i.millis())).collect(Collectors.groupingBy(i -> i.row().category())));
		byCat.forEach((cat, l) -> {
			Summary s = summarize(l);
			b.append("| ").append(cat).append(" | ").append(s.negatives()).append(" | ").append(s.falseAccepts()).append(" | ")
				.append(pct((double) s.falseAccepts() / s.negatives())).append(" | ").append(ci(s.falseAccepts(), s.negatives())).append(" |\n");
		});
		int contFa = r.items().stream().filter(i -> Double.isNaN(i.millis())).mapToInt(Evaluator.Item::falseAccepts).sum();
		double hours = r.continuousSeconds() / 3600;
		b.append(String.format("%nContinuous negatives: %.1f min, %d false accepts, %s per hour.%n", r.continuousSeconds() / 60,
			contFa, hours == 0 ? "-" : String.format("%.1f", contFa / hours)));
		double[] ms = r.items().stream().mapToDouble(Evaluator.Item::millis).filter(x -> !Double.isNaN(x)).toArray();
		double[] mci = Stats.bootstrapMedianCi(ms, 1000, 42);
		b.append(String.format("Decode latency per utterance (ms, this machine): median %.1f [95%% CI %.1f – %.1f], p95 %.1f, n %d.%n",
			Stats.percentile(ms, 0.5), mci[0], mci[1], Stats.percentile(ms, 0.95), ms.length));
		b.append("\n## Confusion (expected -> got: count; positives and near misses)\n\n");
		Map<String, Long> conf = new TreeMap<>(r.items().stream()
			.filter(i -> i.row().positive() || i.row().category().equals("near_miss"))
			.collect(Collectors.groupingBy(i -> i.row().phraseId() + " (" + i.row().expected() + ") -> " + i.got(), Collectors.counting())));
		conf.forEach((k, v) -> b.append("- ").append(k).append(": ").append(v).append('\n'));
		return b.toString();
	}

	/** Per-file rows: stays in the corpus folder, never in git. */
	public static String perFileTsv(Evaluator.Result r) {
		StringBuilder b = new StringBuilder("file\tcategory\texpected\tgot\tmillis\tfalse_accepts\n");
		for (Evaluator.Item i : r.items()) {
			b.append(i.row().file()).append('\t').append(i.row().category()).append('\t').append(i.row().expected()).append('\t')
				.append(i.got()).append('\t').append(i.millis()).append('\t').append(i.falseAccepts()).append('\n');
		}
		return b.toString();
	}

	public static String sweepTable(List<Evaluator.Result> results) {
		StringBuilder b = new StringBuilder("| strictness | accuracy | short-negative FA rate | continuous FA/hour |\n|---|---|---|---|\n");
		for (Evaluator.Result r : results) {
			Summary s = summarize(r.items());
			int contFa = r.items().stream().filter(i -> Double.isNaN(i.millis())).mapToInt(Evaluator.Item::falseAccepts).sum();
			b.append("| ").append(r.strictness()).append(" | ").append(s.positives() == 0 ? "-" : pct((double) s.correct() / s.positives()))
				.append(" | ").append(s.negatives() == 0 ? "-" : pct((double) s.falseAccepts() / s.negatives())).append(" | ")
				.append(r.continuousSeconds() == 0 ? "-" : String.format("%.1f", contFa / (r.continuousSeconds() / 3600))).append(" |\n");
		}
		return b.toString();
	}
}
```

- [ ] **Step 5: Implement the CLI**

`tools/voice-eval/src/main/java/dev/smartpets/voiceeval/VoiceEvalMain.java`:
```java
package dev.smartpets.voiceeval;

import dev.smartpets.core.voice.CueRecognizer;
import dev.smartpets.core.voice.TemplateMatcher;
import dev.smartpets.core.voice.WavIo;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class VoiceEvalMain {
	private VoiceEvalMain() {
	}

	public static void main(String[] args) throws Exception {
		if (args.length == 0 || !(args[0].equals("check") || args[0].equals("eval"))) fail("usage: check|eval --corpus <dir> [options]");
		Map<String, String> o = new HashMap<>();
		for (int i = 1; i < args.length; i++) {
			if (!args[i].startsWith("--")) fail("unexpected argument " + args[i]);
			boolean flag = i + 1 >= args.length || args[i + 1].startsWith("--");
			o.put(args[i].substring(2), flag ? "true" : args[++i]);
		}
		String c = o.getOrDefault("corpus", System.getenv().getOrDefault("SMARTPETS_VOICE_CORPUS", ""));
		if (c.isBlank()) fail("set SMARTPETS_VOICE_CORPUS or pass --corpus");
		Path corpus = Path.of(c);
		List<Row> rows = Manifest.read(corpus.resolve("manifest.tsv"));
		List<String> errors = new ArrayList<>(Manifest.checkRows(rows));
		if (args[0].equals("check")) {
			errors.addAll(Manifest.checkFiles(corpus, rows));
			errors.forEach(System.out::println);
			System.out.println("rows=" + rows.size() + " errors=" + errors.size());
			System.exit(errors.isEmpty() ? 0 : 1);
		}
		if (!errors.isEmpty()) fail("manifest invalid, run check first: " + errors.get(0));
		String split = o.getOrDefault("split", "tune");
		if (!Manifest.SPLITS.contains(split)) fail("bad split " + split);
		if (split.equals("holdout") && !o.containsKey("allow-holdout")) fail("holdout is opened only for the final S1 verdict: add --allow-holdout");
		if (o.containsKey("sweep") && !split.equals("tune")) fail("--sweep only on tune: choose the operating point there, then run test once");
		double[] levels = Arrays.stream(o.getOrDefault("sweep", o.getOrDefault("strictness", "0.5")).split(","))
			.mapToDouble(Double::parseDouble).toArray();
		CueRecognizer rec = switch (o.getOrDefault("engine", "template")) {
			case "template" -> new TemplateMatcher(TemplateMatcher.Config.defaults());
			case "external" -> new ExternalProcessRecognizer(List.of(o.getOrDefault("external-cmd", "").split(" ")),
				Files.createTempDirectory("smartpets-voice"), Duration.ofSeconds(30));
			default -> throw new IllegalArgumentException("engine must be template or external");
		};
		Map<String, WavIo.Audio> cache = new HashMap<>();
		Evaluator.AudioLoader loader = r -> {
			WavIo.Audio a = cache.get(r.file());
			if (a != null) return a;
			a = WavIo.readMono16(corpus.resolve(r.file()));
			if (a.samples().length < 10L * a.sampleRate()) cache.put(r.file(), a);
			return a;
		};
		List<Row> templates = Evaluator.enroll(rows, rec, Integer.parseInt(o.getOrDefault("enroll-takes", "3")), loader);
		List<Evaluator.Result> results = new ArrayList<>();
		Path reports = Files.createDirectories(corpus.resolve("reports"));
		for (double s : levels) {
			Evaluator.Result r = Evaluator.score(rows, split, templates, rec, s, 4.0, loader);
			results.add(r);
			String base = rec.id().replaceAll("[^A-Za-z0-9._-]", "_") + "-" + split + "-s" + s;
			Files.writeString(reports.resolve(base + ".md"), Report.markdown(r));
			Files.writeString(reports.resolve(base + ".tsv"), Report.perFileTsv(r));
			if (levels.length == 1) System.out.println(Report.markdown(r));
		}
		if (levels.length > 1) System.out.println(Report.sweepTable(results));
		rec.close();
	}

	private static void fail(String msg) {
		System.err.println(msg);
		System.exit(2);
	}
}
```
(`ExternalProcessRecognizer` arrives in Task 9; until then replace the `external` case body with `throw new IllegalArgumentException("external engine: Task 9")` so this task compiles, and Task 9 restores the line above.)

- [ ] **Step 6: Run to verify it passes; smoke-test the CLI on an empty corpus**

Run: `./gradlew :voice-eval:test` → BUILD SUCCESSFUL; `StatsTest` 4 and `EvaluatorTest` 2 tests pass.
Then (scratch dir outside the repo, header-only manifest, no audio):
```bash
D="$(mktemp -d)"; head -1 specs/voice/manifest.example.tsv > "$D/manifest.tsv"
./gradlew -q :voice-eval:run --args="check --corpus $D"
./gradlew -q :voice-eval:run --args="eval --corpus $D --split test --sweep 0,1"; echo "exit=$?"
```
Expected: `rows=0 errors=0`; the second prints `--sweep only on tune: ...` and Gradle reports a non-zero exit.

- [ ] **Step 7: Leak check, log, commit**

Append to `MODLOG.md`: the real CLI invocations that ran, and the Wilson note (0 false accepts in 150 negatives bounds the rate at 2.5%, not 2%; ≥189 needed).
```bash
bash scripts/qa/leak-check.sh
git add tools/voice-eval/src MODLOG.md && git commit -m "feat(s1): add voice evaluation harness, metrics and report"
```

---

### Task 9: External engine slot (sidecar protocol) and engine research notes

Tier: FAST. Branch: `feat/s1-external`. Depends on Task 8.

**Files:**
- Create: `tools/voice-eval/src/main/java/dev/smartpets/voiceeval/ExternalProcessRecognizer.java`, `tools/voice-eval/src/test/java/dev/smartpets/voiceeval/ExternalProcessRecognizerTest.java`
- Modify: `VoiceEvalMain.java` (restore the `external` case)

**Interfaces:**
- Protocol (engine-agnostic, no JVM native code): the harness runs `<cmd...> <vocab.tsv> <utterance.wav>` with env `SMARTPETS_STRICTNESS=<0..1>`; `vocab.tsv` lines are `cueId<TAB>phrase text`; the WAV is mono 16-bit at the corpus rate (the wrapper resamples itself, e.g. `sox in.wav -r 16000 out.wav`). First stdout line: `CUE_ID<TAB>confidence` or `NONE`. Non-zero exit, timeout, or an unknown cue id is an error. Latency through this slot includes process start-up and is NOT comparable to in-process numbers; the slot is for accuracy comparison only.

- [ ] **Step 1: Write the failing test**

`tools/voice-eval/src/test/java/dev/smartpets/voiceeval/ExternalProcessRecognizerTest.java`:
```java
package dev.smartpets.voiceeval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ExternalProcessRecognizerTest {
	private static Path script(Path dir, String body) throws IOException {
		Path s = dir.resolve("engine.sh");
		Files.writeString(s, "#!/bin/sh\n" + body + "\n");
		Files.setPosixFilePermissions(s, PosixFilePermissions.fromString("rwx------"));
		return s;
	}

	@Test
	void followsTheProtocol(@TempDir Path dir) throws IOException {
		Path s = script(dir, "[ -s \"$2\" ] && grep -q '^SIT\tsenta$' \"$1\" && printf 'SIT\\t0.9\\n' || echo NONE");
		var r = new ExternalProcessRecognizer(List.of(s.toString()), dir, Duration.ofSeconds(10));
		r.enroll("SIT", "senta", new float[0], 48000);
		var got = r.recognize(new float[480], 48000);
		assertEquals("SIT", got.cueId());
		assertEquals(0.9, got.confidence(), 1e-9);
	}

	@Test
	void unknownCueIsAnError(@TempDir Path dir) throws IOException {
		Path s = script(dir, "echo BOGUS");
		var r = new ExternalProcessRecognizer(List.of(s.toString()), dir, Duration.ofSeconds(10));
		r.enroll("SIT", "sit", new float[0], 48000);
		assertThrows(IllegalStateException.class, () -> r.recognize(new float[480], 48000));
	}
}
```
Run: `./gradlew :voice-eval:test --tests '*ExternalProcessRecognizerTest'` → FAIL (class not found).

- [ ] **Step 2: Implement**

`tools/voice-eval/src/main/java/dev/smartpets/voiceeval/ExternalProcessRecognizer.java`:
```java
package dev.smartpets.voiceeval;

import dev.smartpets.core.voice.CueRecognizer;
import dev.smartpets.core.voice.Recognition;
import dev.smartpets.core.voice.WavIo;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/** Sidecar slot for Vosk / sherpa-onnx / whisper.cpp wrappers. Accuracy comparison only (process start-up skews latency). */
public final class ExternalProcessRecognizer implements CueRecognizer {
	private final List<String> command;
	private final Path work;
	private final Duration timeout;
	private final Map<String, Set<String>> vocab = new LinkedHashMap<>();
	private double strictness = 0.5;

	public ExternalProcessRecognizer(List<String> command, Path workDir, Duration timeout) {
		if (command.isEmpty() || command.get(0).isBlank()) throw new IllegalArgumentException("--external-cmd is required");
		this.command = List.copyOf(command);
		this.work = workDir;
		this.timeout = timeout;
	}

	@Override
	public String id() {
		return "external-" + Path.of(command.get(0)).getFileName();
	}

	@Override
	public void enroll(String cueId, String phraseText, float[] pcm, int sampleRate) {
		vocab.computeIfAbsent(cueId, k -> new LinkedHashSet<>()).add(phraseText);
	}

	@Override
	public void setStrictness(double s) {
		if (!(s >= 0 && s <= 1)) throw new IllegalArgumentException("strictness must be in [0, 1]");
		strictness = s;
	}

	@Override
	public Recognition recognize(float[] pcm, int sampleRate) {
		Path wav = null;
		try {
			wav = Files.createTempFile(work, "utt", ".wav");
			WavIo.writeMono16(wav, pcm, sampleRate);
			Path voc = work.resolve("vocab.tsv");
			List<String> lines = new ArrayList<>();
			vocab.forEach((cue, texts) -> texts.forEach(t -> lines.add(cue + "\t" + t)));
			Files.write(voc, lines);
			List<String> cmd = new ArrayList<>(command);
			cmd.add(voc.toString());
			cmd.add(wav.toString());
			ProcessBuilder pb = new ProcessBuilder(cmd).redirectError(ProcessBuilder.Redirect.DISCARD);
			pb.environment().put("SMARTPETS_STRICTNESS", Double.toString(strictness));
			Process p = pb.start();
			if (!p.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
				p.destroyForcibly();
				throw new IllegalStateException("engine timed out");
			}
			String line;
			try (BufferedReader r = p.inputReader()) {
				line = r.readLine();
			}
			if (p.exitValue() != 0 || line == null) throw new IllegalStateException("engine failed, exit " + p.exitValue());
			String[] f = line.trim().split("\t");
			if (f[0].equals(Recognition.NONE)) return Recognition.none(List.of());
			if (!vocab.containsKey(f[0])) throw new IllegalStateException("engine returned unknown cue " + f[0]);
			return new Recognition(f[0], f.length > 1 ? Double.parseDouble(f[1]) : 0, List.of());
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException(e);
		} finally {
			if (wav != null) wav.toFile().delete();
		}
	}
}
```
Restore in `VoiceEvalMain` the `external` case shown in Task 8 Step 5.

- [ ] **Step 3: Run, record the research notes, commit**

Run: `./gradlew :voice-eval:test` → BUILD SUCCESSFUL; 2 new tests pass.
Put this table in the PR description and later in ADR-0006 (Task 12). It comes from an earlier research note; each "verified" item must be re-checked at the source before any engine is adopted (CLAUDE.md §4):

| Engine | License (to re-verify) | Fit | Wrapper idea (not built here) |
|---|---|---|---|
| Vosk + small-pt-0.3 / small-en-us-0.15 | Apache-2.0 code and models (reported) | fixed command words via grammar; invented pet names likely `[unk]` | script feeding a grammar built from `vocab.tsv` |
| sherpa-onnx keyword spotting | Apache-2.0 (reported) | open-vocabulary keywords with boost/threshold; pretrained KWS models listed for EN/ZH only, PT-BR unknown | script writing a keywords file from `vocab.tsv` |
| whisper.cpp tiny/base | MIT (unverified) | multilingual; reported hallucination on silence/short clips; heavier | sidecar CLI with a GBNF grammar from `vocab.tsv` |
| openWakeWord, Porcupine | non-commercial / proprietary models (reported) | excluded (license) | none |

Hypothesis for ADR-0006 (not a decision): engine for fixed command words + template matcher for pet names.
```bash
bash scripts/qa/leak-check.sh
git add tools/voice-eval/src && git commit -m "feat(s1): add external engine sidecar slot"
```

---

### Task 10: Prompt list and the recording script

Tier: FAST (+ human dry run). Branch: `feat/s1-prompts`. Depends on Task 7 (schema).

**Files:**
- Create: `specs/voice/prompts.tsv`, `scripts/voice/record-prompts.sh`

**Interfaces:**
- `prompts.tsv` columns: `phrase_id lang category expected takes seconds text`; `seconds = 0` is push-to-talk (Enter starts, Enter stops), `seconds > 0` records a fixed block (continuous negatives). The maintainer edits this file: replace example pet names with the names they will really use, add commands and languages freely. Text prompts only.
- `SMARTPETS_VOICE_CORPUS=<dir outside the repo> bash scripts/voice/record-prompts.sh <session> <split> [speaker] [mic] [environment]` → `audio/<session>/<phrase_id>__t<take>.wav` (48 kHz, mono, 16-bit) and one manifest row per accepted take; resumable (existing takes are skipped).

- [ ] **Step 1: Write the starter prompts** — `specs/voice/prompts.tsv` (tabs between columns; lines starting with `#` are comments):

```
phrase_id	lang	category	expected	takes	seconds	text
cmd.sit.pt	pt-BR	cue	SIT	5	0	senta
cmd.down.pt	pt-BR	cue	DOWN	5	0	deita
cmd.stay.pt	pt-BR	cue	STAY	5	0	fica
cmd.come.pt	pt-BR	cue	COME	5	0	vem
cmd.fetch.pt	pt-BR	cue	FETCH	5	0	pega
cmd.heel.pt	pt-BR	cue	HEEL	5	0	junto
cmd.speak.pt	pt-BR	cue	SPEAK	5	0	fala
cmd.no.pt	pt-BR	cue	NO	5	0	não
cmd.sit.en	en	cue	SIT	5	0	sit
cmd.down.en	en	cue	DOWN	5	0	down
cmd.stay.en	en	cue	STAY	5	0	stay
cmd.come.en	en	cue	COME	5	0	come
cmd.fetch.en	en	cue	FETCH	5	0	fetch
cmd.heel.en	en	cue	HEEL	5	0	heel
cmd.speak.en	en	cue	SPEAK	5	0	speak
cmd.no.en	en	cue	NO	5	0	no
# example pet names: replace with your own
name.pipoca	pt-BR	name	NAME_PIPOCA	5	0	Pipoca
name.thor	pt-BR	name	NAME_THOR	5	0	Thor
name.mel	pt-BR	name	NAME_MEL	5	0	Mel
name.zubi	pt-BR	name	NAME_ZUBI	5	0	Zubi
name.rex.en	en	name	NAME_REX	5	0	Rex
name.luna.en	en	name	NAME_LUNA	5	0	Luna
nm.sente.pt	pt-BR	near_miss	NONE	3	0	sente
nm.deixa.pt	pt-BR	near_miss	NONE	3	0	deixa
nm.fita.pt	pt-BR	near_miss	NONE	3	0	fita
nm.bem.pt	pt-BR	near_miss	NONE	3	0	bem
nm.pitoca.pt	pt-BR	near_miss	NONE	3	0	Pitoca
nm.mal.pt	pt-BR	near_miss	NONE	3	0	mal
nm.sat.en	en	near_miss	NONE	3	0	sat
nm.sip.en	en	near_miss	NONE	3	0	sip
nm.town.en	en	near_miss	NONE	3	0	town
nm.stray.en	en	near_miss	NONE	3	0	stray
nm.comb.en	en	near_miss	NONE	3	0	comb
nm.lunar.en	en	near_miss	NONE	3	0	lunar
emb.vem.pt	pt-BR	embedded	NONE	2	0	ele vem amanhã de manhã
emb.sit.en	en	embedded	NONE	2	0	I need to sit for a minute
unr.hora.pt	pt-BR	unrelated	NONE	2	0	que horas são agora
unr.agua.pt	pt-BR	unrelated	NONE	2	0	vou beber um copo de água
unr.weather.en	en	unrelated	NONE	2	0	the weather is nice today
unr.keys.en	en	unrelated	NONE	2	0	where did I leave my keys
unr.nonsense	none	unrelated	NONE	2	0	blorfa tasku mimeno
unr.read.pt	pt-BR	unrelated	NONE	1	120	(read any text aloud in Portuguese for 2 minutes)
unr.read.en	en	unrelated	NONE	1	120	(read any text aloud in English for 2 minutes)
sil.room	none	silence	NONE	1	60	(stay quiet: room silence)
noise.fan	none	noise	NONE	1	60	(fan or AC on, do not speak)
noise.keys	none	noise	NONE	1	60	(type on the keyboard, do not speak)
noise.game	none	noise	NONE	1	60	(Minecraft playing on the speakers, do not speak)
noise.cough	none	noise	NONE	3	0	(cough or clear your throat once)
```
(49 rows: 16 commands, 6 names, 12 near misses, 2 embedded, 7 unrelated, 6 silence/noise; about 25 minutes per session. `embedded` = a command word inside a sentence: scored as a negative until the human decides otherwise.)

- [ ] **Step 2: Write the recording script**

`scripts/voice/record-prompts.sh`:
```bash
#!/usr/bin/env bash
# Records the maintainer's OWN voice, one prompt at a time. Audio is personal data: it never enters git.
# usage: SMARTPETS_VOICE_CORPUS=<dir outside repo> bash scripts/voice/record-prompts.sh <session> <split> [speaker] [mic] [environment]
set -euo pipefail
: "${SMARTPETS_VOICE_CORPUS:?set SMARTPETS_VOICE_CORPUS to a folder OUTSIDE the repository}"
repo="$(git rev-parse --show-toplevel)"
corpus="$(realpath -m "$SMARTPETS_VOICE_CORPUS")"
case "$corpus/" in "$repo"/*) echo "corpus must be outside the repository" >&2; exit 2;; esac
session="${1:?session id, e.g. s2026-10-20a}"; split="${2:?tune|test|holdout}"
speaker="${3:-spk01}"; mic="${4:-unknown}"; envn="${5:-unknown}"
case "$split" in tune|test|holdout) ;; *) echo "split must be tune, test or holdout" >&2; exit 2;; esac
[[ "$speaker" =~ ^spk[0-9]{2}$ ]] || { echo "speaker must be a pseudonym like spk01" >&2; exit 2; }
prompts="${PROMPTS:-$repo/specs/voice/prompts.tsv}"
for t in rec soxi play shuf sha256sum; do command -v "$t" >/dev/null || { echo "missing tool: $t" >&2; exit 3; }; done
mkdir -p "$corpus/audio/$session"
man="$corpus/manifest.tsv"
header=$'file\tsha256\tspeaker\tsession\tsplit\tlang\tphrase_id\tcategory\texpected\ttranscript\tstyle\tmic\tenvironment\ttake\tduration_ms\tnotes'
[ -s "$man" ] || printf '%s\n' "$header" > "$man"
if awk -F'\t' -v s="$session" -v p="$split" 'NR>1 && $4==s && $5!=p {bad=1} END{exit !bad}' "$man"; then
  echo "session $session already exists with another split" >&2; exit 2
fi
jobs=$(awk -F'\t' 'NR>1 && $1 !~ /^#/ && NF>=7 { for (t=1; t<=$5; t++) print $0 "\t" t }' "$prompts" | shuf)
total=$(printf '%s\n' "$jobs" | grep -c . || true); i=0
while IFS=$'\t' read -r phrase lang cat expected takes seconds text take <&3; do
  i=$((i+1)); rel="audio/$session/${phrase}__t${take}.wav"; out="$corpus/$rel"
  if [ -e "$out" ]; then echo "[$i/$total] already recorded: $rel"; continue; fi
  while true; do
    printf '\n[%d/%d] %s, %s, take %s\n    >>> %s <<<\n' "$i" "$total" "$lang" "$cat" "$take" "$text"
    read -r -p "Enter = record, s = skip, q = quit: " k
    [ "$k" = q ] && exit 0
    [ "$k" = s ] && break
    if [ "$seconds" -gt 0 ]; then
      echo "recording ${seconds}s..."; rec -q -c 1 -r 48000 -b 16 -e signed-integer "$out" trim 0 "$seconds"
    else
      rec -q -c 1 -r 48000 -b 16 -e signed-integer "$out" & recpid=$!
      read -r -p "recording... Enter = stop " _
      kill -TERM "$recpid"; wait "$recpid" || true
    fi
    read -r -p "a = accept, p = play, r = redo: " k
    while [ "$k" = p ]; do play -q "$out"; read -r -p "a = accept, p = play, r = redo: " k; done
    [ "$k" = a ] && break
    rm -f "$out"
  done
  if [ -e "$out" ]; then
    sha=$(sha256sum "$out" | cut -d' ' -f1)
    ms=$(soxi -D "$out" | awk '{printf "%d", $1 * 1000 + 0.5}')
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\tnormal\t%s\t%s\t%s\t%s\t\n' "$rel" "$sha" "$speaker" "$session" "$split" \
      "$lang" "$phrase" "$cat" "$expected" "$text" "$mic" "$envn" "$take" "$ms" >> "$man"
  fi
done 3<<< "$jobs"
echo "done: $man"
```
(`kill -TERM` by PID: background jobs of a non-interactive shell ignore SIGINT. `trim` is a sox effect after the output file.)

- [ ] **Step 3: Verify the guards without recording anyone**

```bash
SMARTPETS_VOICE_CORPUS=./voice-corpus bash scripts/voice/record-prompts.sh sX tune; echo "exit=$?"
SMARTPETS_VOICE_CORPUS="$(mktemp -d)" bash scripts/voice/record-prompts.sh sX bogus; echo "exit=$?"
```
Expected: `corpus must be outside the repository`, `exit=2`; `split must be tune, test or holdout`, `exit=2`.

- [ ] **Step 4: Human dry run (maintainer, about 2 minutes)**

Ask the maintainer to run with a throw-away session in a temporary corpus (`PROMPTS` pointing at a copy with 3 rows, one with `seconds=5`), accept one take, then: `./gradlew -q :voice-eval:run --args="check --corpus <that dir>"` → `errors=0`. If the TERM-stopped file fails the check (bad header or duration), switch the stop to `kill -INT` under `set -m` and record what worked in `MODLOG.md`. Delete the throw-away corpus.

- [ ] **Step 5: Leak check, commit**

```bash
bash scripts/qa/leak-check.sh
git add specs/voice/prompts.tsv scripts/voice/record-prompts.sh && git commit -m "feat(s1): add voice prompt list and recording script"
```

---

### Task 11: Recordings and first evaluation (BLOCKED until the maintainer records)

Tier: human records; FAST runs checks; STRONG (architect/reviewer) picks the operating point with the human. Branch: `docs/s1-results`. Depends on Tasks 1–10 merged.

Everything in this task can only happen after the maintainer has recorded. Agents never record, never synthesize audio, never open per-file reports in PRs.

- [ ] **Step 1: Maintainer records (suggested schedule, the maintainer decides)**
  - Pilot: 1 `tune` session (ranks engines and sets defaults; not enough for the S1 claim).
  - `test`: ≥3 sessions on different days (≥100 positives per language and ≥189 short negatives in total; ≥30 min of continuous negatives across sessions).
  - `holdout`: ≥1 session recorded last, other day and if possible another mic.
  - Optional: a second speaker `spk02`, only with their consent.
- [ ] **Step 2: Validate** — `./gradlew -q :voice-eval:run --args="check --corpus $SMARTPETS_VOICE_CORPUS"` → `errors=0`.
- [ ] **Step 3: Sweep on tune** — `./gradlew -q :voice-eval:run --args="eval --corpus $SMARTPETS_VOICE_CORPUS --split tune --sweep 0,0.25,0.5,0.75,1"`. The human and the STRONG reviewer pick one strictness (and any `Config` change, recorded in MODLOG) from this table only.
- [ ] **Step 4: Run test once** — `... eval --split test --strictness <chosen>`. Then, for the verdict only, `... --split holdout --allow-holdout --strictness <chosen>`.
- [ ] **Step 5: Publish aggregates only** — copy the two `.md` reports into `docs/voice-eval/<date>-template-<split>.md` after the human reads them (phrase ids and counts only; no audio, no per-file TSV, no corpus path). `bash scripts/qa/leak-check.sh`, then commit `docs: add S1 offline evaluation aggregates`.

---

### Task 12: ADR-0006 skeleton and status

Tier: STRONG (architect). Branch: `docs/s1-adr`. Can start after Task 9; filled after Task 11.

**Files:**
- Create: `docs/adr/0006-voice-cue-recognition.md`
- Modify: `docs/spec/V0-SPIKES.md` (S1 status line), `site/data/status.json` + README roadmap table (CLAUDE.md §13), `MODLOG.md`

- [ ] **Step 1: Write the skeleton** — `docs/adr/0006-voice-cue-recognition.md`:

```markdown
# ADR-0006: Voice cue recognition (offline part of V0-S1)

- Status: Draft (offline harness built; verdict waits for the maintainer's recordings)
- Spike: V0-S1 (`docs/spec/V0-SPIKES.md`); plan `docs/superpowers/plans/2026-10-18-v0-s1-voice-offline.md`
- Evidence: `MODLOG.md`, `docs/voice-eval/` (aggregates only)

## Context
S1 asks whether learned arbitrary sounds/words can be recognized reliably, in any language, locally.

## Decisions already made by the maintainer
- Corpus = the maintainer's own voice only; no TTS/synthetic speech anywhere. Second speaker desirable, not required (spec text "author + one other speaker" to be amended).
- Recordings are personal data, kept outside git under `$SMARTPETS_VOICE_CORPUS`.

## What was built
`CueRecognizer`; `TemplateMatcher` (MFCC + banded DTW, strictness 0..1); `ExternalProcessRecognizer` sidecar slot; manifest + validator; recording script; evaluation report.

## Results (fill from docs/voice-eval; aggregates only)
| split | sessions | speakers | positives n | accuracy [95% CI] | short negatives n | FA rate [95% CI] | continuous FA/hour | latency median / p95 |
|---|---|---|---|---|---|---|---|---|
| test | TO FILL AFTER RECORDINGS | | | | | | | |
| holdout | TO FILL AFTER RECORDINGS | | | | | | | |

## Verdict
PASS / PASS-WITH-FALLBACK / FAIL: TO FILL AFTER RECORDINGS. Fallback ladder (spec): tuned matcher -> pretrained small KWS model with user-trained words -> text/key cues only.

## Engines considered
(table from Task 9, each license re-verified at the source with link and date)

## Open questions for the human
Strictness <-> intelligence mapping and direction; PASS bar as point estimate or CI lower bound; embedded command words; name+command in one utterance; bundled vs downloaded models.

## Consequences
What graduates to V1 (`core` voice package?), what stays spike-only (`tools/voice-eval`), what the in-game part (S1 part 2, after S8) must measure (key-release -> command latency, frame impact).
```

- [ ] **Step 2: Status** — set S1 to "in progress (offline harness ready, waiting for recordings)" in `docs/spec/V0-SPIKES.md`, `site/data/status.json` and the README table; run `bash scripts/qa/docs-freshness.sh` and `bash scripts/qa/leak-check.sh`.
- [ ] **Step 3: Commit** — `git add docs/adr/0006-voice-cue-recognition.md docs/spec/V0-SPIKES.md site/data/status.json README.md MODLOG.md && git commit -m "docs: add ADR-0006 skeleton for voice cue recognition"`. After Task 11, the architect fills Results/Verdict on the same branch or a follow-up `docs/s1-verdict`.

---

## Out of scope for this plan (explicit)

In-game capture (push-to-talk, `TargetDataLine`, off-main-thread worker) and key-release→command latency (S1 part 2, after S8); `/smartpets debug voice <wav>`; installing or wrapping Vosk/sherpa-onnx/whisper.cpp; augmentation; speaker verification (V3); multi-cue utterances (name + command in one push); the strictness↔intelligence mapping.

## Self-Review Notes

- Spec coverage (S1 offline): features + alignment matching with strictness (T3–T6), offline harness on recorded WAVs (T7–T8), two languages + negatives + noise (T10 prompts), PASS metrics with CIs (T8), engine slot for the fallback ladder (T9), ADR (T12). Not covered: second speaker (ruling), in-game part, CPU/frame impact.
- Corrections to the earlier QA-skills note: split consistency per session is enforced by the validator and the script, not just stated; no native engine deps in any Gradle module (sidecar protocol instead); the interface takes the sample rate (matcher runs at 48 kHz; wrappers resample); enrollment templates come only from `tune`; `.ogg` is not git-ignored (game assets); `augmentation_of` and `noise` columns dropped (out of scope; `environment` covers noise); `embedded` category added; zero false accepts in 150 negatives gives a Wilson upper bound of 2.5%, so ≤2% needs ≥189.
- Unverified until run: `kill -TERM` leaving a valid WAV header from `rec` (Task 10 Step 4 has a fallback); the matcher's chirp tests with `defaults()` (Task 6 Step 4 says escalate, not tune); Gradle `run` exit code propagation in Task 8 Step 6.
