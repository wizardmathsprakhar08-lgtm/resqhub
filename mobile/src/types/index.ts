export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  created_at?: string;
}

export type SosState =
  | 'idle'
  | 'confirming'
  | 'locating'
  | 'sending'
  | 'sent'
  | 'mock'
  | 'partial_failure'
  | 'failed'
  | 'resolved';

export type LocationErrorType =
  | 'permission_denied'
  | 'gps_disabled'
  | 'timeout'
  | 'unavailable'
  | 'unknown';

export interface ReadableAddress {
  area?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  formattedAddress?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
  mapUrl: string;
  isCached?: boolean;
  readableAddress?: ReadableAddress;
}

export interface LocationResult {
  success: boolean;
  data?: LocationData;
  error?: string;
  errorType?: LocationErrorType;
  permissionDenied?: boolean;
}

export interface RecipientDispatchStatus {
  contactId: string;
  contactName: string;
  phoneNumber: string;
  status: 'mock' | 'queued' | 'sent' | 'delivered' | 'failed' | 'unknown';
  errorMessage?: string;
}

export interface ActiveAlertSession {
  alertId: string;
  idempotencyKey: string;
  state: SosState;
  message: string;
  location?: LocationData;
  recipients: RecipientDispatchStatus[];
  startedAt: number;
  resolvedAt?: number;
  error?: string;
}

export interface AlertHistoryItem {
  id: string;
  idempotencyKey: string;
  status: string;
  message: string;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  recipientsCount: number;
  createdAt: string;
  resolvedAt?: string;
  synced?: number | boolean;
}

export interface HelplineItem {
  id: string;
  title: string;
  number: string;
  category: 'medical' | 'police' | 'fire' | 'disaster' | 'utility' | 'general';
  description: string;
  icon: string;
}

export interface FirstAidGuide {
  id: string;
  title: string;
  category: string;
  description: string;
  steps: {
    letter: string;
    title: string;
    description: string;
  }[];
  criticalWarning?: string;
}

export interface AppSettings {
  customMessage: string;
  shakeEnabled: boolean;
  shakeSensitivity: 'low' | 'medium' | 'high'; // 70 (high), 90 (medium/default), 110 (low)
  backendUrl: string;
  deviceId: string;
  onboardingCompleted: boolean;
  primaryEmergencyNumber: string;
  smsDeliveryMethod?: 'sim' | 'backend';
}
