/**
 * Toast notification component.
 */

let container = null;

function getContainer() {
    if (!container) {
        container = document.getElementById('toast-container');
    }
    return container;
}

export function showToast(message, type = 'info', duration = 4000) {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    c.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export function showSuccess(msg) { showToast(msg, 'success'); }
export function showError(msg) { showToast(msg, 'error', 6000); }
export function showWarning(msg) { showToast(msg, 'warning'); }
export function showInfo(msg) { showToast(msg, 'info'); }
