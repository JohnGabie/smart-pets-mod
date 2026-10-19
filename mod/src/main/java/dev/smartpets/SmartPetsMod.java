package dev.smartpets;

import dev.smartpets.time.TimeDevCommands;
import net.fabricmc.api.ModInitializer;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SmartPetsMod implements ModInitializer {
	public static final String MOD_ID = "smartpets";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		DevCommands.register();
		TimeDevCommands.register();
		LOGGER.info("SmartPets initialized (core: {})", dev.smartpets.core.CoreInfo.NAME);
	}

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}
}
