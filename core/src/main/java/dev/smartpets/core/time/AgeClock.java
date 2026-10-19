package dev.smartpets.core.time;

/** Pure world-day rules (SPEC §4). The world day itself comes from the platform adapter. */
public final class AgeClock {
	private AgeClock() {
	}

	/** age_days = max(previous_age_days, max(0, current_day - birth_day)): never decreases. */
	public static long ageDays(long previousAgeDays, long birthDay, long currentDay) {
		if (previousAgeDays < 0) {
			throw new IllegalArgumentException("previousAgeDays < 0: " + previousAgeDays);
		}
		return Math.max(previousAgeDays, Math.max(0L, currentDay - birthDay));
	}

	/** Elapsed days between two observations. Backwards counts as 0; a large jump is flagged, not dropped. */
	public static DayStep step(long previousDay, long currentDay, long forwardJumpDays) {
		if (forwardJumpDays < 1) {
			throw new IllegalArgumentException("forwardJumpDays < 1: " + forwardJumpDays);
		}
		long delta = currentDay - previousDay;
		if (delta < 0) {
			return new DayStep(previousDay, currentDay, 0, TimeAnomaly.BACKWARDS);
		}
		return new DayStep(previousDay, currentDay, delta, delta >= forwardJumpDays ? TimeAnomaly.FORWARD_JUMP : TimeAnomaly.NONE);
	}
}
