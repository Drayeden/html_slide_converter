import puppeteer from 'puppeteer';

let browser = null;

export async function initBrowser() {
    if (browser) return browser;

    browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--font-render-hinting=none',
        ],
    });

    // Handle unexpected browser close
    browser.on('disconnected', () => {
        browser = null;
        console.warn('⚠️ Puppeteer browser disconnected, will reinitialize on next request');
    });

    return browser;
}

export async function getBrowser() {
    if (!browser) {
        await initBrowser();
    }
    return browser;
}

export async function getPage() {
    const b = await getBrowser();
    const page = await b.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    return page;
}

export async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
    }
}
