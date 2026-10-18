package dev.smartpets;

import dev.smartpets.core.EventJournal;
import java.util.Map;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

public final class DevCommands {
	public static final EventJournal JOURNAL = new EventJournal(2000);

	private DevCommands() {
	}

	public static void register() {
		if (!DevMode.enabled()) {
			return;
		}
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
			dispatcher.register(Commands.literal("smartpets")
				.then(Commands.literal("debug")
					.then(Commands.literal("ping").executes(ctx -> {
						JOURNAL.record(0, "DEBUG_PING", Map.of());
						SmartPetsMod.LOGGER.info("SMARTPETS_DEBUG_PONG");
						ctx.getSource().sendSuccess(() -> Component.literal("SMARTPETS_DEBUG_PONG"), false);
						return 1;
					})))));
	}
}
