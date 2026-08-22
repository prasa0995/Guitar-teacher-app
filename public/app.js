// Shared API client + tiny hash router + app shell.
export const state = {
  user: null,
  profile: null,
};

export async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

const routes = {};
export function registerRoute(name, renderFn) { routes[name] = renderFn; }

const NAV = [
  ['home', 'Home', '🏠'],
  ['learn', 'Learn', '📘'],
  ['songs', 'Songs', '🎵'],
  ['practice', 'Practice', '⏱️'],
  ['chords', 'Chords', '🎼'],
  ['theory', 'Theory', '🧠'],
  ['fretboard', 'Fretboard', '🎯'],
  ['skills', 'My Skills', '🌱'],
  ['progress', 'Progress', '📈'],
];

function currentRoute() {
  const hash = location.hash.replace('#', '') || 'home';
  return hash.split('/').map((part) => { try { return decodeURIComponent(part); } catch (e) { return part; } });
}

async function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const [routeName] = currentRoute();
  const sidebar = h('div', { class: 'sidebar' }, [
    h('div', { class: 'brand' }, ['🎸 AI Guitar', h('span', {}, 'Sensei')]),
    ...NAV.map(([key, label, icon]) =>
      h('a', { href: `#${key}`, class: routeName === key ? 'active' : '' }, `${icon}  ${label}`)
    ),
    h('a', { href: '#', onclick: (e) => { e.preventDefault(); logout(); } }, 'Log out'),
  ]);

  const main = h('div', { class: 'main', id: 'main' });
  app.appendChild(sidebar);
  app.appendChild(main);

  await renderRoute(main);
  mountAIChat();
}

async function renderRoute(main) {
  main.innerHTML = '<p class="muted">Loading…</p>';
  const [name, ...rest] = currentRoute();
  const renderFn = routes[name] || routes.home;
  try {
    await renderFn(main, rest);
  } catch (err) {
    main.innerHTML = '';
    main.appendChild(h('div', { class: 'card' }, [`Something went wrong: ${err.message}`]));
  }
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  state.user = null;
  boot();
}

let aiMounted = false;
function mountAIChat() {
  if (aiMounted) return;
  aiMounted = true;
  import('./components/aiChat.js').then((m) => m.mount());
}

export function navigate(hash) {
  location.hash = hash;
}

window.addEventListener('hashchange', () => {
  const main = document.getElementById('main');
  if (main) renderRoute(main);
  // refresh active nav state
  const [routeName] = currentRoute();
  document.querySelectorAll('.sidebar a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === `#${routeName}`);
  });
});

async function boot() {
  const app = document.getElementById('app');
  try {
    const { user } = await api('/auth/me');
    state.user = user;
  } catch (e) {
    state.user = null;
  }

  if (!state.user) {
    app.innerHTML = '';
    // The "app" link (#app) — and directly landing on #login/#signup —
    // skip the marketing page and go straight into sign-in. Plain visits
    // to the bare domain show the landing page (the "website" link).
    const rawHash = location.hash.replace('#', '');
    const directModes = { app: 'login', login: 'login', signup: 'signup' };
    if (directModes[rawHash]) {
      const auth = await import('./views/authScreens.js');
      const afterAuth = () => { location.hash = '#home'; boot(); };
      auth.render(app, afterAuth, directModes[rawHash], () => { location.hash = ''; boot(); });
      return;
    }
    const landing = await import('./views/landing.js');
    landing.render(app, async (mode) => {
      app.innerHTML = '';
      const auth = await import('./views/authScreens.js');
      auth.render(app, boot, mode, boot);
    });
    return;
  }

  const { profile } = await api('/profile');
  state.profile = profile;

  if (!profile.onboardingComplete) {
    app.innerHTML = '';
    const mod = await import('./views/onboarding.js');
    mod.render(app, async () => {
      const { profile: fresh } = await api('/profile');
      state.profile = fresh;
      if (!location.hash) location.hash = '#home';
      await renderShell();
    });
    return;
  }

  if (!location.hash) location.hash = '#home';
  await renderShell();
}

// register all views
Promise.all([
  import('./views/home.js'),
  import('./views/learn.js'),
  import('./views/songs.js'),
  import('./views/songPlayer.js'),
  import('./views/practice.js'),
  import('./views/chords.js'),
  import('./views/chordDetail.js'),
  import('./views/theory.js'),
  import('./views/fretboard.js'),
  import('./views/skills.js'),
  import('./views/progress.js'),
]).then((mods) => {
  mods.forEach((m) => m.register(registerRoute));
  boot();
});
