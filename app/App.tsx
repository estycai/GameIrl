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
  Marker,
  type CameraRef,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";

import { type AppPhase, cameraModeForPhase } from "./src/app/phases";
import {
  getCameraStop,
  getRouteOrigin,
} from "./src/camera/cameraModes";
import { ErrorBanner } from "./src/components/ErrorBanner";
import { LocateButton } from "./src/components/LocateButton";
import { MapPin } from "./src/components/MapPin";
import { NavBanner } from "./src/components/NavBanner";
import { PreviewBanner } from "./src/components/PreviewBanner";
import { RoutePreviewCard } from "./src/components/RoutePreviewCard";
import { SearchBox } from "./src/components/SearchBox";
import { TemplateSwitcher } from "./src/components/TemplateSwitcher";
import { buildRouteGeometry, type RouteGeometry } from "./src/nav/routeProgress";
import { useRouteSimulation } from "./src/nav/useRouteSimulation";
import { vehicleCorePaint, vehicleHaloPaint } from "./src/nav/vehiclePaint";
import { fetchOsrmRoute, type OsrmRouteResult } from "./src/routing/osrm";
import { resolveRouteState } from "./src/routing/routeLogic";
import { type Place } from "./src/search/places";
import {
  buildStyle,
  type TemplateKey,
} from "./src/style/buildStyle";
import { getTheme } from "./src/theme/themes";
import { useUserLocation } from "./src/location/useUserLocation";

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const TOP_INSET =
  Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 48;
const BOTTOM_INSET = Platform.OS === "ios" ? 34 : 16;

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("browse");
  const [templateKey, setTemplateKey] = useState<TemplateKey>("miami-6");
  const [destination, setDestination] = useState<Place | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);

  // Dynamic route state
  const [routeResult, setRouteResult] = useState<OsrmRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [mapError, setMapError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { location, permission, requestPermission } = useUserLocation();

  const cameraRef = useRef<CameraRef>(null);
  // Keep the latest GPS fix in a ref and read it when fetching
  const locationRef = useRef<[number, number] | null>(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Request ID tracking and AbortController tracking for in-flight requests
  const requestIdRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Cache base styles per template (bounded to the 3 templates)
  const baseStyleCache = useRef<Map<TemplateKey, StyleSpecification>>(new Map());
  const hasAutoCenteredRef = useRef(false);
  const pendingLocateRef = useRef(false);

  // Auto-center ONCE on the first GPS fix while phase === "browse"
  useEffect(() => {
    if (location && !hasAutoCenteredRef.current && phase === "browse") {
      hasAutoCenteredRef.current = true;
      cameraRef.current?.flyTo({ center: location, zoom: 15, duration: 800 });
    }
  }, [location, phase]);

  // Back-to-browse recenter: when phase transitions to 'browse', fly to location at zoom 14
  const prevPhaseRef = useRef<AppPhase>(phase);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prevPhase !== "browse" && phase === "browse" && location) {
      cameraRef.current?.flyTo({ center: location, zoom: 14, duration: 800 });
    }
  }, [phase, location]);

  // When a location arrives and pendingLocateRef is true, fly to it at zoom 16 and clear the flag
  useEffect(() => {
    if (location && pendingLocateRef.current) {
      pendingLocateRef.current = false;
      cameraRef.current?.flyTo({ center: location, zoom: 16, duration: 800 });
    }
  }, [location]);

  // Pure function for fetching route with request id tracking
  const fetchRouteForState = useCallback(
    async (destPlace: Place | null, swapped: boolean) => {
      // Abort any in-flight request
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }

      const reqId = ++requestIdRef.current;
      const userLoc = locationRef.current;
      const state = resolveRouteState(destPlace, swapped, userLoc);

      if (state.status === "idle") {
        if (requestIdRef.current === reqId) {
          setRouteResult(null);
          setRouteError(null);
          setRouteLoading(false);
        }
        return;
      }

      if (state.status === "waiting_location") {
        if (requestIdRef.current === reqId) {
          setRouteResult(null);
          setRouteLoading(false);
          setRouteError(state.message);
        }
        return;
      }

      // Clear routeResult when a new fetch starts
      setRouteResult(null);
      setRouteLoading(true);
      setRouteError(null);

      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      try {
        const result = await fetchOsrmRoute(
          state.endpoints.origin,
          state.endpoints.destination,
          { signal: controller.signal }
        );

        if (requestIdRef.current === reqId) {
          setRouteResult(result);
          setRouteError(null);
          setRouteLoading(false);
        }
      } catch (err: unknown) {
        // Ignore errors from superseded calls, and treat AbortError as silent
        if (requestIdRef.current !== reqId) {
          return;
        }

        const isAbort =
          (err instanceof Error && err.name === "AbortError") ||
          (typeof err === "object" && err !== null && (err as any).name === "AbortError");

        if (isAbort) {
          return;
        }

        const msg =
          err instanceof Error
            ? err.message
            : "Could not calculate route. Please try again.";
        setRouteError(msg);
        setRouteResult(null);
        setRouteLoading(false);
      } finally {
        if (activeAbortControllerRef.current === controller) {
          activeAbortControllerRef.current = null;
        }
      }
    },
    []
  );

  // Refetch only on [phase, destination, isSwapped]
  useEffect(() => {
    if (phase === "preview" && destination) {
      void fetchRouteForState(destination, isSwapped);
    }
  }, [phase, destination, isSwapped, fetchRouteForState]);

  // ONE trigger when location goes from null to non-null while preview is waiting for a fix
  const prevLocationRef = useRef<[number, number] | null>(location);
  useEffect(() => {
    const wasNull = prevLocationRef.current === null;
    prevLocationRef.current = location;
    if (wasNull && location !== null && phase === "preview" && destination) {
      void fetchRouteForState(destination, isSwapped);
    }
  }, [location, phase, destination, isSwapped, fetchRouteForState]);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
    };
  }, []);

  // Active route feature collection for the map style overlay
  const activeRouteData = useMemo<GeoJSON.FeatureCollection>(() => {
    if ((phase === "preview" || phase === "nav") && routeResult) {
      return routeResult.featureCollection;
    }
    return EMPTY_FEATURE_COLLECTION;
  }, [phase, routeResult]);

  // Cache base style per template, build style per routeResult identity
  const currentStyle = useMemo(() => {
    let base = baseStyleCache.current.get(templateKey);
    if (!base) {
      base = buildStyle(templateKey, EMPTY_FEATURE_COLLECTION);
      baseStyleCache.current.set(templateKey, base);
    }

    if (activeRouteData.features.length === 0) {
      return base;
    }

    return buildStyle(templateKey, activeRouteData);
  }, [templateKey, activeRouteData, routeResult]);

  const theme = useMemo(() => getTheme(templateKey), [templateKey]);

  // Route geometry for simulation
  const routeGeometry = useMemo<RouteGeometry>(() => {
    if (routeResult) {
      return buildRouteGeometry(routeResult.featureCollection);
    }
    return {
      coordinates: [],
      cumulative: [],
      totalMeters: 0,
    };
  }, [routeResult]);

  const isNavActive = phase === "nav";
  const simulation = useRouteSimulation(
    routeGeometry,
    isNavActive,
    routeResult?.distanceMeters ?? 0,
    routeResult?.durationSeconds ?? 0,
    6
  );

  // Viewport: dynamic simulation position in nav; route bounds in preview; null in browse
  const cameraStop = useMemo(() => {
    if (phase === "nav") {
      return {
        center: simulation.position.center,
        bearing: simulation.position.bearing,
        pitch: 60, // Maximum supported pitch in MapLibre Native
        zoom: 17,
      };
    }
    if (phase === "preview" && routeResult) {
      return getCameraStop("preview", routeResult.featureCollection);
    }
    return null;
  }, [phase, simulation.position.center, simulation.position.bearing, routeResult]);

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
    setDestination(place);
    setIsSwapped(false);
    setPhase("preview");
  }, []);

  const handleSwap = useCallback(() => {
    setIsSwapped((prev) => !prev);
  }, []);

  const resetToBrowse = useCallback(() => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    requestIdRef.current++;
    setPhase("browse");
    setDestination(null);
    setRouteResult(null);
    setRouteError(null);
    setRouteLoading(false);
    setIsSwapped(false);
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
    const detail =
      event?.nativeEvent?.message ??
      String(event?.nativeEvent ?? "Map failed to load");
    setMapError(

      typeof detail === "object" ? JSON.stringify(detail) : String(detail)
    );
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
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [0, 0], zoom: 1 }}
          {...(cameraStop ?? {})}
        />

        {/* User GPS location puck */}
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

        {/* Search destination pin: dropped at place.center */}
        {destination !== null && (phase === "preview" || phase === "nav") && (
          <Marker
            id="destination-pin"
            lngLat={destination.center}
            anchor="bottom"
          >
            <MapPin size={32} color="#EA4335" />
          </Marker>
        )}

        {/* Moving vehicle during navigation */}
        {phase === "nav" && (
          <GeoJSONSource id="nav-vehicle" data={vehicleFeature}>
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

      {/* Top Overlay: Template Switcher and Search/Preview Card */}
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
              biasPoint={location}
            />
          </View>
        )}

        {phase === "preview" && destination && (
          <View style={styles.searchWrapper}>
            <RoutePreviewCard
              originLabel="Your location"
              destinationLabel={destination.name}
              isSwapped={isSwapped}
              onSwap={handleSwap}
              onClose={resetToBrowse}
              theme={theme}
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
          style={[
            styles.bottomBannerWrapper,
            { paddingBottom: BOTTOM_INSET + 12 },
          ]}
        >
          <PreviewBanner
            distanceMeters={routeResult?.distanceMeters ?? null}
            durationSeconds={routeResult?.durationSeconds ?? null}
            loading={routeLoading}
            disabled={routeLoading || routeResult === null}
            errorMessage={routeError}
            onRetry={() => void fetchRouteForState(destination, isSwapped)}
            onStartNav={() => {
              if (routeResult && !routeLoading) {
                setPhase("nav");
              }
            }}
            theme={theme}
          />
        </View>
      )}

      {phase === "nav" && (
        <View
          pointerEvents="box-none"
          style={[
            styles.bottomBannerWrapper,
            { paddingBottom: BOTTOM_INSET + 12 },
          ]}
        >
          <NavBanner
            remainingMeters={simulation.remainingMeters}
            remainingSeconds={simulation.remainingSeconds}
            isFinished={simulation.isFinished}
            onExit={resetToBrowse}
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
