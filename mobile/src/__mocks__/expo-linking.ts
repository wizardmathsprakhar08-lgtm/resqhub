export const openURL = async (_url: string): Promise<void> => undefined;
export const canOpenURL = async (_url: string): Promise<boolean> => true;
export const openSettings = async (): Promise<void> => undefined;

export default {
  openURL,
  canOpenURL,
  openSettings,
};
