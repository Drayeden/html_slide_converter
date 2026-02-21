const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '' : '/api');
// Note: If deploying frontend and backend to different domains, 
// set VITE_API_BASE in your environment to the full backend URL.


/**
 * Convert slides to PPTX + PDF.
 * @param {object} params - { slides?, urls?, slideSize? }
 */
export async function convertSlides({ slides, urls, slideSize }) {
    const res = await fetch(`${API_BASE}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides, urls, slideSize }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error: ${res.status}`);
    }

    return res.json();
}

/**
 * Fetch slide HTMLs from Genspark URLs (for preview).
 * @param {string[]} urls
 */
export async function fetchSlidesFromUrls(urls) {
    const res = await fetch(`${API_BASE}/fetch-slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error: ${res.status}`);
    }

    return res.json();
}

/**
 * Validate slides against quality criteria.
 */
export async function validateSlides(slides) {
    const res = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error: ${res.status}`);
    }

    return res.json();
}

/**
 * Mark file as verified.
 */
export async function verifyFile(filename) {
    const res = await fetch(`${API_BASE}/verify/${filename}`, {
        method: 'POST',
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error: ${res.status}`);
    }

    return res.json();
}

/**
 * Check server health.
 */
export async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Get download URL.
 */
export function getDownloadUrl(filename) {
    return `${API_BASE}/download/${filename}`;
}
