import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Theme } from "../theme/themes";

interface PreviewBannerProps {
  destinationName: string;
  distanceMeters: number;
  durationSeconds: number;
  onStartNav: () => void;
  onBack: () => void;
  theme: Theme;
}

export const PreviewBanner: React.FC<PreviewBannerProps> = ({
  destinationName,
  distanceMeters,
  durationSeconds,
  onStartNav,
  onBack,
  theme,
}) => {
  const distanceKm = (distanceMeters / 1000).toFixed(1);
  const durationMin = Math.round(durationSeconds / 60);

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {/* Header: Back button + Destination Name */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to browse"
          onPress={onBack}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={[styles.destinationTitle, { color: theme.textPrimary }]}
          numberOfLines={1}
        >
          {destinationName}
        </Text>
      </View>

      {/* Action Row: Metrics + INICIAR Button */}
      <View style={styles.actionRow}>
        <View style={styles.metricsContainer}>
          <Text style={[styles.metricsText, { color: theme.textPrimary }]}>
            {distanceKm} km{"  "}·{"  "}{durationMin} min
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Start navigation"
          activeOpacity={0.8}
          onPress={onStartNav}
          style={[styles.startButton, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.startText, { color: theme.accentContrast }]}>
            INICIAR
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  destinationTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricsContainer: {
    flex: 1,
  },
  metricsText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  startButton: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  startText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});
