// Mock for expo-image-manipulator — used in pure-logic unit tests.
module.exports = {
  manipulateAsync: jest.fn(async () => ({ uri: 'file://mock.jpg', base64: 'mockbase64' })),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
};
