package dev.smartpets;

public final class DevMode {
	private DevMode() {
	}

	public static boolean enabled() {
		return Boolean.getBoolean("smartpets.dev");
	}
}
