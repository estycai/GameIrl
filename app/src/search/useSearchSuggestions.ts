import { useCallback, useEffect, useRef, useState } from "react";
import { type Place } from "./places";
import { fetchPhotonPlaces, type LngLat } from "./photon";
import { addToHistory, matchHistory } from "./history";
import { loadHistory, saveHistory } from "./historyStorage";
import { mergeSuggestions, type Suggestion } from "./suggestions";

export type SearchStatus = "idle" | "loading" | "ready" | "error";

export function useSearchSuggestions(
  query: string,
  bias: LngLat
): {
  suggestions: Suggestion[];
  status: SearchStatus;
  recordSelection: (place: Place) => void;
} {
  const [history, setHistory] = useState<Place[]>([]);
  const [lastResults, setLastResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");

  const isMountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store bias in a ref updated every render, and read it at fetch time
  const biasRef = useRef(bias);
  biasRef.current = bias;

  // Load history on mount
  useEffect(() => {
    isMountedRef.current = true;

    loadHistory().then((loaded) => {
      if (isMountedRef.current) {
        setHistory(loaded);
      }
    });

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const trimmed = query.trim();

  useEffect(() => {
    // Clear debounce timer and abort any in-flight request
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }

    if (trimmed.length < 3) {
      setLastResults([]);
      setStatus("idle");
      return;
    }

    // trimmed.length >= 3:
    // Keep lastResults visible, set loading when debounced request fires
    const targetQuery = trimmed;
    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      controllerRef.current = controller;

      setStatus("loading");

      const currentBias = biasRef.current;
      const biasObj = { lat: currentBias[1], lon: currentBias[0] };

      fetchPhotonPlaces(targetQuery, biasObj, controller.signal)
        .then((places) => {
          if (!isMountedRef.current) return;
          if (controller.signal.aborted) return;
          setLastResults(places);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (!isMountedRef.current) return;
          if (
            controller.signal.aborted ||
            (error instanceof Error && error.name === "AbortError")
          ) {
            return;
          }
          setStatus("error");
        });
    }, 250);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [trimmed]);

  const recordSelection = useCallback((place: Place) => {
    setHistory((prev) => {
      const next = addToHistory(prev, place);
      void saveHistory(next);
      return next;
    });
  }, []);

  let suggestions: Suggestion[] = [];
  if (trimmed.length === 0) {
    suggestions = mergeSuggestions(history, []);
  } else if (trimmed.length < 3) {
    suggestions = mergeSuggestions(matchHistory(history, trimmed), []);
  } else {
    suggestions = mergeSuggestions(matchHistory(history, trimmed), lastResults);
  }

  return {
    suggestions,
    status,
    recordSelection,
  };
}
