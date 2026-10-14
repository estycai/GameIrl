import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Theme } from "../theme/themes";

interface NavBannerProps {
  remainingMeters: number;
  remainingSeconds: number;
  isFinished: boolean;
  onExit: () => void;
  theme: Theme;
}

export const NavBanner: React.FC<NavBannerProps> = ({
  remainingMeters,
  remainingSeconds,
  isFinished,
  onExit,
  theme,
}) => {
  const distanceStr =
    remainingMeters >= 1000
      ? `${(remainingMeters / 1000).toFixed(1)} km`
      : `${Math.round(remainingMeters)} m`;

  const durationMin = Math.round(remainingSeconds / 60);
  const timeStr = durationMin > 0 ? `${durationMin} min` : "< 1 min";

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
      <View style={styles.contentRow}>
        {isFinished ? (
          <View style={styles.infoContainer}>
            <Text style={[styles.primaryStatus, { color: theme.accent }]}>
              Arrived at destination
            </Text>
            <Text style={[styles.secondaryStatus, { color: theme.textSecondary }]}>
              Trip completed
            </Text>
          </View>
        ) : (
          <View style={styles.infoContainer}>
            <Text style={[styles.primaryStatus, { color: theme.textPrimary }]}>
              {distanceStr}
              <Text style={[styles.durationSuffix, { color: theme.textSecondary }]}>
                {"   "}·{"   "}
                {timeStr} remaining
              </Text>
            </Text>
            <Text style={[styles.secondaryStatus, { color: theme.textSecondary }]}>
              Navigating along route
            </Text>
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Exit navigation"
          activeOpacity={0.7}
          onPress={onExit}
          style={[styles.exitButton, { borderColor: theme.surfaceBorder }]}
        >
          <MaterialIcons name="close" size={22} color={theme.textPrimary} />
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
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoContainer: {
    flex: 1,
    marginRight: 12,
  },
  primaryStatus: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  durationSuffix: {
    fontSize: 14,
    fontWeight: "500",
  },
  secondaryStatus: {
    fontSize: 12,
    fontWeight: "400",
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
