import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
// Aliased: the exported component is named `Map`, which would shadow the
// JavaScript `Map` constructor used for the style cache below.
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  type CameraRef,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";

import routeDemoJson from "./assets/templates/route-demo.json";
import { type AppPhase, cameraModeForPhase } from "./src/app/phases";
import {
  getCameraStop,
  getRouteOrigin,
} from "./src/camera/cameraModes";
import { ErrorBanner } from "./src/components/ErrorBanner";
import { LocateButton } from "./src/components/LocateButton";
import { NavBanner } from "./src/components/NavBanner";
import { PreviewBanner } from "./src/components/PreviewBanner";
import { SearchBox } from "./src/components/SearchBox";
import { TemplateSwitcher } from "./src/components/TemplateSwitcher";
import { buildRouteGeometry } from "./src/nav/routeProgress";
import { useRouteSimulation } from "./src/nav/useRouteSimulation";
import { vehicleCorePaint, vehicleHaloPaint } from "./src/nav/vehiclePaint";
import { type Place, PLACES } from "./src/search/places";
import {
  buildStyle,
  type TemplateKey,
} from "./src/style/buildStyle";
import { getTheme } from "./src/theme/themes";
import { useUserLocation } from "./src/location/useUserLocation";

const routeData = routeDemoJson as unknown as GeoJSON.FeatureCollection;
const routeGeometry = buildRouteGeometry(routeData);
const fallbackRouteOrigin = getRouteOrigin(routeData);

let routeDistanceMeters = 6884;
let routeDurationSeconds = 662;
for (const f of routeData.features) {
  if (f.properties?.kind === "route") {
    routeDistanceMeters = Number(f.properties.distance_m ?? 6884);
    routeDurationSeconds = Number(f.properties.duration_s ?? 662);
    break;
  }
}

const TOP_INSET =
  Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 48;
const BOTTOM_INSET = Platform.OS === "ios" ? 34 : 16;

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("browse");
  const [templateKey, setTemplateKey] = useState<TemplateKey>("miami-6");
  const [destination, setDestination] = useState<Place>(PLACES[0]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { location, permission, requestPermission } = useUserLocation();
  const biasPoint = location ?? fallbackRouteOrigin;

  const cameraRef = useRef<CameraRef>(null);
  const styleCache = useRef<Map<TemplateKey, StyleSpecification>>(new Map());
  const hasAutoCenteredRef = useRef(false);
  const pendingLocateRef = useRef(false);

  // Auto-center ONCE on the first GPS fix while phase === "browse"
  useEffect(() => {
    if (location && !hasAutoCenteredRef.current && phase === "browse") {
      hasAutoCenteredRef.current = true;
      cameraRef.current?.flyTo({ center: location, zoom: 15, duration: 800 });
    }
  }, [location, phase]);

  // When a location arrives and pendingLocateRef is true, fly to it at zoom 16 and clear the flag
  useEffect(() => {
    if (location && pendingLocateRef.current) {
      pendingLocateRef.current = false;
      cameraRef.current?.flyTo({ center: location, zoom: 16, duration: 800 });
    }
  }, [location]);

  const currentStyle = useMemo(() => {
    let cached = styleCache.current.get(templateKey);
    if (!cached) {
      cached = buildStyle(templateKey, routeData);
      styleCache.current.set(templateKey, cached);
    }
    return cached;
  }, [templateKey]);

  const theme = useMemo(() => getTheme(templateKey), [templateKey]);

  // NOTE: Routing is still the demo fixture, so the route starts in Haedo
  // whatever the GPS says.
  const isNavActive = phase === "nav";
  const simulation = useRouteSimulation(routeGeometry, isNavActive, 6);

  // Viewport: dynamic simulation position in nav; static preset in browse/preview
  const cameraStop = useMemo(() => {
    if (phase === "nav") {
      return {
        center: simulation.position.center,
        bearing: simulation.position.bearing,
        pitch: 60, // Maximum supported pitch in MapLibre Native
        zoom: 17,
      };
    }
    return getCameraStop(cameraModeForPhase(phase), routeData);
  }, [phase, simulation.position.center, simulation.position.bearing]);

  const vehicleFeature = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: simulation.position.center,
        },
      },
    ],
  }), [simulation.position.center]);

  const userLocationFeature = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!location) return null;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: location,
          },
        },
      ],
    };
  }, [location]);

  const handleSelectPlace = useCallback((place: Place) => {
    // NOTE: There is only one route fixture, so EVERY destination previews that
    // same demo route. We do not fake a different polyline per place.
    setDestination(place);
    setPhase("preview");
  }, []);

  const handleLocate = useCallback(async () => {
    if (location) {
      cameraRef.current?.flyTo({ center: location, zoom: 16, duration: 800 });
      return;
    }

    pendingLocateRef.current = true;
    const granted = await requestPermission();
    if (!granted) {
      pendingLocateRef.current = false;
      setLocationError(
        "Location is off. Allow location access for GameIrl in Settings."
      );
    }
  }, [location, requestPermission]);

  const handleMapFail = useCallback((event: any) => {
    const detail = event?.nativeEvent?.message ?? String(event?.nativeEvent ?? "Map failed to load");
    setMapError(typeof detail === "object" ? JSON.stringify(detail) : String(detail));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={templateKey === "miami-6" ? "light" : "dark"} />

      <MapLibreMap
        mapStyle={currentStyle}
        style={styles.map}
        logo={false}
        compass
        onDidFailLoadingMap={handleMapFail}
      >
        <Camera ref={cameraRef} {...cameraStop} />

        {location !== null && phase !== "nav" && userLocationFeature && (
          <GeoJSONSource id="user-location" data={userLocationFeature}>
            <Layer
              id="user-location-halo"
              type="circle"
              paint={vehicleHaloPaint(templateKey) as any}
            />
            <Layer
              id="user-location-core"
              type="circle"
              paint={vehicleCorePaint(templateKey) as any}
            />
          </GeoJSONSource>
        )}

        {phase === "nav" && (
          <GeoJSONSource id="nav-vehicle" data={vehicleFeature}>
            {/* Paint comes from the template's own puck layers, so the moving
                vehicle matches the stationary puck. See vehiclePaint.ts for
                why theme tokens are the wrong source here. */}
            <Layer
              id="nav-vehicle-halo"
              type="circle"
              paint={vehicleHaloPaint(templateKey) as any}
            />
            <Layer
              id="nav-vehicle-core"
              type="circle"
              paint={vehicleCorePaint(templateKey) as any}
            />
          </GeoJSONSource>
        )}
      </MapLibreMap>

      {/* Top Overlay: Template Switcher and Search */}
      <View
        pointerEvents="box-none"
        style={[styles.topOverlay, { paddingTop: TOP_INSET + 8 }]}
      >
        <TemplateSwitcher
          currentTemplate={templateKey}
          onSelectTemplate={setTemplateKey}
          theme={theme}
        />
        {phase === "browse" && (
          <View style={styles.searchWrapper}>
            <SearchBox
              onSelectPlace={handleSelectPlace}
              theme={theme}
              biasPoint={biasPoint}
            />
          </View>
        )}
      </View>

      {/* Locate button: browse mode only */}
      {phase === "browse" && (
        <View
          pointerEvents="box-none"
          style={[styles.locateWrapper, { bottom: BOTTOM_INSET + 20 }]}
        >
          <LocateButton onPress={handleLocate} theme={theme} />
        </View>
      )}

      {/* Bottom Banners: Preview or Navigation */}
      {phase === "preview" && (
        <View
          pointerEvents="box-none"
          style={[styles.bottomBannerWrapper, { paddingBottom: BOTTOM_INSET + 12 }]}
        >
          <PreviewBanner
            destinationName={destination.name}
            distanceMeters={routeDistanceMeters}
            durationSeconds={routeDurationSeconds}
            onStartNav={() => setPhase("nav")}
            onBack={() => setPhase("browse")}
            theme={theme}
          />
        </View>
      )}

      {phase === "nav" && (
        <View
          pointerEvents="box-none"
          style={[styles.bottomBannerWrapper, { paddingBottom: BOTTOM_INSET + 12 }]}
        >
          <NavBanner
            remainingMeters={simulation.remainingMeters}
            remainingSeconds={simulation.remainingSeconds}
            isFinished={simulation.isFinished}
            onExit={() => setPhase("browse")}
            theme={theme}
          />
        </View>
      )}

      {mapError && (
        <ErrorBanner message={mapError} onDismiss={() => setMapError(null)} />
      )}

      {locationError && (
        <ErrorBanner
          message={locationError}
          onDismiss={() => setLocationError(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    gap: 8,
  },
  searchWrapper: { marginTop: 2 },
  locateWrapper: { position: "absolute", right: 20 },
  bottomBannerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 16,
    right: 16,
  },
});
