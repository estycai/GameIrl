import React, { useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Place, searchPlaces } from "../search/places";
import type { Theme } from "../theme/themes";

interface SearchBoxProps {
  onSelectPlace: (place: Place) => void;
  theme: Theme;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  onSelectPlace,
  theme,
}) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const results = searchPlaces(query);
  const showResults = isFocused || query.length > 0;

  const handleClear = () => {
    setQuery("");
    setIsFocused(false);
    Keyboard.dismiss();
  };

  // Dismiss the keyboard before leaving browse: the next phase renders a
  // banner at the bottom of the screen, which an open keyboard covers entirely.
  const handleSelect = (place: Place) => {
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
      {showResults && (
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
            nestedScrollEnabled
            style={styles.resultsScroll}
          >
            {results.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.resultItem,
                  { borderBottomColor: theme.surfaceBorder },
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelect(place)}
              >
                <MaterialIcons
                  name="place"
                  size={18}
                  color={theme.accent}
                  style={styles.placeIcon}
                />
                <View style={styles.resultTextContainer}>
                  <Text
                    style={[styles.resultName, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {place.name}
                  </Text>
                  <Text
                    style={[
                      styles.resultDetail,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {place.detail}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
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
  clearButton: {
    padding: 6,
  },
  resultsContainer: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    maxHeight: 220,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  resultsScroll: {
    maxHeight: 220,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeIcon: {
    marginRight: 10,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  resultDetail: {
    fontSize: 12,
  },
});
