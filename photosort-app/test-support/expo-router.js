// Mock for expo-router — screens' hooks import `router` and focus effects.
const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
};
module.exports = {
  router,
  useRouter: jest.fn(() => router),
  useFocusEffect: jest.fn((cb) => { cb(); }),
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
  Link: () => null,
};
