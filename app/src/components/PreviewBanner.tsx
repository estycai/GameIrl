import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Theme } from "../theme/themes";

export interface PreviewBannerProps {
  distanceMeters: number | null;
  durationSeconds: number | null;
  loading: boolean;
  errorMessage: string | null;
  disabled?: boolean;
  onRetry: () => void;
  onStartNav: () => void;
  theme: Theme;
}

export const PreviewBanner: React.FC<PreviewBannerProps> = ({
  distanceMeters,
  durationSeconds,
  loading,
  errorMessage,
  disabled,
  onRetry,
  onStartNav,
  theme,
}) => {
  const distanceKm =
    distanceMeters !== null ? (distanceMeters / 1000).toFixed(1) : "--";
  const durationMin =
    durationSeconds !== null ? Math.round(durationSeconds / 60) : "--";

  const isStartDisabled =
    disabled || loading || distanceMeters === null || durationSeconds === null;

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
      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            Calculating route...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorRow}>
          <Text
            style={[styles.errorText, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {errorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry route calculation"
            activeOpacity={0.8}
            onPress={onRetry}
            style={[styles.retryButton, { borderColor: theme.accent }]}
          >
            <Text style={[styles.retryText, { color: theme.accent }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <View style={styles.metricsContainer}>
            <Text style={[styles.metricsText, { color: theme.textPrimary }]}>
              {distanceKm} km{"  "}·{"  "}{durationMin} min
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Start navigation"
            accessibilityState={{ disabled: isStartDisabled }}
            activeOpacity={isStartDisabled ? 1 : 0.8}
            disabled={isStartDisabled}
            onPress={onStartNav}
            style={[
              styles.startButton,
              {
                backgroundColor: isStartDisabled ? theme.surfaceBorder : theme.accent,
                opacity: isStartDisabled ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.startText,
                {
                  color: isStartDisabled
                    ? theme.textSecondary
                    : theme.accentContrast,
                },
              ]}
            >
              Start
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    minHeight: 72,
    justifyContent: "center",
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "700",
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
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  startButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  startText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
