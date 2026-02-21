/**
 * Genspark Slide Converter - Main Application
 * Supports two input modes:
 *  1. Code mode: paste slide HTML directly
 *  2. URL mode: paste Genspark conversation HTML or slide URLs
 */
import { EditorView, basicSetup } from 'codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { parseSlides, getSlideContent } from './services/slideParser.js';
import { convertSlides, fetchSlidesFromUrls, validateSlides, verifyFile, checkHealth, getDownloadUrl } from './services/api.js';
import { showSuccess, showError, showWarning, showInfo } from './components/Toast.js';
import './styles/index.css';

// ====== Application State ======
const state = {
    slides: [],
    currentSlide: 0,
    code: '',
    editor: null,
    validationResults: null,
    lastFilename: null,
    isDark: true,
    inputMode: 'code', // 'code' or 'url'
    urls: [],          // Extracted Genspark URLs
    slideSize: { w: 1280, h: 720 },
};

// ====== DOM Elements ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
    editorContainer: $('#code-editor-container'),
    iframe: $('#slide-iframe'),
    emptyState: $('#empty-state'),
    previewContainer: $('#preview-container'),
    thumbnailBar: $('#thumbnail-bar'),
    thumbnailList: $('#thumbnail-list'),
    validationPanel: $('#validation-panel'),
    validationResults: $('#validation-results'),
    slideIndicator: $('#slide-indicator'),
    slideCountBadge: $('#slide-count-badge'),
    actionBar: $('#action-bar'),
    progressBar: $('#progress-bar'),
    progressFill: $('#progress-fill'),
    progressText: $('#progress-text'),
    btnRender: $('#btn-render'),
    btnPrev: $('#btn-prev'),
    btnNext: $('#btn-next'),
    btnPaste: $('#btn-paste'),
    btnClear: $('#btn-clear'),
    btnValidate: $('#btn-validate'),
    btnValidateAll: $('#btn-validate-all'),
    btnExport: $('#btn-export'),
    btnVerify: $('#btn-verify'),
    themeToggle: $('#theme-toggle'),
    // New UI elements
    codeInputArea: $('#code-input-area'),
    urlInputArea: $('#url-input-area'),
    urlTextarea: $('#url-textarea'),
    urlExtractInfo: $('#url-extract-info'),
    urlExtractCount: $('#url-extract-count'),
};

// ====== Initialize ======
async function init() {
    initEditor();
    bindEvents();
    await checkServerHealth();
}

function initEditor() {
    state.editor = new EditorView({
        extensions: [
            basicSetup,
            html(),
            oneDark,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    state.code = update.state.doc.toString();
                }
            }),
        ],
        parent: els.editorContainer,
    });
}

async function checkServerHealth() {
    const healthy = await checkHealth();
    if (healthy) {
        showSuccess('서버 연결 완료 ✓');
    } else {
        showWarning('서버에 연결할 수 없습니다. 백엔드를 실행하세요.');
    }
}

// ====== Event Bindings ======
function bindEvents() {
    els.btnRender.addEventListener('click', renderSlides);
    els.btnPrev.addEventListener('click', () => navigateSlide(-1));
    els.btnNext.addEventListener('click', () => navigateSlide(1));
    els.btnPaste.addEventListener('click', pasteFromClipboard);
    els.btnClear.addEventListener('click', clearEditor);
    els.btnValidate.addEventListener('click', validateCurrentSlide);
    els.btnValidateAll.addEventListener('click', validateAllSlides);
    els.btnExport.addEventListener('click', exportSlides);
    els.btnVerify.addEventListener('click', verifyCurrentFile);
    els.themeToggle.addEventListener('click', toggleTheme);

    // Input mode tab switching
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchInputMode(btn.dataset.mode));
    });

    // URL textarea live extraction
    if (els.urlTextarea) {
        els.urlTextarea.addEventListener('input', onUrlTextareaInput);
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.target.closest('.cm-editor') || e.target.closest('textarea')) return;
        if (e.key === 'ArrowLeft') navigateSlide(-1);
        if (e.key === 'ArrowRight') navigateSlide(1);
    });
}

// ====== Input Mode Switching ======
function switchInputMode(mode) {
    state.inputMode = mode;

    // Update tab buttons
    $$('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show/hide input areas
    if (mode === 'code') {
        els.codeInputArea.classList.remove('hidden');
        els.urlInputArea.classList.add('hidden');
    } else {
        els.codeInputArea.classList.add('hidden');
        els.urlInputArea.classList.remove('hidden');
    }
}

function onUrlTextareaInput() {
    const text = els.urlTextarea.value;
    if (!text.trim()) {
        els.urlExtractInfo.classList.add('hidden');
        state.urls = [];
        return;
    }

    // Try to extract iframe URLs from pasted HTML
    const iframeRegex = /https?:\/\/page\.gensparksite\.com\/slide_agent\/[^\s"'<>]+\.html/gi;
    const matches = text.match(iframeRegex) || [];
    const uniqueUrls = [...new Set(matches)];

    if (uniqueUrls.length > 0) {
        state.urls = uniqueUrls;
        els.urlExtractInfo.classList.remove('hidden');
        els.urlExtractCount.textContent = `${uniqueUrls.length}개 슬라이드 URL 감지됨`;
    } else {
        // Check if lines are direct URLs
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
        if (lines.length > 0) {
            state.urls = lines;
            els.urlExtractInfo.classList.remove('hidden');
            els.urlExtractCount.textContent = `${lines.length}개 URL 입력됨`;
        } else {
            state.urls = [];
            els.urlExtractInfo.classList.add('hidden');
        }
    }
}

// ====== Core Functions ======
async function renderSlides() {
    if (state.inputMode === 'url') {
        await renderFromUrls();
    } else {
        renderFromCode();
    }
}

function renderFromCode() {
    const code = state.code;
    if (!code.trim()) {
        showWarning('코드를 입력해주세요.');
        return;
    }

    try {
        const result = parseSlides(code);

        if (result.mode === 'url') {
            // Code input detected iframe URLs — switch to URL mode
            state.urls = result.urls;
            switchInputMode('url');
            els.urlTextarea.value = result.urls.join('\n');
            onUrlTextareaInput();
            showInfo(`${result.urls.length}개 iframe URL 감지됨. URL 모드로 전환합니다.`);
            renderFromUrls();
            return;
        }

        if (result.slides.length === 0) {
            showError('슬라이드를 찾을 수 없습니다.');
            return;
        }

        state.slides = result.slides;
        state.slideSize = result.slideSize;
        state.currentSlide = 0;
        state.validationResults = null;

        showSlide(0);
        renderThumbnails();
        updateUI();
        showSuccess(`${result.slides.length}개 슬라이드 로드 완료 (${state.slideSize.w}×${state.slideSize.h})`);
    } catch (error) {
        showError(`파싱 오류: ${error.message}`);
    }
}

async function renderFromUrls() {
    if (state.urls.length === 0) {
        showWarning('URL을 입력하거나 젠스파크 대화 페이지 HTML을 붙여넣어주세요.');
        return;
    }

    showLoading(`${state.urls.length}개 슬라이드 다운로드 중...`);

    try {
        const result = await fetchSlidesFromUrls(state.urls);

        state.slides = result.slides;
        state.slideSize = result.slideSize || { w: 1280, h: 720 };
        state.currentSlide = 0;
        state.validationResults = null;

        showSlide(0);
        renderThumbnails();
        updateUI();
        showSuccess(`${result.count}개 슬라이드 로드 완료 (${state.slideSize.w}×${state.slideSize.h})`);
    } catch (error) {
        showError(`다운로드 실패: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function showSlide(index) {
    if (index < 0 || index >= state.slides.length) return;

    state.currentSlide = index;
    const slideHtml = state.slides[index];
    const { w, h } = state.slideSize;

    // Show iframe, hide empty state
    els.emptyState.classList.add('hidden');
    els.iframe.classList.remove('hidden');

    // Render in iframe
    const iframeDoc = els.iframe.contentDocument || els.iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(slideHtml);
    iframeDoc.close();

    // Scale iframe content to fit container
    const containerWidth = els.previewContainer.clientWidth;
    const scale = containerWidth / w;
    els.iframe.style.width = `${w}px`;
    els.iframe.style.height = `${h}px`;
    els.iframe.style.transform = `scale(${scale})`;
    els.iframe.style.transformOrigin = 'top left';

    updateSlideIndicator();
    updateThumbnailActive();
    updateNavigationButtons();

    // Show validation for current slide if available
    if (state.validationResults) {
        showValidationForSlide(index);
    }
}

function navigateSlide(direction) {
    const next = state.currentSlide + direction;
    if (next >= 0 && next < state.slides.length) {
        showSlide(next);
    }
}

function renderThumbnails() {
    els.thumbnailBar.classList.remove('hidden');
    els.thumbnailList.innerHTML = '';
    const { w, h } = state.slideSize;

    state.slides.forEach((slideHtml, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail' + (i === 0 ? ' active' : '');
        thumb.dataset.index = i;

        // Create mini iframe for thumbnail
        const thumbIframe = document.createElement('iframe');
        thumbIframe.sandbox = 'allow-same-origin';
        thumbIframe.style.width = `${w}px`;
        thumbIframe.style.height = `${h}px`;
        // Scale to fit 120px width thumbnails
        const thumbScale = 120 / w;
        thumbIframe.style.transform = `scale(${thumbScale})`;
        thumbIframe.style.transformOrigin = 'top left';
        thumbIframe.style.pointerEvents = 'none';
        thumbIframe.style.border = 'none';
        thumbIframe.srcdoc = slideHtml;
        thumb.appendChild(thumbIframe);

        const num = document.createElement('span');
        num.className = 'thumbnail-number';
        num.textContent = i + 1;
        thumb.appendChild(num);

        thumb.addEventListener('click', () => showSlide(i));
        els.thumbnailList.appendChild(thumb);
    });
}

function updateThumbnailActive() {
    const thumbs = els.thumbnailList.querySelectorAll('.thumbnail');
    thumbs.forEach((t, i) => {
        t.classList.toggle('active', i === state.currentSlide);
    });

    // Scroll active thumbnail into view
    const active = els.thumbnailList.querySelector('.thumbnail.active');
    if (active) {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

function updateSlideIndicator() {
    els.slideIndicator.textContent = `${state.currentSlide + 1} / ${state.slides.length}`;
}

function updateNavigationButtons() {
    els.btnPrev.disabled = state.currentSlide === 0;
    els.btnNext.disabled = state.currentSlide === state.slides.length - 1;
}

function updateUI() {
    const hasSlides = state.slides.length > 0;

    // Show/hide elements
    els.actionBar.classList.toggle('hidden', !hasSlides);
    els.validationPanel.classList.toggle('hidden', !hasSlides);
    els.slideCountBadge.classList.toggle('hidden', !hasSlides);
    els.slideCountBadge.textContent = `${state.slides.length} slides`;

    // Update buttons
    els.btnPrev.disabled = true;
    els.btnNext.disabled = state.slides.length <= 1;
}

// ====== Validation ======
async function validateCurrentSlide() {
    if (state.slides.length === 0) return;
    await validateAllSlides();
}

async function validateAllSlides() {
    if (state.slides.length === 0) {
        showWarning('슬라이드를 먼저 렌더링해주세요.');
        return;
    }

    showLoading('검증 중...');

    try {
        // Extract raw slide body content for server validation
        const slideContents = state.slides.map(s => getSlideContent(s));
        const { results } = await validateSlides(slideContents);
        state.validationResults = results;

        showValidationForSlide(state.currentSlide);
        updateThumbnailValidation();
        showSuccess('검증 완료');
    } catch (error) {
        showError(`검증 실패: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function showValidationForSlide(index) {
    if (!state.validationResults || !state.validationResults[index]) return;

    const result = state.validationResults[index];
    els.validationResults.innerHTML = '';

    result.checks.forEach(check => {
        const item = document.createElement('div');
        item.className = 'validation-item';

        const statusIcon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';

        item.innerHTML = `
      <span class="v-status">${statusIcon}</span>
      <span class="v-name">${check.name}</span>
      <span class="v-detail">${check.detail}</span>
    `;

        els.validationResults.appendChild(item);
    });
}

function updateThumbnailValidation() {
    if (!state.validationResults) return;

    const thumbs = els.thumbnailList.querySelectorAll('.thumbnail');
    thumbs.forEach((t, i) => {
        t.classList.remove('valid', 'invalid', 'warning');
        if (state.validationResults[i]) {
            const overall = state.validationResults[i].overall;
            if (overall === 'pass') t.classList.add('valid');
            else if (overall === 'fail') t.classList.add('invalid');
            else t.classList.add('warning');
        }
    });
}

// ====== Export ======
async function exportSlides() {
    if (state.slides.length === 0) {
        showWarning('슬라이드를 먼저 렌더링해주세요.');
        return;
    }

    showProgress(0, '변환 준비 중...');

    try {
        showProgress(20, '슬라이드 변환 중...');

        // Determine export mode
        let exportPayload;
        if (state.inputMode === 'url' && state.urls.length > 0) {
            // URL mode: send URLs to server for fresh download + conversion
            exportPayload = { urls: state.urls, slideSize: state.slideSize };
        } else {
            // Code mode: send slide HTML
            exportPayload = { slides: state.slides, slideSize: state.slideSize };
        }

        const result = await convertSlides(exportPayload);

        showProgress(80, '파일 저장 중...');
        state.lastFilename = result.filename;

        showProgress(100, '완료!');

        // Show download links
        showSuccess(`변환 완료! ${result.slidesCount}장 (${result.slideSize?.w || state.slideSize.w}×${result.slideSize?.h || state.slideSize.h})`);
        showDownloadLinks(result);

        // Show verify button
        els.btnVerify.classList.remove('hidden');
    } catch (error) {
        showError(`변환 실패: ${error.message}`);
    } finally {
        setTimeout(() => hideProgress(), 2000);
    }
}

function showDownloadLinks(result) {
    showInfo(`PPTX: ${result.filename}.pptx`);

    // Auto-download PPTX
    const pptxLink = document.createElement('a');
    pptxLink.href = getDownloadUrl(`${result.filename}.pptx`);
    pptxLink.download = `${result.filename}.pptx`;
    document.body.appendChild(pptxLink);
    pptxLink.click();
    pptxLink.remove();

    // Auto-download PDF after short delay
    setTimeout(() => {
        const pdfLink = document.createElement('a');
        pdfLink.href = getDownloadUrl(`${result.filename}.pdf`);
        pdfLink.download = `${result.filename}.pdf`;
        document.body.appendChild(pdfLink);
        pdfLink.click();
        pdfLink.remove();
        showInfo(`PDF: ${result.filename}.pdf`);
    }, 1000);
}

async function verifyCurrentFile() {
    if (!state.lastFilename) {
        showWarning('먼저 PPTX를 생성해주세요.');
        return;
    }

    try {
        const result = await verifyFile(state.lastFilename);
        showSuccess(`검증 완료 파일 저장: ${result.verifiedFilename}`);

        // Auto-download verified files
        result.files.forEach(f => {
            const link = document.createElement('a');
            link.href = getDownloadUrl(`${result.verifiedFilename}.${f.ext}`);
            link.download = `${result.verifiedFilename}.${f.ext}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    } catch (error) {
        showError(`검증 저장 실패: ${error.message}`);
    }
}

// ====== UI Helpers ======
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return;

        if (state.inputMode === 'url') {
            els.urlTextarea.value = text;
            onUrlTextareaInput();
            showInfo('클립보드에서 붙여넣기 완료');
        } else {
            state.editor.dispatch({
                changes: { from: 0, to: state.editor.state.doc.length, insert: text },
            });
            showInfo('클립보드에서 붙여넣기 완료');
        }
    } catch {
        showWarning('클립보드 접근 권한이 필요합니다.');
    }
}

function clearEditor() {
    if (state.inputMode === 'url') {
        els.urlTextarea.value = '';
        state.urls = [];
        els.urlExtractInfo.classList.add('hidden');
    } else {
        state.editor.dispatch({
            changes: { from: 0, to: state.editor.state.doc.length, insert: '' },
        });
    }

    state.slides = [];
    state.currentSlide = 0;
    state.validationResults = null;
    state.lastFilename = null;

    els.emptyState.classList.remove('hidden');
    els.iframe.classList.add('hidden');
    els.thumbnailBar.classList.add('hidden');
    els.validationPanel.classList.add('hidden');
    els.actionBar.classList.add('hidden');
    els.slideCountBadge.classList.add('hidden');
    els.btnVerify.classList.add('hidden');
    els.slideIndicator.textContent = '-';
}

function toggleTheme() {
    state.isDark = !state.isDark;
    document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
    els.themeToggle.textContent = state.isDark ? '🌙' : '☀️';
}

function showLoading(text) {
    const existing = els.previewContainer.querySelector('.loading-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
    <div class="spinner"></div>
    <span class="loading-text">${text}</span>
  `;
    els.previewContainer.appendChild(overlay);
}

function hideLoading() {
    const overlay = els.previewContainer.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
}

function showProgress(percent, text) {
    els.progressBar.classList.remove('hidden');
    els.progressFill.style.width = `${percent}%`;
    els.progressText.textContent = text;
}

function hideProgress() {
    els.progressBar.classList.add('hidden');
    els.progressFill.style.width = '0%';
    els.progressText.textContent = '';
}

// ====== Start ======
document.addEventListener('DOMContentLoaded', init);
