import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  normalizePhoneNumber,
  validatePhoneNumber,
  requestContactsPermission,
  pickContactFromDevice,
} from '../features/contacts/contactsService';
import { Contact, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';

describe('Contacts Service - Validation & Normalization', () => {
  describe('normalizePhoneNumber', () => {
    it('should strip spaces, dashes, and parentheses', () => {
      expect(normalizePhoneNumber('  (987) 654-3210  ')).toBe('9876543210');
      expect(normalizePhoneNumber('+91 98765-43210')).toBe('+919876543210');
    });

    it('should preserve leading plus for international E.164 numbers', () => {
      expect(normalizePhoneNumber('+1-500-555-0006')).toBe('+15005550006');
    });

    it('should return empty string for empty input', () => {
      expect(normalizePhoneNumber('')).toBe('');
    });
  });

  describe('validatePhoneNumber', () => {
    it('should accept valid 10-digit Indian phone numbers', () => {
      const result = validatePhoneNumber('9876543210');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid international phone numbers', () => {
      const result = validatePhoneNumber('+919876543210');
      expect(result.isValid).toBe(true);
    });

    it('should reject numbers with fewer than 10 digits', () => {
      const result = validatePhoneNumber('12345');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 10 digits');
    });

    it('should reject numbers with more than 15 digits', () => {
      const result = validatePhoneNumber('1234567890123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot exceed 15 digits');
    });

    it('should reject empty phone number', () => {
      const result = validatePhoneNumber('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('pickContactFromDevice (Class-based expo-contacts API)', () => {
    beforeEach(() => {
      (getPermissionsAsync as any).mockReset();
      (requestPermissionsAsync as any).mockReset();
      (Contact.presentPicker as any).mockReset();
    });

    it('should return permissionDenied if permission is not granted', async () => {
      (getPermissionsAsync as any).mockResolvedValue({ status: 'denied', granted: false });
      (requestPermissionsAsync as any).mockResolvedValue({ status: 'denied', granted: false });

      const res = await pickContactFromDevice();
      expect(res.success).toBe(false);
      expect(res.permissionDenied).toBe(true);
      expect(res.error).toContain('Contacts permission is required');
    });

    it('should return cancelled when user cancels picker dialog', async () => {
      (getPermissionsAsync as any).mockResolvedValue({ status: 'granted', granted: true });
      (Contact.presentPicker as any).mockResolvedValue(null);

      const res = await pickContactFromDevice();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Contact selection cancelled.');
    });

    it('should return error if selected contact has no phone numbers', async () => {
      (getPermissionsAsync as any).mockResolvedValue({ status: 'granted', granted: true });
      const mockContact = {
        getFullName: async () => 'John Doe',
        getPhones: async () => [],
      };
      (Contact.presentPicker as any).mockResolvedValue(mockContact);

      const res = await pickContactFromDevice();
      expect(res.success).toBe(false);
      expect(res.error).toContain('has no phone number registered');
    });

    it('should successfully extract name and normalized phone number', async () => {
      (getPermissionsAsync as any).mockResolvedValue({ status: 'granted', granted: true });
      const mockContact = {
        getFullName: async () => 'Jane Smith',
        getPhones: async () => [{ number: '+91 (987) 654-3210' }],
      };
      (Contact.presentPicker as any).mockResolvedValue(mockContact);

      const res = await pickContactFromDevice();
      expect(res.success).toBe(true);
      expect(res.name).toBe('Jane Smith');
      expect(res.phone).toBe('+919876543210');
    });

    it('should fallback to given and family name if getFullName returns empty', async () => {
      (getPermissionsAsync as any).mockResolvedValue({ status: 'granted', granted: true });
      const mockContact = {
        getFullName: async () => '',
        getGivenName: async () => 'Rohit',
        getFamilyName: async () => 'Sharma',
        getPhones: async () => [{ number: '9876543210' }],
      };
      (Contact.presentPicker as any).mockResolvedValue(mockContact);

      const res = await pickContactFromDevice();
      expect(res.success).toBe(true);
      expect(res.name).toBe('Rohit Sharma');
      expect(res.phone).toBe('9876543210');
    });

    it('should gracefully handle unexpected errors during picker execution', async () => {
      (getPermissionsAsync as any).mockResolvedValue({ status: 'granted', granted: true });
      (Contact.presentPicker as any).mockRejectedValue(new Error('Device picker crashed'));

      const res = await pickContactFromDevice();
      expect(res.success).toBe(false);
      expect(res.error).toContain('Device picker crashed');
    });
  });
});

