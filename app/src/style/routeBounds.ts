export function routeBounds(route: GeoJSON.FeatureCollection): [number, number, number, number] {
  let minWest = Infinity;
  let minSouth = Infinity;
  let maxEast = -Infinity;
  let maxNorth = -Infinity;
  let count = 0;

  function processCoord(coord: GeoJSON.Position) {
    if (!coord || coord.length < 2) return;
    const [lng, lat] = coord;
    if (typeof lng !== "number" || typeof lat !== "number") return;
    if (lng < minWest) minWest = lng;
    if (lng > maxEast) maxEast = lng;
    if (lat < minSouth) minSouth = lat;
    if (lat > maxNorth) maxNorth = lat;
    count++;
  }

  for (const feature of route.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    switch (geometry.type) {
      case "Point":
        processCoord(geometry.coordinates);
        break;
      case "LineString":
        for (const coord of geometry.coordinates) {
          processCoord(coord);
        }
        break;
      case "MultiLineString":
        for (const line of geometry.coordinates) {
          for (const coord of line) {
            processCoord(coord);
          }
        }
        break;
      default:
        break;
    }
  }

  if (count === 0) {
    throw new Error("Route collection contains no valid coordinates to compute bounds");
  }

  return [minWest, minSouth, maxEast, maxNorth];
}
