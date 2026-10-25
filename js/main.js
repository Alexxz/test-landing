document.addEventListener('DOMContentLoaded', () => {
    const variant = 'B1_explicit_phone_components';
    // API_ASSET_OBSERVER_BEGIN
    const landingAssetBuild = 'bojbflhikkeojpnpicihmnfff';
    /** Embed this reviewed helper into main.js; call after track and the compiler-injected const landingAssetBuild are defined.
     * Compiler contract: <meta name="landing-html-build" content="baaaaaaaaaaaaaaaaaaaaaaaa">;
     * CSS :root { --landing-css-build: "baaaaaaaaaaaaaaaaaaaaaaaa"; }.
     * Compiler uses b + 24 a-p letters from SHA input, avoiding SDK consecutive-digit filtering.
     * Never substitute the HTML marker for landingAssetBuild: that would conceal a stale JS bundle.
     */
    function observeLandingCachedAssets(track, landingAssetBuild) {
        const safe = value => {
            if (typeof value !== 'string') return 'missing';
            let token = value.trim();
            if (!token) return 'missing';
            if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) token = token.slice(1, -1);
            return /^[A-Za-z0-9_][A-Za-z0-9_-]{0,99}$/.test(token) ? token : 'invalid';
        };
        const record = () => {
            const html = safe(document.querySelector('meta[name="landing-html-build"]')?.content);
            const js = safe(landingAssetBuild);
            let css = 'missing';
            try { css = safe(getComputedStyle(document.documentElement).getPropertyValue('--landing-css-build')); }
            catch { css = 'unreadable'; }
            // All three properties are fixed build identifiers or explicit absence states; never URLs/PII.
            track('runtime_assets_observed', {source: html, step: js, campaign: css});
        };
        // Defer only to an initial rendered frame, so computed CSS has an opportunity to apply.
        // A missing event remains missing evidence; it must not be silently filled from the intended release.
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(record);
        else record();
    }
    // API_ASSET_OBSERVER_END
    const pendingEvents = [];
    let exposed = false;
    const track = (name, properties = {}) => {
        pendingEvents.push({ name, properties: { variant, ...properties } });
        flushTracking();
    };
    function flushTracking() {
        if (!window.sessionTracker) return;
        if (!exposed) {
            window.sessionTracker.track('experiment_exposure', { variant });
            exposed = true;
        }
        while (pendingEvents.length) {
            const event = pendingEvents.shift();
            if (event.name === 'conversion_success') {
                window.sessionTracker.conversion(event.properties);
            } else {
                window.sessionTracker.track(event.name, event.properties);
            }
        }
    }
    // Insert inside the existing DOMContentLoaded closure after track() is defined.
    // Only an opaque request ID enters tracker events; raw context stays behind admin auth.
    const documentRequestId = document.querySelector('meta[name="landing-request-id"]')?.content || '';
    if (/^[a-p]{24}$/.test(documentRequestId)) {
        track('document_request_context', { campaign: documentRequestId, source: 'main_document', step: 'v1' });
    }

    // Insert inside the existing DOMContentLoaded closure after track() is defined.
    // Own first-party browser-context observation only; never a persona or conversion.
    (() => {
        let campaign = 'unlinked';
        let source = 'unavailable';
        let step = 'not_observed';
        try {
            const requestId = document.querySelector('meta[name="landing-request-id"]')?.content || '';
            if (/^[a-p]{24}$/.test(requestId)) campaign = requestId;
        } catch (_) { /* Missing request linkage is explicit. */ }
        try {
            const context = window.landingBrowserContext;
            if (context && typeof context.id === 'string' && /^[a-p]{24}$/.test(context.id)
                && typeof context.created === 'boolean') {
                source = context.id;
                step = context.created ? 'new_cookie_emitted' : 'cookie_returned';
            }
        } catch (_) { /* A missing probe must not interrupt registration. */ }
        track('browser_context_observed', { campaign, source, step });
    })();

    // Technical observations only: window.name is NOT a Chrome profile name.
    // Enumerate matching own-property NAMES; never read those arbitrary property values/getters.
    (() => {
        const campaign = /^[a-p]{24}$/.test(documentRequestId) ? documentRequestId : 'unlinked';
        const send = (name, source, step) => track(name, { campaign, source, step });
        const read = (getter) => {
            try { return getter(); } catch (_) { return undefined; }
        };
        const safeScalar = (name, source, value) => {
            if (typeof value !== 'string' || !value) {
                send(name, `${source}_unavailable`, 'not_transmitted');
                return;
            }
            if (!/^[A-Za-z0-9_:./-]+$/.test(value) || (value.match(/\d/g) || []).length >= 7) {
                send(name, `${source}_unsupported`, 'not_transmitted');
                return;
            }
            send(name, value.length > 100 ? `${source}_truncated` : source, value.slice(0, 100));
        };
        const webdriver = read(() => navigator.webdriver);
        send('browser_automation_state', 'webdriver', webdriver === true ? 'true' : webdriver === false ? 'false' : 'unavailable');
        safeScalar('browser_language', 'navigator_language', read(() => navigator.language));
        safeScalar('browser_platform', 'navigator_platform', read(() => navigator.platform));
        safeScalar('browser_timezone', 'intl_timezone', read(() => Intl.DateTimeFormat().resolvedOptions().timeZone));
        const windowName = read(() => window.name);
        if (windowName === '') {
            send('browser_window_name', 'empty', 'not_transmitted');
        } else if (typeof windowName === 'string') {
            safeScalar('browser_window_name', 'nonempty', windowName);
        } else {
            send('browser_window_name', 'unavailable', 'not_transmitted');
        }
        const names = read(() => Object.getOwnPropertyNames(window));
        if (Array.isArray(names)) {
            const matches = names.filter((name) => /mcp|playwright|puppeteer|webdriver|automation|profile/i.test(name));
            send('browser_window_name_inventory', 'matching_own_property_names', matches.length);
            for (const name of matches.slice(0, 16)) {
                safeScalar('browser_window_property_name', 'own_property_name_only', name);
            }
            if (matches.length > 16) {
                send('browser_window_name_inventory', 'names_omitted_by_limit', matches.length - 16);
            }
        } else {
            send('browser_window_name_inventory', 'unavailable', 'not_transmitted');
        }
    })();

    // The external deferred tracker can initialize after this file.
    flushTracking();
    observeLandingCachedAssets(track, landingAssetBuild); // API_ASSET_OBSERVER_CALL
    const trackingTimer = setInterval(flushTracking, 250);
    window.addEventListener('pagehide', () => clearInterval(trackingTimer), { once: true });

    // Observe copy intent without reading clipboard data or selected text.
    document.addEventListener('copy', (event) => {
        const selection = window.getSelection?.();
        const elementOf = (node) => node instanceof Element ? node : node?.parentElement;
        const target = elementOf(event.target);
        const anchor = elementOf(selection?.anchorNode);
        const focus = elementOf(selection?.focusNode);
        const privateArea = (node) => node?.closest('input,textarea,select,[contenteditable],[data-tracker-mask],[data-tracker-block],#registration-form');
        if (privateArea(target) || privateArea(anchor) || privateArea(focus)) return;
        const node = selection && !selection.isCollapsed ? anchor : target;
        const regions = [
            ['.hero', 'hero'], ['.program-list', 'program'],
            ['.features-grid', 'about'], ['.injury-grid', 'injuries'],
            ['.legal-section', 'legal'], ['.instructors-grid', 'instructors'],
            ['.pricing-section', 'pricing'], ['.site-footer', 'footer'],
        ];
        const source = regions.find(([selector]) => node?.closest(selector))?.[1] || 'page';
        track('copy_attempt', { source, step: selection && !selection.isCollapsed ? 'selection' : 'no_selection' });
    });

    const legalSection = document.querySelector('.legal-section');
    if (legalSection && 'IntersectionObserver' in window) {
        const legalObserver = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.25)) {
                track('legal_section_view', { source: 'legal', step: 'quarter_visible' });
                legalObserver.disconnect();
            }
        }, { threshold: [0, 0.25] });
        legalObserver.observe(legalSection);
    }

    const registrationSection = document.getElementById('registration');
    const form = document.getElementById('registration-form');
    const message = document.getElementById('form-message');
    const registerButtons = document.querySelectorAll('.btn-register');

    let pricingButtonIndex = 0;
    registerButtons.forEach((button) => {
        if (!button.dataset.trackLabel) {
            button.dataset.trackLabel = `pricing_cta_${++pricingButtonIndex}`;
        }
        button.addEventListener('click', () => {
            if (!registrationSection) {
                return;
            }

            track('registration_cta', { source: button.dataset.trackLabel });
            registrationSection.scrollIntoView({ behavior: 'instant', block: 'start' });
            const nameField = form?.querySelector('[name="name"]');
            if (nameField) {
                track('registration_focus_auto', { step: 'name', source: button.dataset.trackLabel });
                nameField.focus({ preventScroll: true });
            }
            track('registration_arrival', { source: button.dataset.trackLabel });
        });
    });

    const floatingButton = document.querySelector('.floating-register');
    const heroButton = document.querySelector('.hero-register');
    if (floatingButton && heroButton && registrationSection) {
        let floatingExposed = false;
        const updateFloatingButton = () => {
            const heroRect = heroButton.getBoundingClientRect();
            const sectionRect = registrationSection.getBoundingClientRect();
            const viewportHeight = document.documentElement.clientHeight;
            const heroVisible = heroRect.bottom > 0 && heroRect.top < viewportHeight;
            const registrationVisible = sectionRect.bottom > 0 && sectionRect.top < viewportHeight;
            const shouldHide = heroVisible || registrationVisible;
            if (floatingButton.hidden !== shouldHide) floatingButton.hidden = shouldHide;
            if (!floatingButton.hidden && !floatingExposed) {
                track('floating_cta_view', { source: 'floating_cta' });
                floatingExposed = true;
            }
        };
        // Actual geometry also handles a phone with a short initial viewport.
        if ('IntersectionObserver' in window) {
            const floatingObserver = new IntersectionObserver(updateFloatingButton);
            floatingObserver.observe(heroButton);
            floatingObserver.observe(registrationSection);
        }
        window.addEventListener('scroll', updateFloatingButton, { passive: true });
        window.addEventListener('resize', updateFloatingButton);
        updateFloatingButton();
    }

    if (!form) {
        return;
    }
    // CONTACT_COMPONENT_SERIALIZER_BEGIN
    function assembleContact(choice, part, custom, full) {
        const values=[choice,part,custom,full];
        if (!values.every(value=>typeof value==='string')) return '';
        if (choice==='full') return full.trim();
        const code=choice==='custom'?custom.trim():['+7','+1','+44'].includes(choice)?choice:'';
        if (!code || !part.trim() || part.trim().startsWith('+') || (choice==='custom'&&!/^\+[0-9]+$/.test(code))) return '';
        // Preserve entered national digits, zeros and extension text; never infer a country or strip trunk prefixes.
        return code+' '+part.trim();
    }
    // CONTACT_COMPONENT_SERIALIZER_END

    const componentUI=form.querySelector('.contact-components-ui');
    const componentChoice=componentUI.querySelector('select');
    const componentPart=componentUI.querySelector('.component-part input');
    const componentCustom=componentUI.querySelector('.component-custom input');
    const componentFull=componentUI.querySelector('.component-full input');
    const componentPreview=componentUI.querySelector('.component-preview');
    function contactValue() {
        return assembleContact(componentChoice.value,componentPart.value,componentCustom.value,componentFull.value);
    }
    function updateComponents() {
        const full=componentChoice.value==='full',custom=componentChoice.value==='custom';
        for(const [element,active] of [[componentPart,!full],[componentCustom,custom],[componentFull,full]]) {
            element.closest('label').hidden=!active;
            element.disabled=!active;
            element.required=active;
            if(!active)element.setCustomValidity('');
        }
        componentChoice.setCustomValidity('');
        const value=contactValue();
        componentPreview.textContent=value?'Будет отправлено: '+value:'Выберите способ и введите свой контакт.';
    }
    componentUI.disabled=false;
    componentChoice.addEventListener('change',updateComponents);
    for(const element of [componentPart,componentCustom,componentFull])element.addEventListener('input',updateComponents);
    componentUI.querySelector('.component-use-full').addEventListener('click',()=>{
        // Explicit visitor action only: move the actual entered string, never guess a prefix/domain.
        if(componentPart.value.trim())componentFull.value=componentPart.value;
        componentChoice.value='full';updateComponents();componentFull.focus();
    });
    form.addEventListener('reset',()=>queueMicrotask(updateComponents));
    updateComponents();

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                track('registration_view');
                observer.disconnect();
            }
        }, { threshold: 0.25 });
        observer.observe(form);
    }
    // A separate qualified view is not evidence of reading or intent.
    // Keep the legacy view event so historical reports remain comparable.
    if ('IntersectionObserver' in window) {
        let viewTimer = null;
        let halfVisible = false;
        let qualified = false;
        const visibleFraction = () => {
            const rect = form.getBoundingClientRect();
            const width = Math.max(0, Math.min(rect.right, document.documentElement.clientWidth) - Math.max(rect.left, 0));
            const height = Math.max(0, Math.min(rect.bottom, document.documentElement.clientHeight) - Math.max(rect.top, 0));
            return rect.width * rect.height ? width * height / (rect.width * rect.height) : 0;
        };
        const checkView = () => {
            clearTimeout(viewTimer);
            if (qualified || !halfVisible || document.visibilityState !== 'visible') return;
            viewTimer = setTimeout(() => {
                if (document.visibilityState === 'visible' && visibleFraction() >= 0.5) {
                    qualified = true;
                    track('registration_view_qualified', { step: 'half_form_1s' });
                    viewObserver.disconnect();
                    document.removeEventListener('visibilitychange', checkView);
                }
            }, 1000);
        };
        const viewObserver = new IntersectionObserver((entries) => {
            halfVisible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
            checkView();
        }, { threshold: [0, 0.5] });
        viewObserver.observe(form);
        document.addEventListener('visibilitychange', checkView);
        window.addEventListener('pagehide', () => clearTimeout(viewTimer));
    }

    let inputStarted = false;
    form.addEventListener('input', (event) => {
        if (!inputStarted && ['name', 'phone', 'email', 'purpose'].includes(event.target.name)) {
            inputStarted = true;
            track('registration_input_start', { step: event.target.name });
        }
    });

    form.addEventListener('focusin', (event) => {
        if (['name', 'phone', 'email', 'purpose'].includes(event.target.name)) {
            track('registration_field_focus', { step: event.target.name });
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const componentValue=contactValue();
        let validComponent=Boolean(componentValue);
        if(!validComponent){componentChoice.setCustomValidity('Проверьте свой контакт или выберите ввод одной строкой.');componentChoice.reportValidity();return;}
        track('registration_submit');
        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        ["phone_mode_ui", "phone_national_ui", "phone_custom_ui", "phone_full_ui"].forEach(name=>formData.delete(name));
        formData.set('phone',componentValue);

        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }

        if (message) {
            message.textContent = '';
            message.className = 'form-message';
        }

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Не удалось отправить заявку.');
            }

            if (message) {
                message.textContent = 'Заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.';
                message.className = 'form-message success';
            }

            track('conversion_success', { source: 'registration' });
            form.reset();
        } catch (error) {
            track('registration_error', { source: 'submit' });
            if (message) {
                message.textContent = error instanceof Error ? error.message : 'Не удалось отправить заявку.';
                message.className = 'form-message error';
            }
        } finally {
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    });
});
