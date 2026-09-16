// Install our hand-written module mocks.
//
// Two things make this necessary rather than using `moduleNameMapper`:
//
//  1. jest-expo's preset auto-mocks native Expo modules, and that automock
//     wins over `moduleNameMapper`. Its automock replaces functions with
//     jest.fn() but leaves non-function exports undefined — notably
//     `FileSystem.documentDirectory`. Every storage module builds its path as
//     `documentDirectory + 'name.json'`, so under the automock they all
//     resolved to the literal string "undefinedname.json". Tests that never
//     asserted a path still passed, which is how this went unnoticed.
//
//  2. The implementations live in `test-support/` rather than `__mocks__/`.
//     A `__mocks__` directory adjacent to node_modules is itself the
//     registered manual mock for a package, so a factory that requires from
//     it resolves straight back into the factory — infinite recursion.
//
// An explicit factory applied here runs before any test file is loaded.
jest.mock('expo-file-system', () => require('./test-support/expo-file-system'));
jest.mock('expo-file-system/legacy', () => require('./test-support/expo-file-system'));
jest.mock('expo-image-manipulator', () => require('./test-support/expo-image-manipulator'));
jest.mock('expo-media-library', () => require('./test-support/expo-media-library'));
jest.mock('expo-location', () => require('./test-support/expo-location'));
jest.mock('expo-router', () => require('./test-support/expo-router'));
jest.mock('expo-image-picker', () => require('./test-support/expo-image-picker'));
jest.mock('expo-secure-store', () => require('./test-support/expo-secure-store'));
