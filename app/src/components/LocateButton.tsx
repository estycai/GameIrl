import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Theme } from "../theme/themes";

interface LocateButtonProps {
  onPress: () => void;
  theme: Theme;
}

export const LocateButton: React.FC<LocateButtonProps> = ({
  onPress,
  theme,
}) => {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Recenter map on current location"
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <MaterialIcons name="my-location" size={24} color={theme.accent} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});
