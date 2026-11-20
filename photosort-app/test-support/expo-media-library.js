// Mock for expo-media-library — used in pure-logic unit tests.
module.exports = {
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getAssetsAsync: jest.fn(async () => ({ assets: [], endCursor: null, hasNextPage: false })),
  MediaType: { photo: 'photo' },
  SortBy: { creationTime: 'creationTime' },
};
