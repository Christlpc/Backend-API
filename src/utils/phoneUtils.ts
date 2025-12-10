export const normalizePhone = (phone: string): string => {
    // Remove all non-numeric characters except the leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If it starts with 00, replace with +
    if (cleaned.startsWith('00')) {
        cleaned = '+' + cleaned.substring(2);
    }

    // If it doesn't start with +, assume local format (e.g., 06...) and prepend default country code (Congo +242)
    // This is a simplification. In a real app, we might need country detection.
    if (!cleaned.startsWith('+')) {
        // Remove leading 0 if present
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        cleaned = '+242' + cleaned;
    }

    // Specific fix for Congo: +2420... should be +242...
    if (cleaned.startsWith('+2420')) {
        cleaned = '+242' + cleaned.substring(5);
    }

    return cleaned;
};

export const isValidPhone = (phone: string): boolean => {
    // Basic validation: Must start with + and have at least 8 digits
    return /^\+\d{8,15}$/.test(phone);
};
