/**
 * ResQHub Timing and Operation Constants
 * Single source of truth for SOS triggers, countdowns, timeouts, and cooldowns.
 */

// SOS Button Press-and-Hold activation duration (500ms / 0.5 seconds)
export const SOS_HOLD_DURATION_MS = 500;

// Cancelable countdown after SOS activation (3 seconds)
export const SOS_COUNTDOWN_SECONDS = 3;

// GPS / Location acquisition timeout
export const LOCATION_TIMEOUT_MS = 8000;

// Backend API request timeout (15 seconds to allow for SMS gateway roundtrip)
export const BACKEND_REQUEST_TIMEOUT_MS = 15000;

// Status polling interval for active alert delivery updates
export const ALERT_POLL_INTERVAL_MS = 3000;

// Shake detection debounce / cooldown
export const SHAKE_COOLDOWN_MS = 5000;
