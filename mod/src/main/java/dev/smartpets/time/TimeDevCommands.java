package dev.smartpets.time;

import dev.smartpets.DevCommands;
import dev.smartpets.DevMode;
import dev.smartpets.SmartPetsMod;
import dev.smartpets.core.time.AgeClock;
import dev.smartpets.core.time.DayStep;
import dev.smartpets.core.time.WorldTimeSample;
import java.util.List;
import java.util.Map;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

/** Dev-only: /smartpets debug time. Brigadier merges this subtree with the S0 one (same literal names). */
public final class TimeDevCommands {
	/** Dev-command threshold only; the product value comes from config (S4). */
	private static final long DEV_FORWARD_JUMP_DAYS = 30;
	private static WorldTimeSample last;

	private TimeDevCommands() {
	}

	/** Journal entry types recorded so far (for tests). */
	public static List<String> journalTypes() {
		return DevCommands.JOURNAL.snapshot().stream().map(e -> e.type()).toList();
	}

	public static void register() {
		if (!DevMode.enabled()) {
			return;
		}
		// "last" belongs to one server run: forget it when a world starts.
		ServerLifecycleEvents.SERVER_STARTING.register(server -> last = null);
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
			dispatcher.register(Commands.literal("smartpets")
				.then(Commands.literal("debug")
					.then(Commands.literal("time").executes(ctx -> {
						var server = ctx.getSource().getServer();
						WorldTimeSample s = WorldTimeSource.sample(server);
						String line = "SMARTPETS_TIME day=" + s.worldDay() + " clock=" + s.dayClockTicks() + " game=" + s.gameTime()
							+ (WorldTimeSource.usingFallback(server) ? " fallback=true" : "");
						DevCommands.JOURNAL.record(s.gameTime(), "TIME_SAMPLE", Map.of("day", Long.toString(s.worldDay()), "clock", Long.toString(s.dayClockTicks())));
						if (last != null) {
							DayStep step = AgeClock.step(last.worldDay(), s.worldDay(), DEV_FORWARD_JUMP_DAYS);
							if (step.anomaly().journalType() != null) {
								DevCommands.JOURNAL.record(s.gameTime(), step.anomaly().journalType(), Map.of("from", Long.toString(step.previousDay()), "to", Long.toString(step.currentDay())));
								line += " anomaly=" + step.anomaly().journalType();
							}
						}
						last = s;
						SmartPetsMod.LOGGER.info(line);
						String reply = line;
						ctx.getSource().sendSuccess(() -> Component.literal(reply), false);
						return 1;
					})))));
	}
}
