package dev.smartpets.time;

import dev.smartpets.core.time.WorldTimeSample;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.clock.ServerClockManager;
import net.minecraft.world.clock.WorldClocks;
import net.minecraft.world.timeline.Timelines;

/** Reads the world day from the overworld clock (= F3 "Day #"), whatever dimension the caller is in. Server thread only. */
public final class WorldTimeSource {
	/** Vanilla period of minecraft:day; used only if a datapack removed that timeline. */
	static final long VANILLA_DAY_TICKS = 24000L;

	private WorldTimeSource() {
	}

	public static WorldTimeSample sample(MinecraftServer server) {
		ServerClockManager clocks = server.clockManager();
		long clockTicks = clocks.getTotalTicks(server.registryAccess().getOrThrow(WorldClocks.OVERWORLD));
		long day = server.registryAccess().get(Timelines.OVERWORLD_DAY)
			.map(timeline -> (long) timeline.value().getPeriodCount(clocks))
			.orElseGet(() -> Math.floorDiv(clockTicks, VANILLA_DAY_TICKS));
		return new WorldTimeSample(day, clockTicks, server.overworld().getGameTime());
	}

	public static boolean usingFallback(MinecraftServer server) {
		return server.registryAccess().get(Timelines.OVERWORLD_DAY).isEmpty();
	}
}
