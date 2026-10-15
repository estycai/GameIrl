import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Place } from "../search/places";
import { useSearchSuggestions } from "../search/useSearchSuggestions";
import { highlightSegments } from "../search/suggestions";
import type { Theme } from "../theme/themes";

interface SearchBoxProps {
  onSelectPlace: (place: Place) => void;
  theme: Theme;
  biasPoint: [number, number];
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  onSelectPlace,
  theme,
  biasPoint,
}) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const { suggestions, status, recordSelection } = useSearchSuggestions(
    query,
    biasPoint
  );

  const trimmedQuery = query.trim();
  const showErrorRow = status === "error";
  const showNoResultsRow =
    status === "ready" && trimmedQuery.length >= 3 && suggestions.length === 0;
  const hasDropdownContent =
    suggestions.length > 0 || showErrorRow || showNoResultsRow;
  const showDropdown = isFocused && hasDropdownContent;

  const handleClear = () => {
    setQuery("");
    setIsFocused(false);
    Keyboard.dismiss();
  };

  // Dismiss the keyboard before leaving browse: the next phase renders a
  // banner at the bottom of the screen, which an open keyboard covers entirely.
  const handleSelect = (place: Place) => {
    recordSelection(place);
    setQuery("");
    setIsFocused(false);
    Keyboard.dismiss();
    onSelectPlace(place);
  };

  return (
    <View style={styles.wrapper}>
      {/* Search Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.surfaceBorder,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <MaterialIcons
          name="search"
          size={20}
          color={theme.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.input, { color: theme.textPrimary }]}
          placeholder="Search a place"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          autoCorrect={false}
          returnKeyType="search"
        />
        {status === "loading" && (
          <ActivityIndicator
            size="small"
            color={theme.textSecondary}
            style={styles.loadingIndicator}
          />
        )}
        {query.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={handleClear}
            style={styles.clearButton}
          >
            <MaterialIcons name="close" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Dropdown */}
      {showDropdown && (
        <View
          style={[
            styles.resultsContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.surfaceBorder,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
          >
            {suggestions.map((item, index) => {
              const { place, source } = item;
              const isLast =
                index === suggestions.length - 1 &&
                !showErrorRow &&
                !showNoResultsRow;
              const iconName = source === "history" ? "history" : "place";
              const iconColor =
                source === "history" ? theme.textSecondary : theme.accent;
              const segments = highlightSegments(place.name, query);

              return (
                <TouchableOpacity
                  key={place.id}
                  style={[
                    styles.row,
                    !isLast && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.surfaceBorder,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${
                    source === "history" ? "Recent: " : ""
                  }${place.name}, ${place.detail}`}
                  onPress={() => handleSelect(place)}
                >
                  <MaterialIcons
                    name={iconName}
                    size={20}
                    color={iconColor}
                    style={styles.rowIcon}
                  />
                  <Text
                    style={styles.rowText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {segments.map((seg, sIdx) => (
                      <Text
                        key={sIdx}
                        style={[
                          styles.placeName,
                          {
                            color: theme.textPrimary,
                            fontWeight: seg.match ? "700" : "400",
                          },
                        ]}
                      >
                        {seg.text}
                      </Text>
                    ))}
                    {place.detail ? (
                      <Text
                        style={[
                          styles.placeDetail,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {"  " + place.detail}
                      </Text>
                    ) : null}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Status: Error row */}
            {showErrorRow && (
              <View
                style={[
                  styles.row,
                  suggestions.length > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.surfaceBorder,
                  },
                ]}
              >
                <MaterialIcons
                  name="cloud-off"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.rowIcon}
                />
                <Text
                  style={[styles.statusText, { color: theme.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  No connection
                </Text>
              </View>
            )}

            {/* Status: No results row */}
            {showNoResultsRow && (
              <View style={styles.row}>
                <MaterialIcons
                  name="search"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.rowIcon}
                />
                <Text
                  style={[styles.statusText, { color: theme.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  No results
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    zIndex: 100,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  loadingIndicator: {
    marginRight: 6,
  },
  clearButton: {
    padding: 6,
  },
  resultsContainer: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowIcon: {
    marginRight: 10,
  },
  rowText: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
  },
  placeDetail: {
    fontSize: 13,
    fontWeight: "400",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "400",
  },
});
