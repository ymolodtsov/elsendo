// Share token validation: alphanumeric + dash/underscore, 21-32 chars (support both old and new tokens)
export const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{21,32}$/;

export const isValidShareToken = (token: string): boolean => {
  return SHARE_TOKEN_REGEX.test(token);
};

// Strip HTML tags and normalize whitespace
export const stripHtml = (html: string, maxLength = 200): string => {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

// Escape HTML special characters for safe embedding
export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
