const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to ensure Android Manifest contains SEND_SMS,
 * READ_PHONE_STATE, and telephony hardware declarations for ResQHub.
 */
function withDirectSms(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const requiredPermissions = [
      'android.permission.SEND_SMS',
      'android.permission.READ_PHONE_STATE',
    ];

    requiredPermissions.forEach((permName) => {
      const exists = androidManifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === permName
      );
      if (!exists) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permName },
        });
      }
    });

    if (!androidManifest['uses-feature']) {
      androidManifest['uses-feature'] = [];
    }

    const hasTelephony = androidManifest['uses-feature'].some(
      (f) => f.$ && f.$['android:name'] === 'android.hardware.telephony'
    );

    if (!hasTelephony) {
      androidManifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.telephony',
          'android:required': 'false',
        },
      });
    }

    return config;
  });
}

module.exports = withDirectSms;
