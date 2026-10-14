import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Theme } from "../theme/themes";

interface RouteCardProps {
  route: GeoJSON.FeatureCollection;
  theme: Theme;
}

export const RouteCard: React.FC<RouteCardProps> = ({ route, theme }) => {
  let distanceM = 0;
  let durationS = 0;

  for (const feature of route.features) {
    if (feature.properties?.kind === "route") {
      distanceM = Number(feature.properties.distance_m ?? 0);
      durationS = Number(feature.properties.duration_s ?? 0);
      break;
    }
  }

  const distanceKm = distanceM / 1000;
  const distanceText = `${distanceKm.toFixed(1)} km`;
  const durationMin = Math.round(durationS / 60);
  const durationText = `${durationMin} min`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.metricBlock}>
        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
          Distance
        </Text>
        <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
          {distanceText}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

      <View style={styles.metricBlock}>
        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
          Duration
        </Text>
        <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
          {durationText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  metricBlock: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  divider: {
    width: 1,
    height: 28,
    opacity: 0.4,
  },
});
