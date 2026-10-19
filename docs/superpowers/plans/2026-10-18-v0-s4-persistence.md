# V0-S4 Persistence, Pet Registry, Catch-up — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Project roles, tiers and the PR flow in `CLAUDE.md` and `agents/` apply to every task.

**Goal:** Prove that pet records live in world saved data with a schema version, migrate v1→v2, keep unknown fields, survive save/quit/reload, and get capped catch-up math on load, with all rules pure in `core`.

**Architecture:** `core` owns the record (`PetRecord`), its text format (one JSON object per pet, tiny in-house `Json`), the schema/migration chain, the registry and the catch-up rules. `mod` stores the registry as one vanilla `SavedData` (`smartpets:pets` → `<world>/data/smartpets/pets.dat`) whose Mojang `Codec` is only a list of strings. The entity is NOT involved (S3); the record is the source of truth and nothing renders it.

**Tech Stack:** Minecraft 26.2, Fabric Loader 0.19.5, Fabric API 0.161.0+26.2 (fabric-object-builder-api-v1 24.1.1, fabric-lifecycle-events-v1 4.1.4, fabric-client-gametest-api-v1 6.0.2), DataFixerUpper 10.0.21 `Codec`, Loom 1.18-SNAPSHOT, Gradle 9.7.1, JDK 25, JUnit 6.1.3.

**Spec:** `docs/spec/V0-SPIKES.md` (S4), `docs/spec/SPEC.md` §3 ("Pet record is the source of truth", "Versioned persistence"), §4 (catch-up with caps), `specs/behaviors/06-health-persistence-time.feature` (capped absence, save/reload, v1→v2), S11 plan `2026-10-18-v0-s11-time-source.md` (provides `AgeClock`, `WorldTimeSource`).

## Verified 26.2 facts used (static: decompiled 26.2 index via mcdev-mcp, javap of the cached jars; 2026-10-18)
- `net.minecraft.world.level.saveddata.SavedData` (abstract; `setDirty()`, `isDirty()`) and `record SavedDataType<T extends SavedData>(Identifier id, Supplier<T> constructor, Codec<T> codec, DataFixTypes dataFixType)`. Vanilla example: `ServerClockManager.TYPE`.
- `MinecraftServer#getDataStorage() : SavedDataStorage`, folder `LevelResource.DATA` (`<world>/data`). `SavedDataStorage#computeIfAbsent(type)`, `#get`, `#set`; file = `id.withSuffix(".dat").resolveAgainst(dataFolder)` → `data/<namespace>/<path>.dat`; written gzip NBT `{data: <codec output>, DataVersion: n}`.
- **Data-loss trap:** `readSavedData` logs and returns `null` when the codec fails or reading throws; `computeIfAbsent` then creates a fresh empty object and marks it dirty, so the next save overwrites the file. Our codec must never fail on structurally valid NBT (all fields optional, payload opaque strings).
- `DataFixTypes` is required by the record; vanilla calls `type.update(...)`. Fabric API `fabric-object-builder-api-v1` has `SavedDataStorageMixin#handleNullDataFixType` (bytecode read with javap): if the type is `null` it returns the tag unchanged. So `null` is safe **with Fabric API present** (it is a hard dependency in `fabric.mod.json`).
- `StringTag#write` uses `DataOutput#writeUTF` → max 65535 bytes of modified UTF-8 per string. One pet per string, size-checked on `put`.
- DFU `Codec.INT`, `Codec.STRING`, `#listOf()`, `#optionalFieldOf(String, A)`, `RecordCodecBuilder.create(i -> i.group(...).apply(i, ...))` (javap + `ClockState` source).
- `ServerLifecycleEvents.SERVER_STARTED` / `ServerStarted#onServerStarted(MinecraftServer)` (javap). Brigadier `StringArgumentType.word()/getString`, `LongArgumentType.longArg(long)/getLong` (javap).
- Client GameTest: `TestSingleplayerContext#getWorldSave() : TestWorldSave`, `TestWorldSave#getSaveDirectory() : Path`, `#open() : TestSingleplayerContext`; `TestServerContext#runOnServer/computeOnServer` (javap).
Not verified: that closing a `TestSingleplayerContext` saves saved data (Task 4 proves it), behavior with Fabric API absent (not supported).

## Format decision (ADR in Task 5)
Chosen: **core-owned JSON text, one string per pet, inside a minimal Mojang Codec** (`{adapter_format:int, pets:[string...]}`). Reasons: (1) schema, migrations and unknown-field preservation are pure `core` code with JUnit tests, no Minecraft; (2) numbers round-trip exactly (longs stay longs, doubles via `Double.toString`), unaffected by NBT type coercion; (3) the Mojang codec cannot fail on our payload, avoiding the data-loss trap; (4) the dev dump is human-readable. Costs: not inspectable as typed NBT; 65535-byte limit per pet (guarded); a small parser to maintain.
Rejected: full `RecordCodecBuilder` per field (schema logic moves to `mod`, unknown fields dropped unless hand-merged, untestable without the game); `Codec.PASSTHROUGH` + `JavaOps` tree (NBT coerces booleans to bytes and int/long, not verified in 26.2); Gson in `core` (extra runtime dependency whose version must match the game's).

## Global Constraints
- Target Minecraft 26.2 only (ADR-0001). Compile errors mean "look the API up again" (mcdev-mcp static tools/javap), never guess; record corrections in `MODLOG.md`.
- `core` has zero `net.minecraft`/`net.fabricmc` imports (`CoreBoundaryTest`).
- Tuning numbers (catch-up rates, floors, caps) live in `core/src/main/resources/dev/smartpets/core/persist/catchup-defaults.json`, never in logic. Unit tests build their own `CatchUpConfig` so tuning never breaks them.
- Persisted data: every record carries `schema`; migrations are a chain `v → v+1`; unknown fields and records from a newer schema are kept verbatim, never dropped or downgraded.
- Server decides: all registry access on the server thread (commands, lifecycle events, `computeOnServer`).
- Dev commands only with `-Dsmartpets.dev=true`, each in its own class. Do not edit S0/S11 classes except the one-line registrations.
- No game runs except `bash scripts/qa/run-client-gametest.sh`; one game instance at a time; no runtime MCP tools.
- Public repo: `bash scripts/qa/leak-check.sh` before every commit. One task = one branch = one PR; Conventional Commits; trailer `Co-Authored-By: <model that did the work> <noreply@anthropic.com>`; human merges. GPL-3.0-or-later.

## Review Focus
- Codec failure → silent fresh registry → overwrite on save. Test: codec fields all `optionalFieldOf`; GameTest reload asserts counts; `PetRegistry.put` validates size so `encode()` cannot throw during save.
- Migration that drops unknown fields or rewrites future-schema records. Tests: `PetRecordCodecTest.migratesV1AndKeepsUnknownFields`, `futureSchemaIsQuarantinedVerbatim`, GameTest after reload.
- Catch-up punishing absence (neglect) or applying uncapped days. Tests: `CatchUpTest.hundredDaysIsCapped`, `absenceNeverCausesNeglect`.
- Age capped together with needs (would break `age = day − birth`). Test: `ageIsNotCapped`.
- Backwards clock producing negative elapsed days. Test: `backwardsClockAppliesNothing`.
- Hardcoded tuning numbers in `CatchUp`. Review: grep for numeric literals in `CatchUp.java`.

## File Structure
```
core/src/main/java/dev/smartpets/core/persist/{Json, PetRecord, PetRecordCodec, PetRegistry, CatchUpConfig, CatchUp}.java
core/src/main/resources/dev/smartpets/core/persist/catchup-defaults.json
core/src/test/java/dev/smartpets/core/persist/{JsonTest, PetRecordCodecTest, PetRegistryTest, CatchUpTest}.java
mod/src/main/java/dev/smartpets/persist/{PetRegistryData, PetLifecycle, PetDevCommands}.java
mod/src/main/java/dev/smartpets/SmartPetsMod.java                         (two lines)
mod/src/gametest/java/dev/smartpets/gametest/PersistenceClientGameTest.java
mod/src/gametest/resources/fabric.mod.json, scripts/qa/run-client-gametest.sh
docs/adr/0004-pet-persistence.md, docs/spec/{SPEC.md, V0-SPIKES.md}, site/data/status.json, README.md, MODLOG.md
```

---

### Task 1: Minimal JSON tree codec in `core`

Tier: RÁPIDO. Branch: `feat/s4-json`. Depends on S0.

**Files:** Create `core/src/main/java/dev/smartpets/core/persist/Json.java`, `core/src/test/java/dev/smartpets/core/persist/JsonTest.java`.

**Interfaces:** Produces `Json.parse(String) : Object` (tree: `LinkedHashMap<String,Object>`, `ArrayList<Object>`, `String`, `Long`, `Double`, `Boolean`, `null`; throws `IllegalArgumentException` on bad input) and `Json.write(Object) : String` (also accepts `Integer`; rejects NaN/Infinity).

- [ ] **Step 1: Write the failing tests**
```java
package dev.smartpets.core.persist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JsonTest {
	@Test
	void roundTripsNestedTreeInOrder() {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("z", 1L);
		m.put("a", Arrays.asList("q\"uo\\te\n\u00e9\u0001", true, null, 0.1, Long.MAX_VALUE, -3L, 1.0E-12));
		m.put("m", new LinkedHashMap<>(Map.of("k", List.of())));
		String text = Json.write(m);
		assertEquals(m, Json.parse(text));
		assertEquals(text, Json.write(Json.parse(text)));
		assertEquals("{\"z\":1,", text.substring(0, 7));
	}

	@Test
	void integersAreLongsAndDecimalsAreDoubles() {
		assertEquals(5L, Json.parse("5"));
		assertEquals(5.0, Json.parse("5.0"));
		assertEquals(2.0, Json.parse(Json.write(2.0)));
	}

	@Test
	void rejectsBadInput() {
		for (String bad : List.of("", "{", "[1,]", "{\"a\":1}x", "{\"a\":1,\"a\":2}", "\"\\x\"", "tru", "{a:1}", "--1")) {
			assertThrows(IllegalArgumentException.class, () -> Json.parse(bad), bad);
		}
		assertThrows(IllegalArgumentException.class, () -> Json.write(Double.NaN));
		assertThrows(IllegalArgumentException.class, () -> Json.write(new Object()));
	}
}
```
- [ ] **Step 2: Run to verify it fails** — `./gradlew :core:test` → FAIL (`Json` not found).
- [ ] **Step 3: Implement** (dense on purpose to keep the plan short; reformat to repo style without changing logic)
```java
package dev.smartpets.core.persist;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Minimal JSON for persisted records: Map (insertion order), List, String, Long, Double, Boolean, null. */
public final class Json {
	private Json() {}

	public static String write(Object value) { StringBuilder sb = new StringBuilder(); write(sb, value); return sb.toString(); }

	private static void write(StringBuilder sb, Object v) {
		switch (v) {
			case null -> sb.append("null");
			case String s -> string(sb, s);
			case Boolean b -> sb.append(b);
			case Long l -> sb.append(l);
			case Integer i -> sb.append(i);
			case Double d -> {
				if (d.isNaN() || d.isInfinite()) { throw new IllegalArgumentException("non-finite number: " + d); }
				sb.append(d); // Double.toString always has '.' or 'E', so it parses back as Double
			}
			case Map<?, ?> m -> {
				sb.append('{');
				boolean first = true;
				for (var e : m.entrySet()) { if (!first) { sb.append(','); } first = false; string(sb, (String) e.getKey()); sb.append(':'); write(sb, e.getValue()); }
				sb.append('}');
			}
			case List<?> l -> {
				sb.append('[');
				for (int i = 0; i < l.size(); i++) { if (i > 0) { sb.append(','); } write(sb, l.get(i)); }
				sb.append(']');
			}
			default -> throw new IllegalArgumentException("unsupported JSON value: " + v.getClass().getName());
		}
	}

	private static void string(StringBuilder sb, String s) {
		sb.append('"');
		for (char c : s.toCharArray()) {
			switch (c) {
				case '"' -> sb.append("\\\"");
				case '\\' -> sb.append("\\\\");
				case '\n' -> sb.append("\\n");
				case '\r' -> sb.append("\\r");
				case '\t' -> sb.append("\\t");
				default -> sb.append(c < 0x20 ? String.format("\\u%04x", (int) c) : String.valueOf(c));
			}
		}
		sb.append('"');
	}

	public static Object parse(String text) {
		Parser p = new Parser(text);
		Object v = p.value();
		p.ws();
		if (p.i != text.length()) { throw p.err("trailing data"); }
		return v;
	}

	private static final class Parser {
		private final String s;
		private int i;

		Parser(String s) { this.s = s; }
		IllegalArgumentException err(String m) { return new IllegalArgumentException("JSON " + m + " at " + i); }
		void ws() { while (i < s.length() && " \t\r\n".indexOf(s.charAt(i)) >= 0) { i++; } }
		char peek() { ws(); if (i >= s.length()) { throw err("unexpected end"); } return s.charAt(i); }
		void expect(char c) { if (peek() != c) { throw err("expected '" + c + "'"); } i++; }

		boolean more(char close) {
			char c = peek();
			i++;
			if (c == ',' || c == close) { return c == ','; }
			throw err("expected ',' or '" + close + "'");
		}

		Object value() {
			char c = peek();
			if (c == '{') {
				i++;
				Map<String, Object> m = new LinkedHashMap<>();
				if (peek() == '}') { i++; return m; }
				do {
					String k = string();
					expect(':');
					if (m.containsKey(k)) { throw err("duplicate key " + k); }
					m.put(k, value());
				} while (more('}'));
				return m;
			}
			if (c == '[') {
				i++;
				List<Object> l = new ArrayList<>();
				if (peek() == ']') { i++; return l; }
				do { l.add(value()); } while (more(']'));
				return l;
			}
			if (c == '"') { return string(); }
			for (String lit : new String[] {"true", "false", "null"}) {
				if (s.startsWith(lit, i)) { i += lit.length(); return lit.equals("null") ? null : Boolean.valueOf(lit); }
			}
			return number();
		}

		String string() {
			expect('"');
			StringBuilder b = new StringBuilder();
			while (true) {
				if (i >= s.length()) { throw err("unterminated string"); }
				char c = s.charAt(i++);
				if (c == '"') { return b.toString(); }
				if (c != '\\') { b.append(c); continue; }
				char e = i < s.length() ? s.charAt(i++) : '?';
				int simple = "\"\\/nrtbf".indexOf(e);
				if (simple >= 0) { b.append("\"\\/\n\r\t\b\f".charAt(simple)); continue; }
				if (e != 'u' || i + 4 > s.length()) { throw err("bad escape \\" + e); }
				b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); // NumberFormatException is an IAE
				i += 4;
			}
		}

		Object number() {
			int start = i;
			while (i < s.length() && "-0123456789.eE+".indexOf(s.charAt(i)) >= 0) { i++; }
			String n = s.substring(start, i);
			if (n.isEmpty()) { throw err("unexpected character"); }
			try {
				// (Object) casts matter: without them the ternary promotes the Long to double.
				return n.matches("-?\\d+") ? (Object) Long.parseLong(n) : (Object) Double.parseDouble(n);
			} catch (NumberFormatException ex) {
				throw err("bad number " + n);
			}
		}
	}
}
```
- [ ] **Step 4: Run to verify it passes** — `./gradlew :core:test` → PASS (existing + 3).
- [ ] **Step 5: Commit** — `bash scripts/qa/leak-check.sh && git add core/src && git commit -m "feat(core): add minimal JSON tree codec for S4 persistence"`

---

### Task 2: `PetRecord`, schema v2, v1→v2 migration, unknown fields, quarantine

Tier: MÉDIO. Branch: `feat/s4-record` (from `feat/s4-json`). Depends on Task 1.

**Files:** Create `core/src/main/java/dev/smartpets/core/persist/{PetRecord,PetRecordCodec,PetRegistry}.java`, tests `PetRecordCodecTest.java`, `PetRegistryTest.java`.

**Interfaces:**
- `record PetRecord(UUID id, String name, long birthDay, Map<String,Double> genes, double satiety, double energy, double companionship, long lastSeenDay, long ageDays, Map<String,Object> extra)`; `static newborn(UUID, String, long birthDay)`; `withState(double satiety, double energy, double companionship, long lastSeenDay, long ageDays)`. `genes` is a placeholder (SPEC §5 later); `extra` = unknown fields, written back.
- `PetRecordCodec.CURRENT_SCHEMA = 2`; `encode(PetRecord) : String` (throws `IllegalStateException` above 65535 modified-UTF-8 bytes); `decode(String) : Decoded` = `Ok(PetRecord record, long fromSchema)` | `Quarantined(String raw, String reason)`.
- `PetRegistry`: `load(List<String>, List<LoadEvent>)`, `addRaw(String, List<LoadEvent>)`, `put(PetRecord)` (validates size), `get(UUID)`, `all()`, `size()`, `quarantined()`, `encode() : List<String>` (records, then quarantined raw verbatim), `catchUpAll(long, CatchUpConfig)` (Task 3). `record LoadEvent(String type, String detail)` with types `PET_MIGRATED`, `PET_QUARANTINED`.
- Schema v1 (legacy test format): `born` (day), `hunger` (0 full..1 starving), no `age_days`. v2: `birth_day`, `satiety` = 1 − hunger, `age_days` (0 after migration; S11 rule recomputes it at the next catch-up).

- [ ] **Step 1: Write the failing tests**

`PetRecordCodecTest.java`:
```java
package dev.smartpets.core.persist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PetRecordCodecTest {
	static final String V1 = "{\"schema\":1,\"id\":\"00000000-0000-0000-0000-0000000000a1\",\"name\":\"Old\",\"born\":2,\"hunger\":0.2,"
		+ "\"energy\":0.5,\"companionship\":0.9,\"last_seen_day\":5,\"genes\":{\"courage\":0.7},\"x_future_field\":{\"a\":[1,2]}}";
	static final String FUTURE = "{\"schema\":99,\"id\":\"00000000-0000-0000-0000-0000000000f9\",\"shape\":\"unknown\"}";

	@Test
	void roundTripsCurrentSchema() {
		PetRecord r = new PetRecord(UUID.randomUUID(), "Rex", 3, Map.of("courage", 0.25), 0.5, 1.25, 0.75, 9, 6, Map.of("later", 1L));
		var ok = assertInstanceOf(PetRecordCodec.Ok.class, PetRecordCodec.decode(PetRecordCodec.encode(r)));
		assertEquals(r, ok.record());
		assertEquals(2, ok.fromSchema());
	}

	@Test
	void migratesV1AndKeepsUnknownFields() {
		var ok = assertInstanceOf(PetRecordCodec.Ok.class, PetRecordCodec.decode(V1));
		PetRecord r = ok.record();
		assertEquals(1, ok.fromSchema());
		assertEquals(2, r.birthDay());
		assertEquals(0.8, r.satiety(), 1e-12);
		assertEquals(0.7, r.genes().get("courage"), 1e-12);
		assertEquals(Map.of("a", java.util.List.of(1L, 2L)), r.extra().get("x_future_field"));
		String again = PetRecordCodec.encode(r);
		assertTrue(again.startsWith("{\"schema\":2,"), again);
		assertTrue(again.contains("\"x_future_field\":{\"a\":[1,2]}"), again);
		assertTrue(!again.contains("\"born\"") && !again.contains("\"hunger\""), again);
	}

	@Test
	void futureSchemaIsQuarantinedVerbatim() {
		var q = assertInstanceOf(PetRecordCodec.Quarantined.class, PetRecordCodec.decode(FUTURE));
		assertEquals(FUTURE, q.raw());
		assertTrue(q.reason().contains("newer"), q.reason());
	}

	@Test
	void brokenRecordsAreQuarantinedNotThrown() {
		for (String bad : new String[] {"not json", "[1]", "{\"id\":\"x\"}", "{\"schema\":2,\"id\":\"nope\"}", "{\"schema\":0}"}) {
			assertInstanceOf(PetRecordCodec.Quarantined.class, PetRecordCodec.decode(bad), bad);
		}
	}

	@Test
	void refusesRecordsTooLargeForOneNbtString() {
		PetRecord big = PetRecord.newborn(UUID.randomUUID(), "x".repeat(70_000), 0);
		assertThrows(IllegalStateException.class, () -> PetRecordCodec.encode(big));
	}
}
```
`PetRegistryTest.java`:
```java
package dev.smartpets.core.persist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PetRegistryTest {
	@Test
	void loadsMigratesAndWritesBackQuarantinedVerbatim() {
		String rex = PetRecordCodec.encode(PetRecord.newborn(UUID.randomUUID(), "Rex", 4));
		List<PetRegistry.LoadEvent> events = new ArrayList<>();
		PetRegistry reg = PetRegistry.load(List.of(PetRecordCodecTest.V1, PetRecordCodecTest.FUTURE, rex, rex), events);
		assertEquals(2, reg.size());
		assertEquals(List.of("PET_MIGRATED", "PET_QUARANTINED", "PET_QUARANTINED"), events.stream().map(PetRegistry.LoadEvent::type).toList());
		List<String> out = reg.encode();
		assertEquals(4, out.size());
		assertEquals(List.of(PetRecordCodecTest.FUTURE, rex), out.subList(2, 4));
		assertEquals(out, PetRegistry.load(out, new ArrayList<>()).encode());
	}

	@Test
	void putRejectsOversizedRecordBeforeSaveTime() {
		PetRegistry reg = new PetRegistry();
		assertThrows(IllegalStateException.class, () -> reg.put(PetRecord.newborn(UUID.randomUUID(), "x".repeat(70_000), 0)));
		assertEquals(0, reg.size());
	}
}
```
(Second `rex` is a duplicate id → quarantined verbatim, so a hand-edited save never loses data.)
- [ ] **Step 2: Run to verify it fails** — `./gradlew :core:test` → FAIL (types not found).
- [ ] **Step 3: Implement**

`PetRecord.java`:
```java
package dev.smartpets.core.persist;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Source of truth for one pet (SPEC §3). The entity is only a view. */
public record PetRecord(UUID id, String name, long birthDay, Map<String, Double> genes, double satiety, double energy,
		double companionship, long lastSeenDay, long ageDays, Map<String, Object> extra) {
	public PetRecord {
		Objects.requireNonNull(id, "id");
		Objects.requireNonNull(name, "name");
		genes = Collections.unmodifiableMap(new LinkedHashMap<>(genes));
		extra = Collections.unmodifiableMap(new LinkedHashMap<>(extra)); // not Map.copyOf: unknown JSON nulls must survive
	}

	public static PetRecord newborn(UUID id, String name, long birthDay) {
		return new PetRecord(id, name, birthDay, Map.of(), 1.0, 1.0, 1.0, birthDay, 0, Map.of());
	}

	public PetRecord withState(double satiety, double energy, double companionship, long lastSeenDay, long ageDays) {
		return new PetRecord(id, name, birthDay, genes, satiety, energy, companionship, lastSeenDay, ageDays, extra);
	}
}
```
`PetRecordCodec.java`:
```java
package dev.smartpets.core.persist;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;

/** Versioned text format of one PetRecord. Decode never throws: bad input is quarantined and kept verbatim. */
public final class PetRecordCodec {
	public static final int CURRENT_SCHEMA = 2;
	/** One NBT StringTag is written with DataOutput#writeUTF: at most 65535 bytes of modified UTF-8. */
	public static final int MAX_MODIFIED_UTF8_BYTES = 65535;
	private static final Set<String> KNOWN = Set.of("schema", "id", "name", "birth_day", "genes", "satiety", "energy",
		"companionship", "last_seen_day", "age_days");
	/** Key v migrates a map of schema v to schema v+1. */
	private static final Map<Integer, UnaryOperator<Map<String, Object>>> MIGRATIONS = Map.of(1, PetRecordCodec::v1ToV2);

	public sealed interface Decoded permits Ok, Quarantined {}
	public record Ok(PetRecord record, long fromSchema) implements Decoded {}
	public record Quarantined(String raw, String reason) implements Decoded {}

	private PetRecordCodec() {}

	public static String encode(PetRecord r) {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("schema", (long) CURRENT_SCHEMA);
		m.put("id", r.id().toString());
		m.put("name", r.name());
		m.put("birth_day", r.birthDay());
		m.put("genes", new LinkedHashMap<>(r.genes()));
		m.put("satiety", r.satiety());
		m.put("energy", r.energy());
		m.put("companionship", r.companionship());
		m.put("last_seen_day", r.lastSeenDay());
		m.put("age_days", r.ageDays());
		r.extra().forEach(m::putIfAbsent); // known fields always win
		String json = Json.write(m);
		int size = modifiedUtf8Length(json);
		if (size > MAX_MODIFIED_UTF8_BYTES) {
			throw new IllegalStateException("pet record " + r.id() + " is " + size + " bytes, max " + MAX_MODIFIED_UTF8_BYTES);
		}
		return json;
	}

	@SuppressWarnings("unchecked")
	public static Decoded decode(String raw) {
		Map<String, Object> m;
		try {
			if (!(Json.parse(raw) instanceof Map<?, ?> parsed)) { return new Quarantined(raw, "not a JSON object"); }
			m = (Map<String, Object>) parsed;
		} catch (IllegalArgumentException e) {
			return new Quarantined(raw, "unparseable: " + e.getMessage());
		}
		if (!(m.get("schema") instanceof Long from)) { return new Quarantined(raw, "missing schema"); }
		if (from > CURRENT_SCHEMA) { return new Quarantined(raw, "schema " + from + " is newer than " + CURRENT_SCHEMA); }
		if (from < 1) { return new Quarantined(raw, "invalid schema " + from); }
		try {
			for (int v = (int) (long) from; v < CURRENT_SCHEMA; v++) {
				m = MIGRATIONS.get(v).apply(m);
				m.put("schema", (long) (v + 1));
			}
			return new Ok(fromMap(m), from);
		} catch (RuntimeException e) {
			return new Quarantined(raw, "invalid: " + e);
		}
	}

	/** v1 -> v2: "born" renamed "birth_day"; "hunger" (0 full..1 starving) becomes "satiety" = 1 - hunger; "age_days" added. */
	static Map<String, Object> v1ToV2(Map<String, Object> in) {
		Map<String, Object> m = new LinkedHashMap<>(in);
		m.put("birth_day", req(m.remove("born"), "born"));
		m.put("satiety", 1.0 - ((Number) req(m.remove("hunger"), "hunger")).doubleValue());
		m.putIfAbsent("age_days", 0L);
		return m;
	}

	private static PetRecord fromMap(Map<String, Object> m) {
		Map<String, Double> genes = new LinkedHashMap<>();
		if (m.get("genes") instanceof Map<?, ?> g) { g.forEach((k, v) -> genes.put((String) k, ((Number) v).doubleValue())); }
		Map<String, Object> extra = new LinkedHashMap<>(m);
		extra.keySet().removeAll(KNOWN);
		return new PetRecord(UUID.fromString((String) req(m.get("id"), "id")), (String) req(m.get("name"), "name"),
			num(m, "birth_day").longValue(), genes, num(m, "satiety").doubleValue(), num(m, "energy").doubleValue(),
			num(m, "companionship").doubleValue(), num(m, "last_seen_day").longValue(), num(m, "age_days").longValue(), extra);
	}

	private static Number num(Map<String, Object> m, String key) { return (Number) req(m.get(key), key); }

	private static Object req(Object v, String key) {
		if (v == null) { throw new IllegalArgumentException("missing field " + key); }
		return v;
	}

	static int modifiedUtf8Length(String s) {
		int n = 0;
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			n += (c >= 0x0001 && c <= 0x007F) ? 1 : (c <= 0x07FF ? 2 : 3);
		}
		return n;
	}
}
```
`PetRegistry.java` (catch-up method added in Task 3):
```java
package dev.smartpets.core.persist;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** All pet records of one world, by id, in insertion order, plus records we must keep but cannot read. */
public final class PetRegistry {
	public record LoadEvent(String type, String detail) {}

	private final Map<UUID, PetRecord> pets = new LinkedHashMap<>();
	private final List<String> quarantined = new ArrayList<>();

	public static PetRegistry load(List<String> raw, List<LoadEvent> events) {
		PetRegistry r = new PetRegistry();
		raw.forEach(s -> r.addRaw(s, events));
		return r;
	}

	public void addRaw(String raw, List<LoadEvent> events) {
		switch (PetRecordCodec.decode(raw)) {
			case PetRecordCodec.Ok ok when pets.containsKey(ok.record().id()) -> {
				quarantined.add(raw);
				events.add(new LoadEvent("PET_QUARANTINED", "duplicate id " + ok.record().id()));
			}
			case PetRecordCodec.Ok ok -> {
				pets.put(ok.record().id(), ok.record());
				if (ok.fromSchema() != PetRecordCodec.CURRENT_SCHEMA) {
					events.add(new LoadEvent("PET_MIGRATED", ok.record().id() + " from v" + ok.fromSchema()));
				}
			}
			case PetRecordCodec.Quarantined q -> {
				quarantined.add(q.raw());
				events.add(new LoadEvent("PET_QUARANTINED", q.reason()));
			}
		}
	}

	/** Validates the encoded size now, so saving can never fail later. */
	public void put(PetRecord record) { PetRecordCodec.encode(record); pets.put(record.id(), record); }
	public Optional<PetRecord> get(UUID id) { return Optional.ofNullable(pets.get(id)); }
	public Collection<PetRecord> all() { return List.copyOf(pets.values()); }
	public int size() { return pets.size(); }
	public List<String> quarantined() { return List.copyOf(quarantined); }

	public List<String> encode() {
		List<String> out = new ArrayList<>();
		pets.values().forEach(p -> out.add(PetRecordCodec.encode(p)));
		out.addAll(quarantined);
		return out;
	}
}
```
- [ ] **Step 4: Run to verify it passes** — `./gradlew :core:test` → PASS.
- [ ] **Step 5: Commit** — `bash scripts/qa/leak-check.sh && git add core/src && git commit -m "feat(core): add versioned PetRecord codec, v1-to-v2 migration and pet registry"`

---

### Task 3: Catch-up math with caps (1, 10, 100 days)

Tier: RÁPIDO. Branch: `feat/s4-catchup` (from `feat/s4-record`, plus S11 `feat/s11-core-time` if not merged). Depends on Task 2 and S11 Task 1 (`AgeClock`).

**Files:** Create `CatchUpConfig.java`, `CatchUp.java`, `catchup-defaults.json`, `CatchUpTest.java`; modify `PetRegistry.java` (add `catchUpAll`).

**Interfaces:** `record CatchUpConfig(long forwardJumpDays, long maxCatchUpDays, double satietyLossPerDay, double satietyFloor, double companionshipLossPerDay, double companionshipFloor, double restedEnergy, double neglectThreshold)` with `fromJson(String)`, `defaults()`; `CatchUp.apply(PetRecord, long currentDay, CatchUpConfig) : CatchUp.Result(PetRecord record, long elapsedDays, long appliedDays, List<String> events)`; `CatchUp.isNeglected(PetRecord, CatchUpConfig)`; `PetRegistry#catchUpAll(long, CatchUpConfig) : List<CatchUp.Result>`. Events: `CATCHUP_APPLIED`, `CATCHUP_CAPPED`, `CLOCK_BACKWARDS`, `CLOCK_FORWARD_JUMP`.
Rules: elapsed from `AgeClock.step(lastSeenDay, currentDay, forwardJumpDays)`; applied = min(elapsed, maxCatchUpDays); satiety/companionship lose `rate × applied` but never fall below `min(start, floor)` (absence never punishes); energy = `restedEnergy` when applied > 0; `ageDays = AgeClock.ageDays(...)` (**not capped**: age is world day − birth day); `lastSeenDay = currentDay` always (also after a backwards jump).

- [ ] **Step 1: Write the failing tests**
```java
package dev.smartpets.core.persist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatchUpTest {
	// Test-only tuning, independent of catchup-defaults.json.
	static final CatchUpConfig CFG = new CatchUpConfig(30, 30, 0.25, 0.3, 0.05, 0.4, 1.0, 0.2);
	static final PetRecord REX = PetRecord.newborn(UUID.randomUUID(), "Rex", 0).withState(1.0, 0.5, 1.0, 0, 0);

	@Test
	void oneDay() {
		CatchUp.Result r = CatchUp.apply(REX, 1, CFG);
		assertState(r, 1, 0.75, 1.0, 0.95, 1, List.of("CATCHUP_APPLIED"));
	}

	@Test
	void tenDaysHitsTheSatietyFloor() {
		CatchUp.Result r = CatchUp.apply(REX, 10, CFG);
		assertState(r, 10, 0.3, 1.0, 0.5, 10, List.of("CATCHUP_APPLIED"));
	}

	@Test
	void hundredDaysIsCapped() {
		CatchUp.Result r = CatchUp.apply(REX, 100, CFG);
		assertState(r, 30, 0.3, 1.0, 0.4, 100, List.of("CLOCK_FORWARD_JUMP", "CATCHUP_APPLIED", "CATCHUP_CAPPED"));
		assertEquals(100, r.elapsedDays());
	}

	@Test
	void ageIsNotCapped() {
		assertEquals(1000, CatchUp.apply(REX, 1000, CFG).record().ageDays());
	}

	@Test
	void backwardsClockAppliesNothing() {
		PetRecord seen = REX.withState(0.6, 0.7, 0.8, 40, 40);
		CatchUp.Result r = CatchUp.apply(seen, 20, CFG);
		assertEquals(seen.withState(0.6, 0.7, 0.8, 20, 40), r.record());
		assertEquals(List.of("CLOCK_BACKWARDS"), r.events());
	}

	@Test
	void sameDayChangesNothing() {
		CatchUp.Result r = CatchUp.apply(REX, 0, CFG);
		assertEquals(REX, r.record());
		assertEquals(List.of(), r.events());
	}

	@Test
	void absenceNeverCausesNeglect() {
		for (double start : new double[] {0.25, 0.5, 1.0}) {
			for (long days = 0; days <= 3650; days += 7) {
				PetRecord p = REX.withState(start, 0.5, start, 0, 0);
				assertFalse(CatchUp.isNeglected(CatchUp.apply(p, days, CFG).record(), CFG), start + "/" + days);
			}
		}
	}

	@Test
	void configMustKeepCompanionshipFloorAboveNeglect() {
		assertThrows(IllegalArgumentException.class, () -> new CatchUpConfig(30, 30, 0.25, 0.3, 0.05, 0.1, 1.0, 0.2));
	}

	@Test
	void defaultsLoadFromData() {
		CatchUpConfig d = CatchUpConfig.defaults();
		assertEquals(d, CatchUpConfig.fromJson(Json.write(Json.parse(
			"{\"forward_jump_days\":" + d.forwardJumpDays() + ",\"max_catch_up_days\":" + d.maxCatchUpDays()
				+ ",\"satiety_loss_per_day\":" + d.satietyLossPerDay() + ",\"satiety_floor\":" + d.satietyFloor()
				+ ",\"companionship_loss_per_day\":" + d.companionshipLossPerDay() + ",\"companionship_floor\":" + d.companionshipFloor()
				+ ",\"rested_energy\":" + d.restedEnergy() + ",\"neglect_threshold\":" + d.neglectThreshold() + "}"))));
	}

	private static void assertState(CatchUp.Result r, long applied, double satiety, double energy, double comp, long age, List<String> events) {
		assertEquals(applied, r.appliedDays());
		assertEquals(satiety, r.record().satiety(), 1e-9);
		assertEquals(energy, r.record().energy(), 1e-9);
		assertEquals(comp, r.record().companionship(), 1e-9);
		assertEquals(age, r.record().ageDays());
		assertEquals(events, r.events());
	}
}
```
- [ ] **Step 2: Run to verify it fails** — `./gradlew :core:test` → FAIL (`CatchUp`, `CatchUpConfig` not found).
- [ ] **Step 3: Implement**

`core/src/main/resources/dev/smartpets/core/persist/catchup-defaults.json` (values are [T] examples for playtest tuning):
```json
{"forward_jump_days":30,"max_catch_up_days":30,"satiety_loss_per_day":0.25,"satiety_floor":0.3,"companionship_loss_per_day":0.05,"companionship_floor":0.4,"rested_energy":1.0,"neglect_threshold":0.2}
```
`CatchUpConfig.java`:
```java
package dev.smartpets.core.persist;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Catch-up tuning (SPEC §4, [T]); data, not code. */
public record CatchUpConfig(long forwardJumpDays, long maxCatchUpDays, double satietyLossPerDay, double satietyFloor,
		double companionshipLossPerDay, double companionshipFloor, double restedEnergy, double neglectThreshold) {
	public CatchUpConfig {
		if (forwardJumpDays < 1 || maxCatchUpDays < 1 || satietyLossPerDay < 0 || companionshipLossPerDay < 0 || restedEnergy <= 0) {
			throw new IllegalArgumentException("invalid catch-up config");
		}
		if (companionshipFloor <= neglectThreshold) {
			throw new IllegalArgumentException("companionship_floor must be above neglect_threshold (absence is never neglect)");
		}
	}

	public static CatchUpConfig fromJson(String json) {
		if (!(Json.parse(json) instanceof Map<?, ?> m)) { throw new IllegalArgumentException("catch-up config must be a JSON object"); }
		return new CatchUpConfig(n(m, "forward_jump_days").longValue(), n(m, "max_catch_up_days").longValue(),
			n(m, "satiety_loss_per_day").doubleValue(), n(m, "satiety_floor").doubleValue(),
			n(m, "companionship_loss_per_day").doubleValue(), n(m, "companionship_floor").doubleValue(),
			n(m, "rested_energy").doubleValue(), n(m, "neglect_threshold").doubleValue());
	}

	public static CatchUpConfig defaults() {
		try (InputStream in = CatchUpConfig.class.getResourceAsStream("catchup-defaults.json")) {
			if (in == null) { throw new IllegalStateException("catchup-defaults.json missing from core resources"); }
			return fromJson(new String(in.readAllBytes(), StandardCharsets.UTF_8));
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	private static Number n(Map<?, ?> m, String key) {
		if (!(m.get(key) instanceof Number v)) { throw new IllegalArgumentException("catch-up config: missing number " + key); }
		return v;
	}
}
```
`CatchUp.java`:
```java
package dev.smartpets.core.persist;

import dev.smartpets.core.time.AgeClock;
import dev.smartpets.core.time.DayStep;
import java.util.ArrayList;
import java.util.List;

/** Applies the days a pet was not simulated, with caps (SPEC §4: long absences are never punished like neglect). */
public final class CatchUp {
	public record Result(PetRecord record, long elapsedDays, long appliedDays, List<String> events) {}

	private CatchUp() {}

	public static Result apply(PetRecord p, long currentDay, CatchUpConfig c) {
		DayStep step = AgeClock.step(p.lastSeenDay(), currentDay, c.forwardJumpDays());
		List<String> events = new ArrayList<>();
		if (step.anomaly().journalType() != null) { events.add(step.anomaly().journalType()); }
		long age = AgeClock.ageDays(p.ageDays(), p.birthDay(), currentDay);
		long applied = Math.min(step.elapsedDays(), c.maxCatchUpDays());
		if (applied == 0) {
			return new Result(p.withState(p.satiety(), p.energy(), p.companionship(), currentDay, age), step.elapsedDays(), 0, List.copyOf(events));
		}
		double satiety = decay(p.satiety(), c.satietyLossPerDay(), applied, c.satietyFloor());
		double companionship = decay(p.companionship(), c.companionshipLossPerDay(), applied, c.companionshipFloor());
		events.add("CATCHUP_APPLIED");
		if (applied < step.elapsedDays()) { events.add("CATCHUP_CAPPED"); }
		return new Result(p.withState(satiety, c.restedEnergy(), companionship, currentDay, age), step.elapsedDays(), applied, List.copyOf(events));
	}

	public static boolean isNeglected(PetRecord p, CatchUpConfig c) { return p.companionship() < c.neglectThreshold(); }

	/** Loses perDay per day but never goes below min(value, floor): absence alone never makes things worse than the floor. */
	private static double decay(double value, double perDay, long days, double floor) {
		return Math.max(Math.min(value, floor), value - perDay * days);
	}
}
```
Add to `PetRegistry`:
```java
	public List<CatchUp.Result> catchUpAll(long currentDay, CatchUpConfig config) {
		List<CatchUp.Result> results = new ArrayList<>();
		for (PetRecord p : List.copyOf(pets.values())) {
			CatchUp.Result r = CatchUp.apply(p, currentDay, config);
			pets.put(p.id(), r.record());
			results.add(r);
		}
		return results;
	}
```
- [ ] **Step 4: Run to verify it passes** — `./gradlew :core:test` → PASS (all core tests, boundary test green).
- [ ] **Step 5: Commit** — `bash scripts/qa/leak-check.sh && git add core/src && git commit -m "feat(core): add capped catch-up on load with data-driven tuning"`

---

### Task 4: World `SavedData` adapter, catch-up on load, save/quit/reload GameTest

Tier: FORTE (first saved-data contact; data-loss risk). Branch: `feat/s4-saveddata`. Depends on Tasks 1–3 and S11 Task 2 (`WorldTimeSource`, runner marker loop).

**Files:** Create `mod/src/main/java/dev/smartpets/persist/{PetRegistryData,PetLifecycle,PetDevCommands}.java`, `mod/src/gametest/java/dev/smartpets/gametest/PersistenceClientGameTest.java`. Modify `SmartPetsMod.java`, `mod/src/gametest/resources/fabric.mod.json`, `scripts/qa/run-client-gametest.sh`.

**Interfaces:** `PetRegistryData.TYPE` (`smartpets:pets`), `PetRegistryData.get(MinecraftServer)`, `#registry()` (read), `#put(PetRecord)`, `#importRaw(List<String>)`, `#catchUpAll(long, CatchUpConfig)` (all mutators `setDirty()`); `PetLifecycle.register()` (SERVER_STARTED catch-up, always on); dev commands `/smartpets debug pet add <name> <birthDay>`, `pet dump`, `pet catchup` (log `SMARTPETS_PET ...`, `SMARTPETS_CATCHUP ...`); log marker `SMARTPETS_S4_OK`.

- [ ] **Step 1: Write the failing GameTest**
```java
package dev.smartpets.gametest;

import dev.smartpets.core.persist.CatchUp;
import dev.smartpets.core.persist.CatchUpConfig;
import dev.smartpets.core.persist.PetRecord;
import dev.smartpets.persist.PetRegistryData;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestServerContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.fabricmc.fabric.api.client.gametest.v1.world.TestWorldSave;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@SuppressWarnings("UnstableApiUsage")
public class PersistenceClientGameTest implements FabricClientGameTest {
	private static final Logger LOG = LoggerFactory.getLogger("smartpets-test");
	static final String V1 = "{\"schema\":1,\"id\":\"00000000-0000-0000-0000-0000000000a1\",\"name\":\"Old\",\"born\":2,\"hunger\":0.2,"
		+ "\"energy\":0.5,\"companionship\":0.9,\"last_seen_day\":5,\"genes\":{\"courage\":0.7},\"x_future_field\":{\"a\":[1,2]}}";
	static final String FUTURE = "{\"schema\":99,\"id\":\"00000000-0000-0000-0000-0000000000f9\",\"shape\":\"unknown\"}";

	@Override
	public void runTest(ClientGameTestContext context) {
		TestWorldSave save;
		PetRecord rexBefore;
		try (TestSingleplayerContext sp = context.worldBuilder().create()) {
			TestServerContext server = sp.getServer();
			server.runCommand("gamerule advance_time false");
			server.runCommand("time set 5d");
			server.runCommand("smartpets debug pet add Rex 5");
			server.runOnServer(s -> PetRegistryData.get(s).importRaw(List.of(V1, FUTURE)));
			rexBefore = server.computeOnServer(s -> rex(PetRegistryData.get(s)));
			save = sp.getWorldSave();
		} // quit: the world is saved and closed here
		Path file = save.getSaveDirectory().resolve("data/smartpets/pets.dat");
		check(Files.isRegularFile(file), "pets.dat written at " + save.getSaveDirectory().relativize(file));
		try (TestSingleplayerContext sp = save.open()) {
			TestServerContext server = sp.getServer();
			check(server.computeOnServer(s -> PetRegistryData.get(s).registry().size()) == 2, "2 readable pets after reload");
			check(server.computeOnServer(s -> PetRegistryData.get(s).registry().quarantined()).equals(List.of(FUTURE)), "future record kept verbatim");
			PetRecord rex = server.computeOnServer(s -> rex(PetRegistryData.get(s)));
			check(rex.equals(rexBefore), "Rex unchanged by save/reload: " + rex);
			PetRecord old = server.computeOnServer(s -> PetRegistryData.get(s).registry().get(UUID.fromString("00000000-0000-0000-0000-0000000000a1")).orElseThrow());
			check(old.birthDay() == 2 && Math.abs(old.satiety() - 0.8) < 1e-9 && old.extra().containsKey("x_future_field"), "v1 migrated, unknown field kept: " + old);
			server.runCommand("time add 10d");
			server.runCommand("smartpets debug pet catchup");
			PetRecord after = server.computeOnServer(s -> rex(PetRegistryData.get(s)));
			PetRecord expected = CatchUp.apply(rexBefore, 15, CatchUpConfig.defaults()).record();
			check(after.equals(expected), "in-game catch-up equals core math: " + after + " vs " + expected);
			check(after.ageDays() == 10 && after.lastSeenDay() == 15, "age 10 and last seen day 15");
		}
		LOG.info("SMARTPETS_S4_OK");
	}

	private static PetRecord rex(PetRegistryData data) {
		return data.registry().all().stream().filter(p -> p.name().equals("Rex")).findFirst().orElseThrow();
	}

	private static void check(boolean ok, String what) {
		if (!ok) {
			throw new AssertionError("S4 failed: " + what);
		}
		LOG.info("S4 ok: {}", what);
	}
}
```
Add `"dev.smartpets.gametest.PersistenceClientGameTest"` to the `fabric-client-gametest` list in `mod/src/gametest/resources/fabric.mod.json`; in `scripts/qa/run-client-gametest.sh` change the marker loop to `for marker in SMARTPETS_S11_OK SMARTPETS_S4_OK; do`.
- [ ] **Step 2: Verify it fails** — `./gradlew build` → FAIL at `:mod:compileGametestJava` (`dev.smartpets.persist.PetRegistryData` missing).
- [ ] **Step 3: Implement the adapter**

`PetRegistryData.java`:
```java
package dev.smartpets.persist;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import dev.smartpets.DevCommands;
import dev.smartpets.SmartPetsMod;
import dev.smartpets.core.persist.CatchUp;
import dev.smartpets.core.persist.CatchUpConfig;
import dev.smartpets.core.persist.PetRecord;
import dev.smartpets.core.persist.PetRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.saveddata.SavedDataType;

/** World-level pet registry: <world>/data/smartpets/pets.dat. Server thread only. */
public final class PetRegistryData extends SavedData {
	static final int ADAPTER_FORMAT = 1;
	/** Never fails on structurally valid NBT: a failed parse would make vanilla start empty and overwrite the file. */
	private static final Codec<PetRegistryData> CODEC = RecordCodecBuilder.create(i -> i.group(
			Codec.INT.optionalFieldOf("adapter_format", ADAPTER_FORMAT).forGetter(d -> ADAPTER_FORMAT),
			Codec.STRING.listOf().optionalFieldOf("pets", List.of()).forGetter(d -> d.registry.encode()))
		.apply(i, (format, pets) -> decode(pets)));
	/** dataFixType null: schema and migrations live in core; Fabric API's SavedDataStorageMixin skips vanilla datafixing for null. */
	public static final SavedDataType<PetRegistryData> TYPE = new SavedDataType<>(SmartPetsMod.id("pets"), PetRegistryData::new, CODEC, null);

	private final PetRegistry registry;

	private PetRegistryData() {
		this(new PetRegistry());
	}

	private PetRegistryData(PetRegistry registry) {
		this.registry = registry;
	}

	private static PetRegistryData decode(List<String> pets) {
		List<PetRegistry.LoadEvent> events = new ArrayList<>();
		PetRegistry r = PetRegistry.load(pets, events);
		for (PetRegistry.LoadEvent e : events) {
			SmartPetsMod.LOGGER.warn("SMARTPETS_LOAD {} {}", e.type(), e.detail());
			DevCommands.JOURNAL.record(0, e.type(), Map.of("detail", e.detail()));
		}
		SmartPetsMod.LOGGER.info("SMARTPETS_REGISTRY_LOADED pets={} quarantined={}", r.size(), r.quarantined().size());
		return new PetRegistryData(r);
	}

	public static PetRegistryData get(MinecraftServer server) {
		return server.getDataStorage().computeIfAbsent(TYPE);
	}

	public PetRegistry registry() {
		return registry;
	}

	public void put(PetRecord record) {
		registry.put(record);
		setDirty();
	}

	public void importRaw(List<String> raw) {
		List<PetRegistry.LoadEvent> events = new ArrayList<>();
		raw.forEach(s -> registry.addRaw(s, events));
		events.forEach(e -> SmartPetsMod.LOGGER.warn("SMARTPETS_LOAD {} {}", e.type(), e.detail()));
		setDirty();
	}

	public List<CatchUp.Result> catchUpAll(long currentDay, CatchUpConfig config) {
		List<CatchUp.Result> results = registry.catchUpAll(currentDay, config);
		setDirty();
		return results;
	}
}
```
`PetLifecycle.java`:
```java
package dev.smartpets.persist;

import dev.smartpets.DevCommands;
import dev.smartpets.SmartPetsMod;
import dev.smartpets.core.persist.CatchUp;
import dev.smartpets.core.persist.CatchUpConfig;
import dev.smartpets.core.time.WorldTimeSample;
import dev.smartpets.time.WorldTimeSource;
import java.util.List;
import java.util.Map;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.server.MinecraftServer;

/** Catch-up on load (SPEC §4). Config comes from core data for now; a config file is a later task. */
public final class PetLifecycle {
	private PetLifecycle() {
	}

	public static void register() {
		ServerLifecycleEvents.SERVER_STARTED.register(server -> catchUp(server, "load"));
	}

	public static List<CatchUp.Result> catchUp(MinecraftServer server, String reason) {
		WorldTimeSample now = WorldTimeSource.sample(server);
		List<CatchUp.Result> results = PetRegistryData.get(server).catchUpAll(now.worldDay(), CatchUpConfig.defaults());
		for (CatchUp.Result r : results) {
			SmartPetsMod.LOGGER.info("SMARTPETS_CATCHUP reason={} id={} elapsed={} applied={} events={}", reason, r.record().id(), r.elapsedDays(), r.appliedDays(), r.events());
			for (String type : r.events()) {
				DevCommands.JOURNAL.record(now.gameTime(), type, Map.of("id", r.record().id().toString(), "applied", Long.toString(r.appliedDays())));
			}
		}
		return results;
	}
}
```
`PetDevCommands.java`:
```java
package dev.smartpets.persist;

import com.mojang.brigadier.arguments.LongArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import dev.smartpets.DevMode;
import dev.smartpets.SmartPetsMod;
import dev.smartpets.core.persist.PetRecord;
import dev.smartpets.core.persist.PetRecordCodec;
import dev.smartpets.time.WorldTimeSource;
import java.util.UUID;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

/** Dev-only: /smartpets debug pet add|dump|catchup. No entity is spawned (S3). */
public final class PetDevCommands {
	private PetDevCommands() {
	}

	public static void register() {
		if (!DevMode.enabled()) {
			return;
		}
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
			dispatcher.register(Commands.literal("smartpets").then(Commands.literal("debug").then(Commands.literal("pet")
				.then(Commands.literal("add").then(Commands.argument("name", StringArgumentType.word())
					.then(Commands.argument("birthDay", LongArgumentType.longArg(0)).executes(ctx -> {
						var server = ctx.getSource().getServer();
						long today = WorldTimeSource.sample(server).worldDay();
						PetRecord p = PetRecord.newborn(UUID.randomUUID(), StringArgumentType.getString(ctx, "name"), LongArgumentType.getLong(ctx, "birthDay"))
							.withState(1.0, 1.0, 1.0, today, 0);
						PetRegistryData.get(server).put(p);
						return say(ctx.getSource(), "SMARTPETS_PET added " + PetRecordCodec.encode(p));
					}))))
				.then(Commands.literal("dump").executes(ctx -> {
					var data = PetRegistryData.get(ctx.getSource().getServer());
					data.registry().all().forEach(p -> SmartPetsMod.LOGGER.info("SMARTPETS_PET {}", PetRecordCodec.encode(p)));
					return say(ctx.getSource(), "SMARTPETS_PET count=" + data.registry().size() + " quarantined=" + data.registry().quarantined().size());
				}))
				.then(Commands.literal("catchup").executes(ctx ->
					say(ctx.getSource(), "SMARTPETS_CATCHUP done=" + PetLifecycle.catchUp(ctx.getSource().getServer(), "command").size())))))));
	}

	private static int say(net.minecraft.commands.CommandSourceStack source, String line) {
		SmartPetsMod.LOGGER.info(line);
		source.sendSuccess(() -> Component.literal(line), false);
		return 1;
	}
}
```
In `SmartPetsMod.onInitialize()` after the existing registrations add `dev.smartpets.persist.PetLifecycle.register();` and `dev.smartpets.persist.PetDevCommands.register();`.
- [ ] **Step 4: Build and run in game**

Run: `./gradlew build` → BUILD SUCCESSFUL. Then `bash scripts/qa/run-client-gametest.sh` → exit 0; log contains, in order: `SMARTPETS_PET added`, `SMARTPETS_LOAD PET_MIGRATED`, `SMARTPETS_LOAD PET_QUARANTINED schema 99 is newer than 2`, `S4 ok: pets.dat written ...`, `SMARTPETS_REGISTRY_LOADED pets=2 quarantined=1` (after reopen), `SMARTPETS_CATCHUP reason=load ... applied=0`, `SMARTPETS_CATCHUP reason=command ... applied=10 events=[CATCHUP_APPLIED]`, `SMARTPETS_S4_OK`.
If `pets.dat` is missing after close (closing did not save), add `server.runCommand("save-all flush")` before the first `}` only as a diagnosis, record which one made it pass in `MODLOG.md`, and report "quit without explicit save not proven" to the Reviewer. If `null` dataFixType throws on load (the Fabric mixin is not applied), switch to a vanilla `DataFixTypes` value only after the Architect approves (it would run vanilla fixers on our data) and record it.
Also inspect the file offline (no game running): `python3 -c "import gzip,sys;print(len(gzip.open(sys.argv[1]).read()))" <path printed in the log>` → non-zero size.
- [ ] **Step 5: Leak check, log, commit**

`MODLOG.md`: date, the logged lines above, file path pattern (`data/smartpets/pets.dat`, relative), gotchas.
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "feat(mod): store pet registry in world saved data with catch-up on load and S4 GameTest"
```

---

### Task 5: Close S4 (ADR, spec, status)

Tier: FORTE (Architect). Branch: `docs/s4-close`. Depends on Task 4 evidence.

- [ ] **Step 1: ADR `docs/adr/0004-pet-persistence.md`** (next free number): format decision and rejected options (above), the `SavedData` data-loss trap and how the codec avoids it, `null` `DataFixTypes` relying on Fabric API (evidence: bytecode + GameTest), 65535-byte limit per pet, quarantine policy (future schema, unparseable, duplicate id kept verbatim), migration chain rule, catch-up rules and that age is not capped, which feature scenarios are now covered (06: "Long absences are capped", "Old save data is migrated", "Pet data survives saving and reloading" minus cues).
- [ ] **Step 2: SPEC** §3/§4: link ADR-0004; note in §4 that "aging uses caps" conflicts with `age = day − birth` (age uncapped in S4) → add to `specs/UNSPECIFIED.md` and ask the human.
- [ ] **Step 3: `docs/spec/V0-SPIKES.md`** S4 status (PASS / PASS-WITH-FALLBACK, what was not verified), `site/data/status.json` + README roadmap row, `bash scripts/qa/docs-freshness.sh`.
- [ ] **Step 4: Commit** — `bash scripts/qa/leak-check.sh && git add -A && git commit -m "docs: close V0-S4 persistence with ADR and status"`

---

## Out of scope for S4 (explicit)
Custom entity and entity↔record sync (S3); go-home travel state (S5); cues/mastery/bond fields (V1); a user-editable config file (catch-up defaults are core data for now); backups of `pets.dat`; multiplayer ownership.

## Self-Review Notes
- Spec coverage: save/quit/reload (T4), v1→v2 migration test (T2 unit + T4 in game), catch-up 1/10/100 with caps (T3), unknown fields preserved (T2 unit + T4 in game), registry (T2), entity-as-view (no entity; record is the only state).
- Unverified until run: closing a `TestSingleplayerContext` writes saved data; `SERVER_STARTED` fires on `TestWorldSave#open()`; Brigadier merging the third `smartpets` subtree; Fabric mixin handling `null` at runtime (bytecode read only). Each has a diagnosis step.
- Order dependency: S11 Tasks 1–2 before S4 Tasks 3–4; S11 Task 2 and S4 Task 4 both edit `fabric.mod.json` and the runner, so they never run in parallel.
