package dev.smartpets.core.time;

public enum TimeAnomaly {
	NONE(null),
	BACKWARDS("CLOCK_BACKWARDS"),
	FORWARD_JUMP("CLOCK_FORWARD_JUMP");

	private final String journalType;

	TimeAnomaly(String journalType) {
		this.journalType = journalType;
	}

	/** Event-journal type to record, or null when nothing unusual happened. */
	public String journalType() {
		return journalType;
	}
}
