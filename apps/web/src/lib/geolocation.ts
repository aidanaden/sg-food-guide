export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeolocationError {
  code: "PERMISSION_DENIED" | "POSITION_UNAVAILABLE" | "TIMEOUT" | "NOT_SUPPORTED";
  message: string;
}

type GeolocationResult =
  | { success: true; coordinates: Coordinates }
  | { success: false; error: GeolocationError };

/**
 * Check if the browser supports geolocation
 */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param distance Distance in kilometers
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    // Show meters for very close distances
    return `${Math.round(distance * 1000)}m`;
  }
  if (distance < 10) {
    // Show 1 decimal place for distances under 10km
    return `${distance.toFixed(1)}km`;
  }
  // Show whole numbers for distances over 10km
  return `${Math.round(distance)}km`;
}

/**
 * Get current GPS location using browser Geolocation API
 */
export function getCurrentLocation(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!isGeolocationSupported()) {
      resolve({
        success: false,
        error: {
          code: "NOT_SUPPORTED",
          message: "Geolocation is not supported by your browser",
        },
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        });
      },
      (error) => {
        let code: GeolocationError["code"];
        let message: string;

        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = "PERMISSION_DENIED";
            message = "Location permission was denied";
            break;
          case error.POSITION_UNAVAILABLE:
            code = "POSITION_UNAVAILABLE";
            message = "Location information is unavailable";
            break;
          case error.TIMEOUT:
            code = "TIMEOUT";
            message = "Location request timed out";
            break;
          default:
            code = "POSITION_UNAVAILABLE";
            message = "An unknown error occurred";
        }

        resolve({
          success: false,
          error: {
            code,
            message,
          },
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // Accept cached position up to 5 minutes old
      },
    );
  });
}
