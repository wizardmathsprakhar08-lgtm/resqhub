export const Contact = {
  presentPicker: jest.fn(),
  getAll: jest.fn(),
  getCount: jest.fn(),
  hasAny: jest.fn(),
  create: jest.fn(),
};

export const requestPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
}));

export const getPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
}));
