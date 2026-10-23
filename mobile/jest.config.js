module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^expo-secure-store$': '<rootDir>/src/__mocks__/expo-secure-store.ts',
    '^expo-linking$': '<rootDir>/src/__mocks__/expo-linking.ts',
    '^expo-location$': '<rootDir>/src/__mocks__/expo-location.ts',
    '^expo-contacts$': '<rootDir>/src/__mocks__/expo-contacts.ts',
    '^expo-sqlite$': '<rootDir>/src/__mocks__/expo-sqlite.ts',
    '^expo-constants$': '<rootDir>/src/__mocks__/expo-constants.ts',
  },
};
