package dev.smartpets.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class CoreBoundaryTest {
	@Test
	void coreHasAName() {
		assertEquals("smartpets-core", CoreInfo.NAME);
	}

	@Test
	void coreNeverImportsMinecraftOrFabric() throws IOException {
		try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
			List<Path> offenders = files.filter(p -> p.toString().endsWith(".java"))
				.filter(p -> {
					try {
						String s = Files.readString(p);
						return s.contains("net.minecraft") || s.contains("net.fabricmc");
					} catch (IOException e) {
						throw new RuntimeException(e);
					}
				}).toList();
			assertTrue(offenders.isEmpty(), "Minecraft/Fabric imports in core: " + offenders);
		}
	}
}
