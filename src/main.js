import './styles.css';
import { h } from './ui.js';
import { getState, setSetting } from './store.js';
import { stopSpeaking } from './speech.js';
import { homeView, mistakesView, reviewView, progressView } from './views/global.js';
import { lessonView, grammarView, readingView, exercisesView, testView } from './views/lesson.js';
import { vocabView } from './views/vocab.js';

const main = document.getElementById('main');

const ROUTES = [
  [/^\/$/, homeView],
  [/^\/lesson\/([\w-]+)$/, lessonView],
  [/^\/lesson\/([\w-]+)\/vocab$/, vocabView],
  [/^\/lesson\/([\w-]+)\/grammar$/, grammarView],
  [/^\/lesson\/([\w-]+)\/reading$/, readingView],
  [/^\/lesson\/([\w-]+)\/exercises$/, exercisesView],
  [/^\/lesson\/([\w-]+)\/test$/, testView],
  [/^\/mistakes$/, mistakesView],
  [/^\/review$/, reviewView],
  [/^\/progress$/, progressView],
];

const NAV = [['#/', 'Home'], ['#/review', 'Review'], ['#/mistakes', 'Mistakes'], ['#/progress', 'Progress']];

function renderNav(path) {
  document.getElementById('nav').replaceChildren(...NAV.map(([href, label]) => {
    const current = href === '#/' ? path === '/' || path.startsWith('/lesson') : path.startsWith(href.slice(1));
    return h('a', { href, 'aria-current': current ? 'page' : null }, label);
  }));
}

function route() {
  stopSpeaking();
  const path = location.hash.replace(/^#/, '') || '/';
  renderNav(path);
  main.replaceChildren();
  const match = ROUTES.map(([re, view]) => [path.match(re), view]).find(([m]) => m);
  if (match) match[1](main, ...match[0].slice(1));
  else main.replaceChildren(h('h1', null, 'Page not found'), h('a', { class: 'btn', href: '#/' }, 'Back to home'));
  window.scrollTo(0, 0);
  // Move focus to the new content for screen readers and keyboard users, unless the view already placed it
  if (!main.contains(document.activeElement)) main.focus({ preventScroll: true });
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  setSetting('theme', root.dataset.theme);
});
if (getState().settings.theme) document.documentElement.dataset.theme = getState().settings.theme;

window.addEventListener('hashchange', route);
route();

// Offline: the service worker runs only in production (in development it would get in the way of hot reload)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');
      // Cache the resources from this first load, which the service worker has not intercepted yet
      const urls = performance.getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => u.startsWith(location.origin));
      const cache = await caches.open('english-review-v2');
      await cache.addAll([...new Set(['./', ...urls])]);
    } catch { /* without a service worker the app still works online */ }
  });
}
