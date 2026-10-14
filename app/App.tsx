import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
// Aliased: the exported component is named `Map`, which would shadow the
// JavaScript `Map` constructor used for the style cache below.
import {
  Camera,
  Map as MapLibreMap,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";

import routeDemoJson from "./assets/templates/route-demo.json";
import {
  type CameraMode,
  getCameraStop,
} from "./src/camera/cameraModes";
import { CameraModeBar } from "./src/components/CameraModeBar";
import { RouteCard } from "./src/components/RouteCard";
import { TemplateSwitcher } from "./src/components/TemplateSwitcher";
import {
  buildStyle,
  type TemplateKey,
} from "./src/style/buildStyle";
import { getTheme } from "./src/theme/themes";

const routeData = routeDemoJson as unknown as GeoJSON.FeatureCollection;

// Calculate platform-safe insets without external native modules
const TOP_INSET =
  Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 48;
const BOTTOM_INSET = Platform.OS === "ios" ? 34 : 16;

export default function App() {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("miami-6");
  const [cameraMode, setCameraMode] = useState<CameraMode>("browse");
  const [mapError, setMapError] = useState<string | null>(null);

  // Cache built styles so switching back to a template does not rebuild it
  const styleCache = useRef<Map<TemplateKey, StyleSpecification>>(new Map());

  const currentStyle = useMemo(() => {
    let cached = styleCache.current.get(templateKey);
    if (!cached) {
      cached = buildStyle(templateKey, routeData);
      styleCache.current.set(templateKey, cached);
    }
    return cached;
  }, [templateKey]);

  const theme = useMemo(() => getTheme(templateKey), [templateKey]);

  const cameraStop = useMemo(
    () => getCameraStop(cameraMode, routeData),
    [cameraMode]
  );

  const handleMapFail = useCallback((event: any) => {
    let detail = "Map failed to load";
    if (event?.nativeEvent) {
      if (typeof event.nativeEvent === "string") {
        detail = event.nativeEvent;
      } else if (event.nativeEvent.message) {
        detail = String(event.nativeEvent.message);
      } else {
        try {
          detail = JSON.stringify(event.nativeEvent);
        } catch {
          detail = String(event.nativeEvent);
        }
      }
    }
    setMapError(detail);
  }, []);

  const statusBarStyle =
    templateKey === "miami-6" ? "light" : "dark";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={statusBarStyle} />

      <MapLibreMap
        mapStyle={currentStyle}
        style={styles.map}
        logo={false}
        compass
        onDidFailLoadingMap={handleMapFail}
      >
        <Camera {...cameraStop} />
      </MapLibreMap>

      {/* Top Overlay: Template Switcher and Route Metrics */}
      <View
        pointerEvents="box-none"
        style={[styles.topOverlay, { paddingTop: TOP_INSET + 8 }]}
      >
        <TemplateSwitcher
          currentTemplate={templateKey}
          onSelectTemplate={setTemplateKey}
          theme={theme}
        />
        <View style={styles.cardSpacing}>
          <RouteCard route={routeData} theme={theme} />
        </View>
      </View>

      {/* Bottom Overlay: Camera Modes */}
      <View
        pointerEvents="box-none"
        style={[styles.bottomOverlay, { paddingBottom: BOTTOM_INSET + 12 }]}
      >
        <CameraModeBar
          currentMode={cameraMode}
          onSelectMode={setCameraMode}
          theme={theme}
        />
      </View>

      {/* Visible Error Banner for Map Load Failures */}
      {mapError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Map Load Error</Text>
          <Text style={styles.errorText}>{mapError}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => setMapError(null)}
          >
            <Text style={styles.errorButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    gap: 8,
  },
  cardSpacing: {
    marginTop: 4,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 20,
    right: 20,
  },
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
