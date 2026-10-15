import AsyncStorage from "@react-native-async-storage/async-storage";
import { Place } from "./places";
import { parseHistory } from "./history";

const HISTORY_STORAGE_KEY = "gameirl.search.history.v1";

/**
 * Loads search history from persistent AsyncStorage. Returns empty array on failure.
 */
export async function loadHistory(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    return parseHistory(raw);
  } catch {
    return [];
  }
}

/**
 * Saves search history to persistent AsyncStorage. Swallows and warns on failure.
 */
export async function saveHistory(list: Place[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn("Failed to save search history:", error);
  }
}
