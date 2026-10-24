document.addEventListener('DOMContentLoaded', () => {
    const variant = 'e26_reading_measure';
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
    // The external deferred tracker can initialize after this file.
    flushTracking();
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

        track('registration_submit');
        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);

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
