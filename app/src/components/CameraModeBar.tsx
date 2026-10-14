import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { CameraMode } from "../camera/cameraModes";
import type { Theme } from "../theme/themes";

interface CameraModeBarProps {
  currentMode: CameraMode;
  onSelectMode: (mode: CameraMode) => void;
  theme: Theme;
}

const MODE_OPTIONS: Array<{ key: CameraMode; label: string }> = [
  { key: "browse", label: "Browse" },
  { key: "preview", label: "Preview" },
  { key: "nav", label: "Nav" },
];

export const CameraModeBar: React.FC<CameraModeBarProps> = ({
  currentMode,
  onSelectMode,
  theme,
}) => {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {MODE_OPTIONS.map((item) => {
        const isActive = item.key === currentMode;
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectMode(item.key)}
            activeOpacity={0.7}
            style={[
              styles.button,
              isActive && {
                backgroundColor: theme.accent,
                borderColor: theme.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? theme.accentContrast : theme.textPrimary,
                  fontWeight: isActive ? "700" : "500",
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
