// Mock for expo-file-system — used in pure-logic unit tests.
module.exports = {
  documentDirectory: 'file:///mock-doc-dir/',
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
};
