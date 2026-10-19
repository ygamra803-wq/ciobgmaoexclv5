import DOMPurify from 'dompurify';

export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  // Basic XSS prevention by escaping HTML chars
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Sanitizes HTML markup using DOMPurify with a strict whitelist suitable for printable GMAO vouchers.
 * Strips all scripts, event handlers (onerror, onload, onclick), iframes, objects, and javascript: URIs.
 */
export const sanitizeHtml = (dirtyHtml) => {
  if (typeof dirtyHtml !== 'string' || !dirtyHtml) return '';

  if (typeof DOMPurify?.sanitize === 'function') {
    return DOMPurify.sanitize(dirtyHtml, {
      USE_PROFILES: { html: true, svg: true, svgFilters: false },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'formaction', 'xlink:href', 'srcdoc'],
      ALLOW_DATA_ATTR: false,
    });
  }

  // Fallback strict regex sanitizer if DOM window context is unavailable
  return dirtyHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
};

/**
 * Sanitizes dynamic strings intended for filenames or document titles.
 */
export const sanitizeFilename = (value, fallback = 'Document') => {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value)
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
};

export const sanitizeObject = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  } else if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[sanitizeString(key)] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return typeof obj === 'string' ? sanitizeString(obj) : obj;
};

