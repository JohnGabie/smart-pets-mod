package dev.smartpets.core;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Bounded in-memory event log. Behavior specs and QA assert on this, never on internals. */
public final class EventJournal {
	public record Entry(long tick, String type, Map<String, String> data) {
	}

	private final int capacity;
	private final ArrayDeque<Entry> entries = new ArrayDeque<>();

	public EventJournal(int capacity) {
		if (capacity < 1) {
			throw new IllegalArgumentException("capacity must be >= 1");
		}
		this.capacity = capacity;
	}

	public synchronized void record(long tick, String type, Map<String, String> data) {
		if (entries.size() == capacity) {
			entries.removeFirst();
		}
		entries.addLast(new Entry(tick, type, new TreeMap<>(data)));
	}

	public synchronized List<Entry> snapshot() {
		return new ArrayList<>(entries);
	}

	public synchronized String toJsonLines() {
		StringBuilder sb = new StringBuilder();
		for (Entry e : entries) {
			sb.append("{\"tick\":").append(e.tick()).append(",\"type\":\"").append(esc(e.type())).append("\",\"data\":{");
			boolean first = true;
			for (var kv : e.data().entrySet()) {
				if (!first) {
					sb.append(',');
				}
				first = false;
				sb.append('"').append(esc(kv.getKey())).append("\":\"").append(esc(kv.getValue())).append('"');
			}
			sb.append("}}\n");
		}
		return sb.toString();
	}

	private static String esc(String s) {
		StringBuilder o = new StringBuilder();
		for (char c : s.toCharArray()) {
			switch (c) {
				case '"' -> o.append("\\\"");
				case '\\' -> o.append("\\\\");
				case '\n' -> o.append("\\n");
				case '\r' -> o.append("\\r");
				case '\t' -> o.append("\\t");
				default -> o.append(c < 0x20 ? String.format("\\u%04x", (int) c) : String.valueOf(c));
			}
		}
		return o.toString();
	}
}
