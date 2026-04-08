const state = {
  elements: {}
};

function normalizeElement(raw) {
  if (!raw) return null;
  const selector = typeof raw === 'string' ? raw : raw.selector;
  if (!selector) return null;

  const status =
    raw.status === 'visited' || raw.visited
      ? 'visited'
      : raw.status === 'blocked'
      ? 'blocked'
      : 'pending';

  return {
    selector,
    visited: Boolean(raw.visited),
    attempts: Number(raw.attempts || 0),
    status,
  };
}

function addElements(elements = []) {
  elements.forEach(raw => {
    const element = normalizeElement(raw);
    if (!element) return;

    const existing = state.elements[element.selector];
    if (!existing) {
      state.elements[element.selector] = { ...element };
      return;
    }

    const merged = {
      ...existing,
      ...element,
      visited: existing.visited || element.visited,
      attempts: Math.max(existing.attempts, element.attempts),
    };

    if (existing.status === 'visited' || element.status === 'visited') {
      merged.status = 'visited';
    } else if (existing.status === 'blocked' || element.status === 'blocked') {
      merged.status = 'blocked';
    } else {
      merged.status = element.status || existing.status || 'pending';
    }

    state.elements[element.selector] = merged;
  });
}

function getElement(selector) {
  return state.elements[selector];
}

function markVisited(selector) {
  let el = state.elements[selector];
  if (!el) {
    addElements([{ selector, visited: true, attempts: 1, status: 'visited' }]);
    return;
  }

  el.visited = true;
  el.status = 'visited';
  el.attempts = Math.max(el.attempts, 1);
}

function markAttempt(selector) {
  let el = state.elements[selector];
  if (!el) {
    addElements([{ selector, attempts: 1, status: 'pending' }]);
    return;
  }

  el.attempts += 1;
  if (el.attempts >= 3 && el.status !== 'visited') {
    el.status = 'blocked';
  }
}

function markBlocked(selector) {
  let el = state.elements[selector];
  if (!el) {
    addElements([{ selector, attempts: 3, status: 'blocked' }]);
    return;
  }

  el.status = 'blocked';
  el.attempts = Math.max(el.attempts, 3);
}

function getPendingElements() {
  return Object.entries(state.elements)
    .filter(([_, el]) => el.status === 'pending')
    .sort(([, a], [, b]) => a.attempts - b.attempts)
    .map(([selector]) => selector);
}

function getCoverage() {
  const values = Object.values(state.elements);
  const total = values.length;
  const visited = values.filter(v => v.status === 'visited').length;

  return total === 0 ? 0 : (visited / total) * 100;
}

function getStats() {
  const values = Object.values(state.elements);
  return {
    total: values.length,
    visited: values.filter(v => v.status === 'visited').length,
    blocked: values.filter(v => v.status === 'blocked').length,
    pending: values.filter(v => v.status === 'pending').length,
    coverage: getCoverage(),
  };
}

function printStats() {
  const stats = getStats();
  console.log('Total:', stats.total);
  console.log('Visited:', stats.visited);
  console.log('Pending:', stats.pending);
  console.log('Blocked:', stats.blocked);
}

module.exports = {
  addElements,
  getElement,
  markVisited,
  markAttempt,
  markBlocked,
  getPendingElements,
  getCoverage,
  getStats,
  printStats,
};
