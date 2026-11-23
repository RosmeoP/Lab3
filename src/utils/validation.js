// Sincroniza el estado programático ARIA (aria-invalid y aria-describedby) con :user-invalid
// e incluye fallback para navegadores sin :user-invalid, siguiendo las guías de accesibilidad.

export function initFormValidation(root = document) {
  const supportsUserInvalid =
    typeof CSS !== 'undefined' && CSS.supports && CSS.supports('selector(:user-invalid)');

  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.classList.add('visually-hidden');
  document.body.append(announcer);

  let announceTimer;
  let announcedField;

  const flagged = new WeakSet();
  const announced = new WeakSet();
  const dirtyState = new WeakMap();

  const linkError = (el, shown) => {
    const errorId = el.dataset?.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const spokenText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
      n.replaceWith(`${n.getAttribute('aria-label')}: `);
    });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };

  const announceError = (el) => {
    const error = document.getElementById(el.dataset?.error || '');
    if (!error) return;
    const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = label + spokenText(error);
    }, 500);
  };

  const syncAria = (el, announce = false) => {
    if (!el || !el.matches?.('input, select, textarea')) return;

    let invalid = false;
    if (supportsUserInvalid) {
      invalid = el.matches(':user-invalid');
    } else {
      const state = dirtyState.get(el);
      invalid = Boolean(state?.hasInteracted && state?.hasBlurred && !el.validity.valid);
      el.classList.toggle('user-invalid-fallback', invalid);
      el.classList.toggle(
        'user-valid-fallback',
        Boolean(state?.hasInteracted && state?.hasBlurred && el.validity.valid)
      );
    }

    if (invalid) {
      if (announce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  root.querySelectorAll('input, select, textarea').forEach((el) => syncAria(el));

  root.addEventListener(
    'blur',
    (e) => {
      if (!supportsUserInvalid && e.target?.matches?.('input, select, textarea')) {
        const state = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(e.target, state);
      }
      syncAria(e.target, true);
    },
    true
  );

  root.addEventListener('input', (e) => {
    if (!supportsUserInvalid && e.target?.matches?.('input, select, textarea')) {
      const state = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(e.target, state);
    }
    if (e.target?.hasAttribute?.('aria-invalid')) {
      syncAria(e.target);
    }
  });

  root.addEventListener(
    'change',
    (e) => {
      if (!supportsUserInvalid && e.target?.matches?.('input, select, textarea')) {
        dirtyState.set(e.target, { hasInteracted: true, hasBlurred: true });
      }
      syncAria(e.target, true);
    },
    true
  );

  root.addEventListener(
    'invalid',
    (e) => {
      if (!supportsUserInvalid && e.target?.matches?.('input, select, textarea')) {
        dirtyState.set(e.target, { hasInteracted: true, hasBlurred: true });
      }
      announced.add(e.target);
      syncAria(e.target);
    },
    true
  );

  root.addEventListener(
    'reset',
    (e) => {
      setTimeout(() => {
        const elements = e.target?.elements ? [...e.target.elements] : [];
        for (const el of elements) {
          dirtyState.delete(el);
          el.classList?.remove('user-invalid-fallback', 'user-valid-fallback');
          syncAria(el);
        }
      });
    },
    true
  );
}

// Fallback para light-dismiss en navegadores sin soporte de <dialog closedby="any">
export function initDialogLightDismissFallback() {
  if ('closedBy' in HTMLDialogElement.prototype) return;

  const isOutside = (event, dialog) => {
    const rect = dialog.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };

  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (event) => {
      pressedOutside = isOutside(event, dialog);
    });
    dialog.addEventListener('pointerup', (event) => {
      if (pressedOutside && isOutside(event, dialog)) {
        dialog.close();
      }
    });
  }
}

