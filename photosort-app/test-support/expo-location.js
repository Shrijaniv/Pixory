// Mock for expo-location — used in pure-logic unit tests.
module.exports = {
  geocodeAsync: jest.fn(async () => []),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
};
