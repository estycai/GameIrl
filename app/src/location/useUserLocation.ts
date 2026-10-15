import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { type LngLat } from "../search/photon";

export function useUserLocation(): {
  location: LngLat | null;
  permission: "unknown" | "granted" | "denied";
  requestPermission: () => Promise<boolean>;
} {
  const [location, setLocation] = useState<LngLat | null>(null);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  const isMountedRef = useRef(true);
  const watcherSubscriptionRef = useRef<{ remove(): void } | null>(null);

  const startTracking = () => {
    if (watcherSubscriptionRef.current) {
      return;
    }

    Location.getLastKnownPositionAsync()
      .then((lastKnown) => {
        if (!isMountedRef.current || !lastKnown) return;
        setLocation([lastKnown.coords.longitude, lastKnown.coords.latitude]);
      })
      .catch((err) => {
        console.warn("useUserLocation: getLastKnownPositionAsync failed", err);
      });

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 2000,
      },
      (loc) => {
        if (!isMountedRef.current) return;
        setLocation([loc.coords.longitude, loc.coords.latitude]);
      },
      (errorReason: string) => {
        console.warn("useUserLocation: watchPositionAsync error", errorReason);
      }
    )
      .then((subscription) => {
        if (!isMountedRef.current) {
          subscription.remove();
          return;
        }
        watcherSubscriptionRef.current = subscription;
      })
      .catch((err) => {
        console.warn("useUserLocation: watchPositionAsync failed to start", err);
      });
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (!isMountedRef.current) return res.granted;
      if (res.granted) {
        setPermission("granted");
        startTracking();
        return true;
      } else {
        setPermission("denied");
        return false;
      }
    } catch (err) {
      console.warn("useUserLocation: requestForegroundPermissionsAsync failed", err);
      if (isMountedRef.current) {
        setPermission("denied");
      }
      return false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    Location.getForegroundPermissionsAsync()
      .then(async (statusRes) => {
        if (!isMountedRef.current) return;
        if (statusRes.granted) {
          setPermission("granted");
          startTracking();
        } else if (statusRes.canAskAgain) {
          const reqRes = await Location.requestForegroundPermissionsAsync();
          if (!isMountedRef.current) return;
          if (reqRes.granted) {
            setPermission("granted");
            startTracking();
          } else {
            setPermission("denied");
          }
        } else {
          setPermission("denied");
        }
      })
      .catch((err) => {
        console.warn("useUserLocation: check permission failed", err);
        if (isMountedRef.current) {
          setPermission("denied");
        }
      });

    return () => {
      isMountedRef.current = false;
      if (watcherSubscriptionRef.current) {
        watcherSubscriptionRef.current.remove();
        watcherSubscriptionRef.current = null;
      }
    };
  }, []);

  return {
    location,
    permission,
    requestPermission,
  };
}
