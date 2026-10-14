import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { TemplateKey } from "../style/buildStyle";
import type { Theme } from "../theme/themes";

interface TemplateSwitcherProps {
  currentTemplate: TemplateKey;
  onSelectTemplate: (template: TemplateKey) => void;
  theme: Theme;
}

const TEMPLATE_OPTIONS: Array<{ key: TemplateKey; label: string }> = [
  { key: "miami-6", label: "Miami 6" },
  { key: "1899", label: "1899" },
  { key: "los-angeles", label: "Los Angeles" },
];

export const TemplateSwitcher: React.FC<TemplateSwitcherProps> = ({
  currentTemplate,
  onSelectTemplate,
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
      {TEMPLATE_OPTIONS.map((item) => {
        const isActive = item.key === currentTemplate;
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectTemplate(item.key)}
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
