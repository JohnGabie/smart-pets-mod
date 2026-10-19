package dev.smartpets.core.time;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AgeClockTest {
	@Test
	void ageIsWorldDayMinusBirthDay() {
		assertEquals(30, AgeClock.ageDays(0, 10, 40));
	}

	@Test
	void backwardsClockNeverLowersAge() {
		long age = AgeClock.ageDays(0, 10, 40);
		assertEquals(30, AgeClock.ageDays(age, 10, 20));
	}

	@Test
	void ageCatchesUpAfterTheWorldPassesTheOldMaximum() {
		assertEquals(30, AgeClock.ageDays(30, 10, 25));
		assertEquals(35, AgeClock.ageDays(30, 10, 45));
	}

	@Test
	void ageIsNeverNegativeWhenBornAfterTheCurrentDay() {
		assertEquals(0, AgeClock.ageDays(0, 50, 20));
	}

	@Test
	void ageIsMonotonicOverAnArbitraryDaySequence() {
		long[] days = {0, 5, 5, 3, 100, 2, 0, 101, 99_999, 1};
		long age = 0;
		for (long d : days) {
			long next = AgeClock.ageDays(age, 0, d);
			assertTrue(next >= age, "age decreased at day " + d);
			age = next;
		}
		assertEquals(99_999, age);
	}

	@Test
	void stepForwardCountsElapsedDays() {
		DayStep s = AgeClock.step(10, 13, 30);
		assertEquals(3, s.elapsedDays());
		assertEquals(TimeAnomaly.NONE, s.anomaly());
		assertNull(s.anomaly().journalType());
	}

	@Test
	void stepBackwardsIsZeroElapsed() {
		DayStep s = AgeClock.step(40, 20, 30);
		assertEquals(0, s.elapsedDays());
		assertEquals(TimeAnomaly.BACKWARDS, s.anomaly());
		assertEquals("CLOCK_BACKWARDS", s.anomaly().journalType());
	}

	@Test
	void bigForwardStepIsFlaggedButStillCounted() {
		DayStep s = AgeClock.step(0, 100, 30);
		assertEquals(100, s.elapsedDays());
		assertEquals(TimeAnomaly.FORWARD_JUMP, s.anomaly());
		assertEquals("CLOCK_FORWARD_JUMP", s.anomaly().journalType());
	}

	@Test
	void sameDayIsNoStep() {
		assertEquals(new DayStep(7, 7, 0, TimeAnomaly.NONE), AgeClock.step(7, 7, 30));
	}

	@Test
	void rejectsInvalidInput() {
		assertThrows(IllegalArgumentException.class, () -> AgeClock.ageDays(-1, 0, 0));
		assertThrows(IllegalArgumentException.class, () -> AgeClock.step(0, 1, 0));
		assertThrows(IllegalArgumentException.class, () -> new WorldTimeSample(-1, 0, 0));
	}
}
