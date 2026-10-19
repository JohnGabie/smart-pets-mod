package dev.smartpets.core.time;

public record DayStep(long previousDay, long currentDay, long elapsedDays, TimeAnomaly anomaly) {
}
