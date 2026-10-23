document.addEventListener('DOMContentLoaded', () => {
    const variant = 'e05_static_cards';
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
            form?.querySelector('[name="name"]')?.focus({ preventScroll: true });
            track('registration_arrival', { source: button.dataset.trackLabel });
        });
    });

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
