import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { MapPin } from "./MapPin";
import type { Theme } from "../theme/themes";

export interface RoutePreviewCardProps {
  originLabel: string;
  destinationLabel: string;
  isSwapped: boolean;
  onSwap: () => void;
  onClose: () => void;
  theme: Theme;
}

export const RoutePreviewCard: React.FC<RoutePreviewCardProps> = ({
  originLabel,
  destinationLabel,
  isSwapped,
  onSwap,
  onClose,
  theme,
}) => {
  // When swapped: row 1 is the pinned place, row 2 is "Your location"
  const row1Icon = isSwapped ? (
    <MapPin size={20} color="#EA4335" />
  ) : (
    <View style={[styles.hollowCircle, { borderColor: theme.accent }]} />
  );
  const row1Text = isSwapped ? destinationLabel : originLabel;

  const row2Icon = isSwapped ? (
    <View style={[styles.hollowCircle, { borderColor: theme.accent }]} />
  ) : (
    <MapPin size={20} color="#EA4335" />
  );
  const row2Text = isSwapped ? originLabel : destinationLabel;

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
      {/* Left back/close control */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Close route preview"
        onPress={onClose}
        style={styles.closeButton}
      >
        <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
      </TouchableOpacity>

      {/* Center stacked rows with connector */}
      <View style={styles.fieldsContainer}>
        {/* Row 1 */}
        <View style={styles.row}>
          <View style={styles.iconCell}>{row1Icon}</View>
          <Text
            style={[styles.fieldText, { color: theme.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {row1Text}
          </Text>
        </View>

        {/* Dotted vertical connector */}
        <View style={styles.connectorRow}>
          <View style={styles.connectorTrack}>
            <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
            <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
            <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
          </View>
        </View>

        {/* Row 2 */}
        <View style={styles.row}>
          <View style={styles.iconCell}>{row2Icon}</View>
          <Text
            style={[styles.fieldText, { color: theme.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {row2Text}
          </Text>
        </View>
      </View>

      {/* Right swap button */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Swap origin and destination"
        onPress={onSwap}
        style={[styles.swapButton, { borderColor: theme.surfaceBorder }]}
      >
        <MaterialIcons name="swap-vert" size={24} color={theme.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  closeButton: {
    padding: 6,
    marginRight: 6,
  },
  fieldsContainer: {
    flex: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
  },
  iconCell: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  hollowCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    backgroundColor: "transparent",
  },
  connectorRow: {
    height: 12,
    justifyContent: "center",
  },
  connectorTrack: {
    width: 24,
    alignItems: "center",
    gap: 2,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    opacity: 0.6,
  },
  fieldText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  swapButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 12,
  },
});
