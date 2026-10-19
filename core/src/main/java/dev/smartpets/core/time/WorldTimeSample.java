package dev.smartpets.core.time;

/** One reading of the world clock taken by the platform adapter on the server thread. */
public record WorldTimeSample(long worldDay, long dayClockTicks, long gameTime) {
	public WorldTimeSample {
		if (worldDay < 0 || dayClockTicks < 0 || gameTime < 0) {
			throw new IllegalArgumentException("negative time: day=" + worldDay + " clock=" + dayClockTicks + " game=" + gameTime);
		}
	}
}
