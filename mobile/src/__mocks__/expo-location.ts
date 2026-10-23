export enum LocationAccuracy {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6,
}

export const Accuracy = LocationAccuracy;

export const getForegroundPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
export const requestForegroundPermissionsAsync = jest.fn(async () => ({ status: 'granted', canAskAgain: true }));
export const hasServicesEnabledAsync = jest.fn(async () => true);
export const isLocationServicesEnabledAsync = jest.fn(async () => true);
export const getCurrentPositionAsync = jest.fn(async () => ({
  coords: {
    latitude: 19.0760,
    longitude: 72.8777,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
}));
export const getLastKnownPositionAsync = jest.fn(async () => null);
export const reverseGeocodeAsync = jest.fn(async () => [
  {
    city: 'Mumbai',
    district: 'Mumbai Suburban',
    streetNumber: '10',
    street: 'Bandra West',
    region: 'Maharashtra',
    subregion: 'Bandra',
    country: 'India',
    postalCode: '400050',
    name: 'Bandra Promenade',
    isoCountryCode: 'IN',
    timezone: 'Asia/Kolkata',
    formattedAddress: 'Bandra Promenade, Bandra West, Mumbai, Maharashtra - 400050, India',
  },
]);

export default {
  Accuracy,
  LocationAccuracy,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  isLocationServicesEnabledAsync,
  getCurrentPositionAsync,
  getLastKnownPositionAsync,
  reverseGeocodeAsync,
};
