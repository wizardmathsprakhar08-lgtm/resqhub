/**
 * Message formatting utilities for ResQHub SOS alerts.
 */

import { LocationData } from '../../types';

export function formatEmergencyLocationMessage(
  customMessage: string,
  location?: LocationData
): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  } catch {}

  const cleanMessage = customMessage.trim() || 'I need emergency assistance.';

  if (!location || !location.latitude || !location.longitude) {
    return [
      'RESQHUB SOS ALERT',
      '',
      cleanMessage,
      '',
      'Location: Unavailable (GPS fix could not be acquired)',
      `Time: ${dateStr} ${timeStr} (${timeZone})`,
      '',
      'Please contact me or arrange assistance.',
    ].join('\n');
  }

  const lat = location.latitude.toFixed(6);
  const lng = location.longitude.toFixed(6);
  const accuracyStr = location.accuracy != null
    ? `Accuracy: approximately ${Math.round(location.accuracy)} metres`
    : 'Accuracy: unavailable';

  let cachedNotice = '';
  if (location.isCached) {
    const ageMs = Math.max(0, Date.now() - (location.timestamp || Date.now()));
    const ageMinutes = Math.round(ageMs / 60000);
    const ageDesc = ageMinutes < 1 ? '<1 min ago' : `${ageMinutes}m ago`;
    const recordedTime = new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    cachedNotice = `\n(Note: Last known location recorded at ${recordedTime}) — ⚠️ [POTENTIALLY STALE CACHED GPS FIX: Recorded ${ageDesc}. Target may have moved.]`;
  }

  const addressLine = location.readableAddress?.formattedAddress
    ? `Address: ${location.readableAddress.formattedAddress}`
    : location.readableAddress?.area || location.readableAddress?.city
    ? `Area: ${[
        location.readableAddress.area,
        location.readableAddress.city,
        location.readableAddress.state,
        location.readableAddress.postalCode,
      ]
        .filter(Boolean)
        .join(', ')}`
    : null;

  const lines = [
    'RESQHUB SOS ALERT',
    '',
    cleanMessage,
    '',
    `Location: ${lat}, ${lng}`,
  ];

  if (addressLine) {
    lines.push(addressLine);
  }

  lines.push(
    `Map: https://maps.google.com/?q=${lat},${lng}`,
    `Time: ${dateStr} ${timeStr} (${timeZone})`,
    accuracyStr + cachedNotice,
    '',
    'Please contact me or arrange assistance.'
  );

  return lines.join('\n');
}
