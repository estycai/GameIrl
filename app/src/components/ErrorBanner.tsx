import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
}) => {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorTitle}>Map Load Error</Text>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.errorButton} onPress={onDismiss}>
        <Text style={styles.errorButtonText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#b91c1c",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  errorTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    marginBottom: 12,
  },
  errorButton: {
    alignSelf: "flex-end",
    backgroundColor: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "#b91c1c",
    fontWeight: "600",
    fontSize: 13,
  },
});
