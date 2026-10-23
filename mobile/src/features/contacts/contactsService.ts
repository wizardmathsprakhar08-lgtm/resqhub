import {
  Contact,
  requestPermissionsAsync,
  getPermissionsAsync,
} from 'expo-contacts';
import {
  getAllContacts,
  getContactsCount,
  insertContact,
  deleteContact,
  updateContact,
  MAX_CONTACTS,
} from '../../database/db';
import { EmergencyContact } from '../../types';

import { normalizePhoneNumber, validatePhoneNumber } from './phoneUtils';

export { normalizePhoneNumber, validatePhoneNumber };

export async function requestContactsPermission(): Promise<boolean> {
  try {
    const existing = await getPermissionsAsync();
    if (existing.granted) return true;
    const { status } = await requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error requesting contacts permission:', err);
    return false;
  }
}

export async function pickContactFromDevice(): Promise<{
  success: boolean;
  name?: string;
  phone?: string;
  error?: string;
  permissionDenied?: boolean;
}> {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) {
    return {
      success: false,
      permissionDenied: true,
      error: 'Contacts permission is required to select from phonebook.',
    };
  }

  try {
    const contact = await Contact.presentPicker();
    if (!contact) {
      return { success: false, error: 'Contact selection cancelled.' };
    }

    let name = 'Emergency Contact';
    if (typeof contact.getFullName === 'function') {
      const full = await contact.getFullName().catch(() => '');
      if (full && full.trim()) {
        name = full.trim();
      }
    }
    if (name === 'Emergency Contact') {
      const given = typeof contact.getGivenName === 'function' ? await contact.getGivenName().catch(() => '') : '';
      const family = typeof contact.getFamilyName === 'function' ? await contact.getFamilyName().catch(() => '') : '';
      const composed = [given, family].filter(Boolean).join(' ').trim();
      if (composed) {
        name = composed;
      }
    }

    let phones: Array<{ number?: string }> = [];
    if (typeof contact.getPhones === 'function') {
      phones = (await contact.getPhones().catch(() => [])) || [];
    }

    if (!phones || phones.length === 0 || !phones[0]?.number) {
      return {
        success: false,
        error: 'The selected contact has no phone number registered.',
      };
    }

    const rawNumber = phones[0].number;
    const normalizedPhone = normalizePhoneNumber(rawNumber);
    return {
      success: true,
      name,
      phone: normalizedPhone,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to select contact from phonebook.',
    };
  }
}

export {
  getAllContacts,
  getContactsCount,
  insertContact,
  deleteContact,
  updateContact,
  MAX_CONTACTS,
};
