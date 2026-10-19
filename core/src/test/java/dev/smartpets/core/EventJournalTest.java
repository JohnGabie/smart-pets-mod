package dev.smartpets.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class EventJournalTest {
	@Test
	void keepsOrderAndDropsOldestBeyondCapacity() {
		EventJournal j = new EventJournal(2);
		j.record(1, "A", Map.of());
		j.record(2, "B", Map.of());
		j.record(3, "C", Map.of());
		var snap = j.snapshot();
		assertEquals(2, snap.size());
		assertEquals("B", snap.get(0).type());
		assertEquals("C", snap.get(1).type());
	}

	@Test
	void writesOneJsonObjectPerLineWithEscaping() {
		EventJournal j = new EventJournal(10);
		j.record(7, "SAY", Map.of("text", "he said \"hi\"\nnext"));
		String out = j.toJsonLines();
		assertEquals(1, out.lines().count());
		assertTrue(out.contains("\\\"hi\\\""));
		assertTrue(out.contains("\\n"));
		assertTrue(out.startsWith("{\"tick\":7,\"type\":\"SAY\""));
	}

	@Test
	void snapshotIsACopy() {
		EventJournal j = new EventJournal(3);
		j.record(1, "A", Map.of());
		var snap = j.snapshot();
		j.record(2, "B", Map.of());
		assertEquals(1, snap.size());
	}
}
