import React from "react";
import { StyleSheet, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface MapPinProps {
  size?: number;
  color?: string;
}

/**
 * Teardrop map pin modelled on Google Maps pin.
 * Uses MaterialIcons location-pin / place icon from @expo/vector-icons (built-in).
 * Default color is red #EA4335.
 */
export const MapPin: React.FC<MapPinProps> = ({
  size = 32,
  color = "#EA4335",
}) => {
  return (
    <View style={styles.container}>
      <MaterialIcons name="place" size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
