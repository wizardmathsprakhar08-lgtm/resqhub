export function normalizePhoneNumber(rawNumber: string): string {
  if (!rawNumber) return '';
  // Remove non-digit characters except leading plus
  let cleaned = rawNumber.trim().replace(/[^\d+]/g, '');
  return cleaned;
}

export function validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
  const normalized = normalizePhoneNumber(phone);
  const digitsOnly = normalized.replace(/\D/g, '');

  if (!digitsOnly) {
    return { isValid: false, error: 'Phone number is required.' };
  }
  if (digitsOnly.length < 10) {
    return { isValid: false, error: 'Phone number must be at least 10 digits.' };
  }
  if (digitsOnly.length > 15) {
    return { isValid: false, error: 'Phone number cannot exceed 15 digits.' };
  }
  return { isValid: true };
}
