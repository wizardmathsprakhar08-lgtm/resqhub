export const Platform = {
  OS: 'android',
  select: (obj: Record<string, any>) => obj.android ?? obj.default,
};

export const StyleSheet = {
  create: (styles: any) => styles,
  hairlineWidth: 1,
};

export const PermissionsAndroid = {
  PERMISSIONS: {
    SEND_SMS: 'android.permission.SEND_SMS',
    READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  },
  check: jest.fn(() => Promise.resolve(true)),
  request: jest.fn(() => Promise.resolve('granted')),
};

export const NativeModules: Record<string, any> = {
  DirectSms: {
    checkSmsCapability: jest.fn(() =>
      Promise.resolve({
        hasTelephony: true,
        simState: 'READY',
        permissionGranted: true,
        isReady: true,
        isDualSim: false,
        activeSimCount: 1,
        carrierNames: ['Test SIM'],
      })
    ),
    sendDirectSms: jest.fn(
      (phoneNumber: string, messageText: string, alertId: string, recipientId: string) =>
        Promise.resolve({
          submitted: true,
          status: 'submitting',
          partsCount: 1,
          alertId,
          recipientId,
          phoneNumber,
        })
    ),
  },
};

export class NativeEventEmitter {
  addListener = jest.fn(() => ({ remove: jest.fn() }));
  removeAllListeners = jest.fn();
  emit = jest.fn();
}

export default {
  Platform,
  StyleSheet,
  PermissionsAndroid,
  NativeModules,
  NativeEventEmitter,
};
