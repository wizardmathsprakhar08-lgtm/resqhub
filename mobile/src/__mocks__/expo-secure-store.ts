export const getItemAsync = async (_key: string): Promise<string | null> => 'mock_device_uuid_12345';
export const setItemAsync = async (_key: string, _value: string): Promise<void> => undefined;

export default {
  getItemAsync,
  setItemAsync,
};
