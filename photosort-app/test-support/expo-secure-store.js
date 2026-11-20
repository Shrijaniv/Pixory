// Mock for expo-secure-store — Instagram credential storage.
const store = new Map();
module.exports = {
  __store: store,
  getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
  setItemAsync: jest.fn(async (k, v) => { store.set(k, v); }),
  deleteItemAsync: jest.fn(async (k) => { store.delete(k); }),
};
