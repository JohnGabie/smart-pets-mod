package dev.smartpets.gametest;

import dev.smartpets.core.time.AgeClock;
import dev.smartpets.core.time.TimeAnomaly;
import dev.smartpets.core.time.WorldTimeSample;
import dev.smartpets.time.TimeDevCommands;
import dev.smartpets.time.WorldTimeSource;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestServerContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.world.clock.ClockTimeMarkers;
import net.minecraft.world.clock.WorldClocks;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@SuppressWarnings("UnstableApiUsage")
public class TimeSourceClientGameTest implements FabricClientGameTest {
	private static final Logger LOG = LoggerFactory.getLogger("smartpets-test");

	@Override
	public void runTest(ClientGameTestContext context) {
		try (TestSingleplayerContext sp = context.worldBuilder().create()) {
			TestServerContext server = sp.getServer();
			server.runCommand("gamerule advance_time false");
			server.runCommand("time set 10d");
			expectDay(server, 10, "1 time set 10d");
			server.runCommand("time add 1d");
			expectDay(server, 11, "2 time add 1d");
			// 3: what a successful bed sleep calls (ServerLevel#tick, source-read); real bed sleep is a human playtest.
			server.runOnServer(s -> s.clockManager().moveToTimeMarker(
				s.registryAccess().getOrThrow(WorldClocks.OVERWORLD), ClockTimeMarkers.WAKE_UP_FROM_SLEEP));
			expectDay(server, 12, "3 wake_up_from_sleep");
			WorldTimeSample frozen = sample(server);
			context.waitTicks(40);
			WorldTimeSample later = sample(server);
			check(later.dayClockTicks() == frozen.dayClockTicks(), "4 advance_time=false froze the clock", frozen, later);
			check(later.gameTime() > frozen.gameTime(), "4 game time still advances", frozen, later);
			server.runCommand("gamerule advance_time true");
			context.waitTicks(40);
			check(sample(server).dayClockTicks() > later.dayClockTicks(), "5 clock runs again", later, sample(server));
			server.runCommand("gamerule advance_time false");
			server.runCommand("time set 1000");
			expectDay(server, 0, "6 time set 1000 goes backwards");
			check(AgeClock.ageDays(12, 0, 0) == 12, "6 age stays 12 after backwards", null, null);
			check(AgeClock.step(12, 0, 30).anomaly() == TimeAnomaly.BACKWARDS, "6 backwards flagged", null, null);
			server.runCommand("time set noon");
			expectDay(server, 0, "7a marker noon stays on day 0");
			check(sample(server).dayClockTicks() == 6000, "7a marker noon sets clock 6000 (was 1000)", null, sample(server));
			server.runCommand("time set day");
			expectDay(server, 1, "7b marker day moves forward to day 1");
			server.runCommand("smartpets debug time");
			context.waitTicks(2);
			// 8: executing in the nether still reports the overworld clock (same day 1, no anomaly).
			server.runCommand("execute in minecraft:the_nether run smartpets debug time");
			context.waitTicks(2);
			// 9: backwards set is reported by the command path (TIME_SAMPLE + CLOCK_BACKWARDS) and age stays frozen at 1.
			server.runCommand("time set 1000");
			expectDay(server, 0, "9 time set 1000 goes backwards from day 1");
			server.runCommand("smartpets debug time");
			context.waitTicks(2);
			check(AgeClock.ageDays(1, 0, 0) == 1, "9 age stays 1 after backwards", null, null);
			check(TimeDevCommands.journalTypes().contains("CLOCK_BACKWARDS"), "9 journal has CLOCK_BACKWARDS", null, null);
			check(TimeDevCommands.journalTypes().stream().filter("TIME_SAMPLE"::equals).count() == 3, "9 three TIME_SAMPLE entries", null, null);
		}
		LOG.info("SMARTPETS_S11_OK");
	}

	private static WorldTimeSample sample(TestServerContext server) {
		return server.computeOnServer(WorldTimeSource::sample);
	}

	private static void expectDay(TestServerContext server, long day, String step) {
		WorldTimeSample s = sample(server);
		LOG.info("S11 step '{}': {}", step, s);
		check(s.worldDay() == day, step + " expected day " + day, null, s);
	}

	private static void check(boolean ok, String what, WorldTimeSample a, WorldTimeSample b) {
		if (!ok) {
			throw new AssertionError("S11 failed: " + what + " | before=" + a + " after=" + b);
		}
	}
}
