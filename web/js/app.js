import { APP_NAME, FALLBACK_CITY } from './config.js';
import { CATALOG, slug } from './catalog.js';
import { dailyPicks } from './core/dailyPick.js';
import { formatIsoDate, parseIsoDate } from './core/dates.js';
import { dayPartOf, localParts, seasonOf } from './core/season.js';
import { scentScore } from './core/scentScore.js';
import { wearCountsByDate, wearStreak } from './core/streak.js';
import { DAY_PARTS, FAMILIES, OCCASIONS, SEASONS } from './core/types.js';
import { detectLocale, getLocale, setLocale, t } from './i18n.js';
import { exportJson, getState, isStorageOk, load, makeId, replaceAll, sanitizeFragrance, STORAGE_KEY, subscribe, update } from './store.js';
import { SEASON_FALLBACK, getWeather } from './weather.js';

const root = document.getElementById('app');
const ROUTES = ['today', 'collection', 'stats', 'profile'];
const ui = { tab: 'owned', query: '', weather: null, weatherKey: '', weatherLoading: false, weatherAt: 0, shown: 40 };

// ---------------------------------------------------------------- yardımcılar
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'value') el.value = value;
    else if (key === 'checked') el.checked = Boolean(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgIcon(pathD) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

const ICONS = {
  today: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
  collection: 'M9 3h6v3H9zM8 6h8v3l1 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8l1-2z',
  stats: 'M5 20V10M12 20V4M19 20v-7',
  profile: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};

let toastTimer = null;
function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/** Arama için: İ/ı/I -> i, aksan ve büyük harf kaldır (Türkçe karakterli aramayı doğru yapar). */
export function normalize(text) {
  return String(text)
    .replace(/[İIı]/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function allFragrances() {
  return [...CATALOG, ...getState().custom];
}

function fragranceMap() {
  return new Map(allFragrances().map((f) => [f.id, f]));
}

function collator() {
  return new Intl.Collator(getLocale() === 'tr' ? 'tr' : 'en');
}

function byBrandName(a, b) {
  const c = collator();
  return c.compare(a.brand, b.brand) || c.compare(a.name, b.name);
}

function effectiveTz() {
  const guess = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  })();
  for (const candidate of [getState().profile.tz, guess, 'UTC']) {
    if (!candidate) continue;
    try {
      localParts(new Date(), candidate);
      return candidate;
    } catch {
      /* sıradaki adayı dene */
    }
  }
  return 'UTC';
}

function userLocation() {
  const { lat, lon } = getState().profile;
  if (lat !== null && lon !== null) return { lat, lon, isDefault: false };
  return { lat: FALLBACK_CITY.latitude, lon: FALLBACK_CITY.longitude, isDefault: true };
}

function ownedFragrances() {
  const map = fragranceMap();
  const { items } = getState();
  return Object.entries(items)
    .filter(([, status]) => status === 'owned')
    .map(([id]) => map.get(id))
    .filter(Boolean);
}

function todayContext() {
  const loc = userLocation();
  const parts = localParts(new Date(), effectiveTz());
  const season = seasonOf(parts.month, loc.lat < 0 ? 'south' : 'north');
  const dayPart = dayPartOf(parts.hour);
  const lastWornOn = {};
  for (const wear of getState().wears) {
    if (wear.date <= parts.date && (!lastWornOn[wear.fragranceId] || wear.date > lastWornOn[wear.fragranceId])) {
      lastWornOn[wear.fragranceId] = wear.date;
    }
  }
  return { loc, today: parts.date, season, dayPart, lastWornOn };
}

// ---------------------------------------------------------------- hava durumu
async function ensureWeather() {
  const { loc } = todayContext();
  const key = `${loc.lat},${loc.lon}`;
  // Aynı konum için: yükleniyorsa, sonuç varsa ya da son deneme 60 sn'den yeniyse yeniden deneme.
  if (ui.weatherKey === key && (ui.weatherLoading || ui.weather || Date.now() - ui.weatherAt < 60000)) return;
  ui.weatherKey = key;
  ui.weatherAt = Date.now();
  ui.weatherLoading = true;
  ui.weather = null;
  const result = await getWeather(getState().weatherCache, loc.lat, loc.lon);
  ui.weatherLoading = false;
  if (ui.weatherKey !== key) return;
  ui.weather = result;
  if (result && result.source === 'live') {
    update((s) => {
      s.weatherCache = { ts: result.ts, lat: loc.lat, lon: loc.lon, data: result.data };
    });
  }
  if (currentRoute() === 'today') render();
}

// ---------------------------------------------------------------- ortak parçalar
function intensityDots(value) {
  return h(
    'span',
    { class: 'dots', role: 'img', 'aria-label': `${t('col.intensity')} ${value}/5` },
    [1, 2, 3, 4, 5].map((n) => h('i', { class: n <= value ? 'on' : '' })),
  );
}

function fragranceHeader(f) {
  return h(
    'div',
    { class: 'fh' },
    h('div', { class: 'brand' }, f.brand),
    h('div', { class: 'name' }, f.name),
  );
}

function chips(f, extra) {
  return h(
    'div',
    { class: 'chips' },
    h('span', { class: 'chip' }, t(`family.${f.family}`)),
    f.niche ? h('span', { class: 'chip accent' }, t('col.niche')) : null,
    extra || null,
    intensityDots(f.intensity),
  );
}

function setStatus(id, status) {
  update((s) => {
    if (s.items[id] === status) delete s.items[id];
    else s.items[id] = status;
  });
}

// ---------------------------------------------------------------- Bugün
function whyReasons(pick, ctx, weather) {
  const reasons = [];
  const b = pick.breakdown;
  if (b.temperature >= 0.8) reasons.push(t('why.temperature'));
  if (b.season >= 0.8) reasons.push(t('why.season'));
  if (b.time >= 0.8) reasons.push(t(ctx.dayPart === 'day' ? 'why.day' : 'why.night'));
  if (b.freshness >= 0.9 && ctx.lastWornOn[pick.fragrance.id]) reasons.push(t('why.fresh'));
  if (weather.humidityPct >= 75 && b.humidity >= 0.9) reasons.push(t('why.dry'));
  return reasons.slice(0, 3);
}

function viewToday() {
  const ctx = todayContext();
  const owned = ownedFragrances();
  const state = getState();
  const result = ui.weather;
  const weather = result ? result.data : SEASON_FALLBACK[ctx.season];
  const wrap = h('section', { class: 'view' });

  wrap.append(h('h1', null, state.profile.name ? `${t('today.title')}, ${state.profile.name}` : t('today.title')));

  const weatherNote =
    ui.weatherLoading && !result
      ? '…'
      : !result
        ? t('today.weather.fallback')
        : result.source === 'stale'
          ? t('today.weather.stale')
          : '';
  wrap.append(
    h(
      'div',
      { class: 'card weather', 'data-testid': 'weather' },
      h('div', { class: 'temp' }, `${Math.round(weather.tempC)}°C`),
      h(
        'div',
        { class: 'wmeta' },
        h('div', null, `${t('today.weather.humidity')} ${Math.round(weather.humidityPct)}%`),
        weather.precipitationMm > 0 ? h('div', null, `${t('today.weather.rain')} ${weather.precipitationMm} mm`) : null,
        h('div', { class: 'muted' }, `${t(`season.${ctx.season}`)} · ${ctx.loc.isDefault ? FALLBACK_CITY.name : state.profile.city || '📍'}`),
      ),
      weatherNote ? h('div', { class: 'note' }, weatherNote) : null,
    ),
  );

  if (owned.length === 0) {
    wrap.append(
      h(
        'div',
        { class: 'card empty' },
        h('h2', null, t('today.empty.title')),
        h('p', null, t('today.empty.text')),
        h('a', { class: 'btn primary', href: '#/collection', 'data-testid': 'empty-cta' }, t('today.empty.cta')),
      ),
    );
    return wrap;
  }

  const picks = dailyPicks(owned, { weather, season: ctx.season, dayPart: ctx.dayPart, today: ctx.today, lastWornOn: ctx.lastWornOn }, 3);
  const [main, ...alts] = picks;
  const wornToday = (id) => state.wears.find((w) => w.fragranceId === id && w.date === ctx.today);
  const streak = wearStreak(state.wears.map((w) => w.date), ctx.today);

  const toggleWear = (fragrance) => {
    const existing = wornToday(fragrance.id);
    update((s) => {
      if (existing) s.wears = s.wears.filter((w) => w.id !== existing.id);
      else s.wears.push({ id: makeId(), fragranceId: fragrance.id, date: ctx.today });
    });
  };

  const reasons = whyReasons(main, ctx, weather);
  wrap.append(
    h(
      'div',
      { class: 'card hero', 'data-testid': 'main-pick' },
      h('div', { class: 'kicker' }, t('today.pick.main')),
      fragranceHeader(main.fragrance),
      chips(main.fragrance),
      reasons.length ? h('ul', { class: 'why' }, reasons.map((r) => h('li', null, r))) : null,
      h('div', { class: 'match' }, `${t('today.score')} ${Math.round(main.score)}`),
      h(
        'button',
        { class: wornToday(main.fragrance.id) ? 'btn done' : 'btn primary', 'data-testid': 'wear-main', onclick: () => toggleWear(main.fragrance) },
        wornToday(main.fragrance.id) ? `✓ ${t('today.worn')} · ${t('today.undo')}` : t('today.wear'),
      ),
      streak.current > 0 ? h('div', { class: 'muted streak' }, `🔥 ${streak.current} ${t('today.streak')}`) : null,
    ),
  );

  if (alts.length) {
    wrap.append(h('h2', null, t('today.pick.alt')));
    for (const alt of alts) {
      wrap.append(
        h(
          'div',
          { class: 'card row', 'data-testid': 'alt-pick' },
          h('div', { class: 'grow' }, fragranceHeader(alt.fragrance), chips(alt.fragrance)),
          h(
            'div',
            { class: 'side' },
            h('div', { class: 'match small' }, `${t('today.score')} ${Math.round(alt.score)}`),
            h(
              'button',
              { class: wornToday(alt.fragrance.id) ? 'btn small done' : 'btn small', onclick: () => toggleWear(alt.fragrance) },
              wornToday(alt.fragrance.id) ? '✓' : t('today.wearShort'),
            ),
          ),
        ),
      );
    }
  }
  return wrap;
}

// ---------------------------------------------------------------- Koleksiyon
function card(f) {
  const status = getState().items[f.id];
  const isCustom = f.id.startsWith('custom-');
  return h(
    'div',
    { class: 'card frag', 'data-testid': 'frag-card', 'data-id': f.id },
    h('div', { class: 'grow' }, fragranceHeader(f), chips(f, isCustom ? h('span', { class: 'chip' }, t('col.custom.badge')) : null)),
    h(
      'div',
      { class: 'actions' },
      h('button', { class: status === 'owned' ? 'btn small on' : 'btn small', 'aria-pressed': String(status === 'owned'), 'data-action': 'own', onclick: () => setStatus(f.id, 'owned') }, status === 'owned' ? `✓ ${t('col.add')}` : t('col.add')),
      h('button', { class: status === 'wishlist' ? 'btn small on' : 'btn small', 'aria-pressed': String(status === 'wishlist'), 'data-action': 'wish', onclick: () => setStatus(f.id, 'wishlist') }, status === 'wishlist' ? `♥ ${t('col.wish')}` : t('col.wish')),
      isCustom
        ? h(
            'button',
            {
              class: 'btn small danger',
              'aria-label': t('col.remove'),
              onclick: () => {
                if (!confirm(`${t('col.remove')}: ${f.brand} ${f.name}?`)) return;
                update((s) => {
                  s.custom = s.custom.filter((c) => c.id !== f.id);
                  delete s.items[f.id];
                  s.wears = s.wears.filter((w) => w.fragranceId !== f.id);
                });
              },
            },
            '✕',
          )
        : null,
    ),
  );
}

function listFor(tab, query) {
  const map = fragranceMap();
  const { items } = getState();
  if (tab === 'catalog') {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    const matches = allFragrances().filter((f) => {
      const hay = normalize(`${f.brand} ${f.name}`);
      return tokens.every((tok) => hay.includes(tok));
    });
    return { list: matches.sort(byBrandName), total: matches.length };
  }
  const status = tab === 'owned' ? 'owned' : 'wishlist';
  const list = Object.entries(items)
    .filter(([, s]) => s === status)
    .map(([id]) => map.get(id))
    .filter(Boolean)
    .sort(byBrandName);
  return { list, total: list.length };
}

const CATALOG_LIMIT = 40;

function fillList(container) {
  container.replaceChildren();
  const { list, total } = listFor(ui.tab, ui.query);
  if (total === 0) {
    container.append(
      h('p', { class: 'muted center', 'data-testid': 'empty-list' }, ui.tab === 'owned' ? t('col.empty.owned') : ui.tab === 'wishlist' ? t('col.empty.wishlist') : t('col.noresult')),
    );
    return;
  }
  const shown = ui.tab === 'catalog' ? list.slice(0, ui.shown) : list;
  for (const f of shown) container.append(card(f));
  if (ui.tab === 'catalog' && total > shown.length) {
    container.append(
      h('p', { class: 'muted center' }, `${shown.length} / ${total} ${t('col.shown')}`),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'more', onclick: () => { ui.shown += CATALOG_LIMIT; fillList(container); } }, t('col.more')),
    );
  }
}

function openAddDialog() {
  const dialog = h('dialog', { class: 'sheet', 'data-testid': 'add-dialog' });
  const err = h('p', { class: 'error', role: 'alert' });
  const brand = h('input', { type: 'text', maxlength: '120', name: 'brand', autocomplete: 'off' });
  const name = h('input', { type: 'text', maxlength: '160', name: 'name', autocomplete: 'off' });
  const family = h('select', { name: 'family' }, FAMILIES.map((f) => h('option', { value: f }, t(`family.${f}`))));
  const niche = h('input', { type: 'checkbox', name: 'niche' });
  const intensity = h('input', { type: 'range', min: '1', max: '5', step: '1', value: '3', name: 'intensity' });
  const checks = (group, values, labelKey) =>
    values.map((v) => {
      const input = h('input', { type: 'checkbox', 'data-group': group, value: v });
      return h('label', { class: 'check' }, input, t(`${labelKey}.${v}`));
    });
  const partLabels = { day: t('part.day'), night: t('part.night') };

  const form = h(
    'form',
    {
      method: 'dialog',
      novalidate: true, // kendi iki dilli doğrulama mesajlarımız gösterilsin
      onsubmit: (event) => {
        event.preventDefault();
        const q = (group) => [...form.querySelectorAll(`input[data-group="${group}"]:checked`)].map((i) => i.value);
        const seasons = q('season');
        const parts = q('part');
        const brandText = brand.value.trim();
        const nameText = name.value.trim();
        if (!brandText || !nameText) return void (err.textContent = t('form.err.required'));
        if (seasons.length === 0) return void (err.textContent = t('form.err.season'));
        if (parts.length === 0) return void (err.textContent = t('form.err.part'));
        const key = normalize(`${brandText} ${nameText}`);
        if (allFragrances().some((f) => normalize(`${f.brand} ${f.name}`) === key)) return void (err.textContent = t('form.err.exists'));
        const fragrance = sanitizeFragrance({
          id: `custom-${slug(`${brandText} ${nameText}`)}-${makeId().slice(0, 6)}`,
          brand: brandText,
          name: nameText,
          family: family.value,
          niche: niche.checked,
          seasons: Object.fromEntries(SEASONS.map((s) => [s, seasons.includes(s) ? 0.9 : 0.2])),
          dayParts: Object.fromEntries(DAY_PARTS.map((p) => [p, parts.includes(p) ? 0.9 : 0.2])),
          intensity: Number(intensity.value),
          occasions: q('occasion'),
        });
        if (!fragrance) return void (err.textContent = t('form.err.required'));
        update((s) => {
          s.custom.push(fragrance);
          s.items[fragrance.id] = 'owned';
        });
        dialog.close();
        toast(t('toast.added'));
      },
    },
    h('h2', null, t('form.title')),
    h('label', null, t('form.brand'), brand),
    h('label', null, t('form.name'), name),
    h('label', null, t('form.family'), family),
    h('label', { class: 'check' }, niche, t('form.niche')),
    h('label', null, t('form.intensity'), intensity),
    h('fieldset', null, h('legend', null, t('form.seasons')), checks('season', SEASONS, 'season')),
    h('fieldset', null, h('legend', null, t('form.parts')), DAY_PARTS.map((p) => h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-group': 'part', value: p }), partLabels[p]))),
    h('fieldset', null, h('legend', null, t('form.occasions')), checks('occasion', OCCASIONS, 'occasion')),
    err,
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, t('form.cancel')), h('button', { type: 'submit', class: 'btn primary', 'data-testid': 'save-custom' }, t('form.save'))),
  );
  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

function viewCollection() {
  const state = getState();
  const counts = {
    owned: Object.values(state.items).filter((s) => s === 'owned').length,
    wishlist: Object.values(state.items).filter((s) => s === 'wishlist').length,
  };
  const wrap = h('section', { class: 'view' });
  wrap.append(h('h1', null, t('col.title')));

  const listEl = h('div', { class: 'list', 'data-testid': 'list' });
  const search = h('input', {
    type: 'search',
    class: 'search',
    placeholder: t('col.search'),
    value: ui.query,
    'aria-label': t('col.search'),
    'data-testid': 'search',
    autocomplete: 'off',
    oninput: (event) => {
      ui.query = event.target.value;
      ui.shown = CATALOG_LIMIT;
      fillList(listEl);
    },
  });

  const tabs = [
    ['owned', `${t('col.owned')} (${counts.owned})`],
    ['wishlist', `${t('col.wishlist')} (${counts.wishlist})`],
    ['catalog', t('col.catalog')],
  ];
  wrap.append(
    h(
      'div',
      { class: 'seg', role: 'tablist' },
      tabs.map(([key, label]) =>
        h('button', { role: 'tab', 'aria-selected': String(ui.tab === key), class: ui.tab === key ? 'on' : '', 'data-tab': key, onclick: () => { ui.tab = key; render(); } }, label),
      ),
    ),
  );
  if (ui.tab === 'catalog') wrap.append(search);
  wrap.append(listEl);
  fillList(listEl);
  wrap.append(h('button', { class: 'btn link', 'data-testid': 'open-add', onclick: openAddDialog }, `+ ${t('col.custom')}`));
  return wrap;
}

// ---------------------------------------------------------------- İstatistik
function ring(total) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${t('stats.score')}: ${total}/100`);
  const mk = (cls, extra) => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', '60');
    c.setAttribute('cy', '60');
    c.setAttribute('r', String(radius));
    c.setAttribute('class', cls);
    for (const [k, v] of Object.entries(extra || {})) c.setAttribute(k, v);
    return c;
  };
  svg.append(mk('ring-bg'), mk('ring-fg', { 'stroke-dasharray': `${(total / 100) * circumference} ${circumference}`, transform: 'rotate(-90 60 60)' }));
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', '60');
  text.setAttribute('y', '68');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('class', 'ring-text');
  text.textContent = String(total);
  svg.append(text);
  return svg;
}

function heatmap(dates, today) {
  const counts = wearCountsByDate(dates);
  const todayNumber = parseIsoDate(today);
  const weekday = (todayNumber + 3) % 7; // 1970-01-01 Perşembe; Pazartesi = 0
  const start = todayNumber - weekday - 25 * 7;
  const cells = [];
  for (let i = 0; i < 26 * 7; i += 1) {
    const dayNumber = start + i;
    if (dayNumber > todayNumber) {
      cells.push(h('i', { class: 'cell future' }));
      continue;
    }
    const iso = formatIsoDate(dayNumber);
    const n = counts[iso] || 0;
    cells.push(h('i', { class: `cell l${Math.min(n, 3)}`, title: `${iso}: ${n}`, 'data-date': iso, 'data-count': String(n) }));
  }
  return h('div', { class: 'heat', role: 'img', 'aria-label': t('stats.heatmap') }, cells);
}

function viewStats() {
  const ctx = todayContext();
  const state = getState();
  const owned = ownedFragrances();
  const map = fragranceMap();
  const wrap = h('section', { class: 'view' });
  wrap.append(h('h1', null, t('stats.title')));

  if (owned.length === 0) {
    wrap.append(h('div', { class: 'card empty' }, h('p', null, t('stats.empty')), h('a', { class: 'btn primary', href: '#/collection' }, t('today.empty.cta'))));
  } else {
    const score = scentScore(owned);
    const tips = [
      ...score.gaps.uncoveredCells.map((c) => t('stats.tip.cell', { season: t(`season.${c.season}`), part: t(`part.${c.dayPart}`) })),
      ...score.gaps.missingOccasions.map((o) => t('stats.tip.occasion', { occasion: t(`occasion.${o}`) })),
    ];
    wrap.append(
      h(
        'div',
        { class: 'card score', 'data-testid': 'score' },
        h('div', { class: 'ringwrap' }, ring(score.total), h('div', { class: 'ringlabel' }, t('stats.score'))),
        score.provisional ? h('p', { class: 'note' }, t('stats.provisional')) : null,
        h(
          'div',
          { class: 'bars' },
          Object.entries(score.components).map(([key, value]) =>
            h('div', { class: 'bar' }, h('div', { class: 'barlabel' }, h('span', null, t(`stats.c.${key}`)), h('span', null, `${value}/25`)), h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${(value / 25) * 100}%` }))),
          ),
        ),
      ),
    );
    wrap.append(
      h('div', { class: 'card' }, h('h2', null, t('stats.tips')), tips.length ? h('ul', { class: 'tips' }, tips.slice(0, 6).map((tip) => h('li', null, tip))) : h('p', { class: 'muted' }, t('stats.tips.none'))),
    );
  }

  const streak = wearStreak(state.wears.map((w) => w.date), ctx.today);
  wrap.append(
    h(
      'div',
      { class: 'card', 'data-testid': 'streak' },
      h('h2', null, t('stats.streak')),
      h('div', { class: 'streakrow' }, h('div', null, h('b', null, streak.current), ` ${t('stats.days')}`, h('div', { class: 'muted' }, t('stats.current'))), h('div', null, h('b', null, streak.longest), ` ${t('stats.days')}`, h('div', { class: 'muted' }, t('stats.longest')))),
      h('h3', null, t('stats.heatmap')),
      heatmap(state.wears.map((w) => w.date), ctx.today),
    ),
  );

  const recent = [...state.wears].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 15);
  wrap.append(
    h(
      'div',
      { class: 'card' },
      h('h2', null, t('stats.history')),
      recent.length === 0
        ? h('p', { class: 'muted' }, t('stats.history.empty'))
        : h(
            'ul',
            { class: 'history' },
            recent
              .map((w) => ({ w, f: map.get(w.fragranceId) }))
              .filter((x) => x.f)
              .map(({ w, f }) =>
                h('li', null, h('span', null, `${w.date} · ${f.brand} ${f.name}`), h('button', { class: 'btn small danger', 'aria-label': t('col.remove'), onclick: () => update((s) => { s.wears = s.wears.filter((x) => x.id !== w.id); }) }, '✕')),
              ),
          ),
    ),
  );
  return wrap;
}

// ---------------------------------------------------------------- Profil
function viewProfile() {
  const state = getState();
  const loc = userLocation();
  const wrap = h('section', { class: 'view' });
  wrap.append(h('h1', null, t('profile.title')));
  if (!isStorageOk()) wrap.append(h('p', { class: 'error', role: 'alert' }, t('profile.storage.warn')));

  const status = h('p', { class: 'muted', role: 'status', 'data-testid': 'loc-status' }, loc.isDefault ? t('profile.location.none') : t('profile.location.ok'));
  const useLocation = () => {
    if (!('geolocation' in navigator)) return void (status.textContent = t('profile.location.fail'));
    status.textContent = t('profile.locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        update((s) => {
          s.profile.lat = lat;
          s.profile.lon = lon;
          s.profile.tz = effectiveTz();
        });
        ui.weather = null;
        ui.weatherKey = '';
        status.textContent = t('profile.location.ok');
        toast(t('toast.saved'));
      },
      () => {
        status.textContent = t('profile.location.fail');
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  wrap.append(
    h(
      'div',
      { class: 'card form' },
      h('label', null, t('profile.name'), h('input', { type: 'text', maxlength: '60', value: state.profile.name, 'data-testid': 'name', onchange: (e) => update((s) => { s.profile.name = e.target.value.trim().slice(0, 60); }) })),
      h(
        'label',
        null,
        t('profile.language'),
        h(
          'select',
          { 'data-testid': 'language', onchange: (e) => { update((s) => { s.profile.locale = e.target.value; }); setLocale(e.target.value); render(); } },
          h('option', { value: 'tr', selected: getLocale() === 'tr' }, 'Türkçe'),
          h('option', { value: 'en', selected: getLocale() === 'en' }, 'English'),
        ),
      ),
    ),
    h(
      'div',
      { class: 'card form' },
      h('h2', null, t('profile.location')),
      h('label', null, t('profile.city'), h('input', { type: 'text', maxlength: '120', value: state.profile.city, onchange: (e) => update((s) => { s.profile.city = e.target.value.trim().slice(0, 120); }) })),
      h('button', { class: 'btn', 'data-testid': 'use-location', onclick: useLocation }, t('profile.useLocation')),
      status,
    ),
  );

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    'data-testid': 'import-file',
    onchange: async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        if (typeof raw !== 'object' || raw === null || raw.v !== 1) throw new Error('bad');
        if (!confirm(t('profile.import.confirm'))) return;
        replaceAll(raw);
        setLocale(getState().profile.locale || detectLocale());
        toast(t('profile.import.ok'));
      } catch {
        toast(t('profile.import.bad'));
      }
    },
  });

  const ua = navigator.userAgent || '';
  const installText = /iPhone|iPad|iPod/i.test(ua) ? t('profile.install.ios') : t('profile.install.android');
  wrap.append(
    h(
      'div',
      { class: 'card form' },
      h('h2', null, t('profile.data')),
      h('p', { class: 'muted' }, t('profile.data.note')),
      h('button', { class: 'btn', 'data-testid': 'export', onclick: () => {
        const blob = new Blob([exportJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: `gonulmax-yedek-${localParts(new Date(), effectiveTz()).date}.json` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } }, t('profile.export')),
      h('button', { class: 'btn', onclick: () => fileInput.click() }, t('profile.import')),
      fileInput,
      h('button', { class: 'btn danger', 'data-testid': 'reset', onclick: () => {
        if (!confirm(t('profile.reset.confirm'))) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* yok say */ }
        replaceAll(null);
        ui.tab = 'owned';
        ui.query = '';
        setLocale(detectLocale());
      } }, t('profile.reset')),
    ),
    h('div', { class: 'card' }, h('h2', null, t('profile.install')), h('p', null, installText)),
    h('div', { class: 'card' }, h('h2', null, t('profile.about')), h('p', { class: 'muted' }, `${APP_NAME} · ${t('profile.about.text')}`)),
  );
  return wrap;
}

// ---------------------------------------------------------------- Karşılama
function viewOnboarding() {
  const name = h('input', { type: 'text', maxlength: '60', 'data-testid': 'onb-name', autocomplete: 'given-name' });
  const lang = h('select', { 'data-testid': 'onb-lang', onchange: (e) => { setLocale(e.target.value); render(); } }, h('option', { value: 'tr', selected: getLocale() === 'tr' }, 'Türkçe'), h('option', { value: 'en', selected: getLocale() === 'en' }, 'English'));
  return h(
    'section',
    { class: 'view onboarding' },
    h('div', { class: 'logo', 'aria-hidden': 'true' }, '◆'),
    h('h1', null, `${t('onb.title')}, ${APP_NAME}`),
    h('p', { class: 'muted' }, t('onb.lead')),
    h('label', null, t('onb.language'), lang),
    h('label', null, t('onb.name'), name),
    h('button', { class: 'btn primary big', 'data-testid': 'onb-start', onclick: () => {
      ui.tab = 'catalog';
      update((s) => {
        s.profile.name = name.value.trim().slice(0, 60);
        s.profile.locale = getLocale();
        s.profile.onboarded = true;
        s.profile.tz = effectiveTz();
      });
      window.location.hash = '#/collection';
    } }, t('onb.start')),
  );
}

// ---------------------------------------------------------------- Yönlendirme ve çizim
function currentRoute() {
  const name = (window.location.hash || '').replace(/^#\/?/, '');
  return ROUTES.includes(name) ? name : 'today';
}

function nav(route) {
  return h(
    'nav',
    { class: 'tabbar', 'aria-label': 'Main' },
    ROUTES.map((r) => h('a', { href: `#/${r}`, 'aria-current': r === route ? 'page' : null, 'data-nav': r }, svgIcon(ICONS[r]), h('span', null, t(`nav.${r}`)))),
  );
}

function render() {
  const state = getState();
  document.title = APP_NAME;
  root.replaceChildren();
  if (!state.profile.onboarded) {
    root.append(h('main', null, viewOnboarding()));
    return;
  }
  const route = currentRoute();
  const views = { today: viewToday, collection: viewCollection, stats: viewStats, profile: viewProfile };
  root.append(h('main', null, views[route]()), nav(route));
  if (route === 'today') ensureWeather();
}

function start() {
  load();
  setLocale(getState().profile.locale || detectLocale());
  subscribe(() => render());
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  render();
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimdışı önbellek olmadan da çalışır */ });
  }
}

start();
