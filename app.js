/* ==========================================================================
   Люмен — хранитель сумерек
   Игра-тамагочи на чистом JavaScript.
   ========================================================================== */

(() => {
  'use strict';

  // -------------------------------------------------------------------------
  // Константы
  // -------------------------------------------------------------------------

  const SAVE_KEY = 'lumen.save.v1';
  const SAVE_VERSION = 1;
  const TICK_MS = 1000;
  const OFFLINE_CAP_MIN = 480;      // 8 часов
  const OFFLINE_RATE = 0.4;         // офлайн-время идёт медленнее
  const HATCH_MS = 60_000;          // яйцо пробуждается через минуту
  const XP_TEEN = 12;
  const XP_ADULT = 35;
  const REVIVE_COST = 25;
  const GIFT_COOLDOWN = 4 * 60 * 60 * 1000;
  const GAME_LENGTH = 30;
  const GAME_COOLDOWN = 45_000;

  const ACTIONS = {
    feed: { cooldown: 15_000 },
    play: { cooldown: 40_000 },
    wash: { cooldown: 75_000 },
    heal: { cooldown: 150_000 },
  };

  const STAT_KEYS = ['satiety', 'mood', 'energy', 'purity', 'health'];

  const STAT_LABELS = {
    satiety: 'Сытость',
    mood: 'Настроение',
    energy: 'Энергия',
    purity: 'Чистота',
    health: 'Здоровье',
  };

  const FOODS = {
    pollen: {
      name: 'Лунная пыльца',
      icon: '✨',
      desc: '+10 сытости. Всегда под рукой.',
      satiety: 10,
      mood: 0,
      balance: 0,
      xp: 1,
      price: 0,
    },
    sunfruit: {
      name: 'Солнечный плод',
      icon: '🍑',
      desc: '+22 сытости, +5 настроения, +8 к свету.',
      satiety: 22,
      mood: 5,
      balance: 8,
      xp: 1,
      price: 12,
    },
    shadowberry: {
      name: 'Тёмная ягода',
      icon: '🫐',
      desc: '+22 сытости, +5 настроения, +8 к тени.',
      satiety: 22,
      mood: 5,
      balance: -8,
      xp: 1,
      price: 12,
    },
    nectar: {
      name: 'Нектар равновесия',
      icon: '🍯',
      desc: '+26 сытости, +8 настроения, выравнивает баланс.',
      satiety: 26,
      mood: 8,
      balanceCenter: 15,
      xp: 2,
      price: 20,
    },
  };

  const SHOP = [
    {
      id: 'sunfruit',
      type: 'food',
      name: 'Солнечный плод',
      icon: '🍑',
      desc: 'Тёплый плод. Тянет шкалу к свету.',
      price: 12,
    },
    {
      id: 'shadowberry',
      type: 'food',
      name: 'Тёмная ягода',
      icon: '🫐',
      desc: 'Прохладная ягода. Тянет шкалу к тени.',
      price: 12,
    },
    {
      id: 'nectar',
      type: 'food',
      name: 'Нектар равновесия',
      icon: '🍯',
      desc: 'Мягко возвращает баланс к середине.',
      price: 20,
    },
    {
      id: 'crystal',
      type: 'care',
      name: 'Кристалл чистоты',
      icon: '💎',
      desc: '+40 чистоты и немного света.',
      price: 10,
    },
    {
      id: 'tea',
      type: 'care',
      name: 'Звёздный чай',
      icon: '🍵',
      desc: '+30 энергии. Пить можно и не спя.',
      price: 15,
    },
    {
      id: 'moonball',
      type: 'care',
      name: 'Лунный мяч',
      icon: '🌕',
      desc: '+25 настроения, −5 энергии.',
      price: 18,
    },
    {
      id: 'revive',
      type: 'revive',
      name: 'Ритуал возвращения',
      icon: '🕯️',
      desc: 'Вернуть угасшего Люмена к жизни.',
      price: REVIVE_COST,
    },
  ];

  const STAGE_INFO = {
    egg: {
      badge: 'Яйцо',
      title: 'искра, которой ещё предстоит проснуться',
    },
    baby: {
      badge: 'Искра',
      title: 'маленький свет, который учится жить',
    },
    teen: {
      badge: 'Мерцающий',
      title: 'свет и тень уже спорят внутри',
    },
    adult: {
      badge: 'Взрослый',
      title: 'хранитель собственного равновесия',
    },
  };

  const FORMS = {
    twilight: { badge: 'Сумеречный', title: 'хранитель равновесия' },
    radiant: { badge: 'Сияющий', title: 'дитя полуденного света' },
    umbral: { badge: 'Теневой', title: 'тихий страж сумрака' },
    phoenix: { badge: 'Феникс', title: 'тот, кто вернулся из пепла' },
  };

  // -------------------------------------------------------------------------
  // Утилиты
  // -------------------------------------------------------------------------

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  const round = (value) => Math.round(value);
  const nowMs = () => Date.now();
  const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

  function isNight() {
    const hour = new Date().getHours();
    return hour < 7 || hour >= 19;
  }

  function formatDuration(minutes) {
    const mins = Math.max(0, Math.round(minutes));
    if (mins < 60) return `${mins} мин`;
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }

  function sanitizeName(raw) {
    const cleaned = String(raw || '')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
    return cleaned || 'Люмен';
  }

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--:--';
    }
  }

  // -------------------------------------------------------------------------
  // Состояние
  // -------------------------------------------------------------------------

  function defaultState() {
    const now = nowMs();
    return {
      version: SAVE_VERSION,
      name: 'Люмен',
      createdAt: now,
      hatchedAt: now,
      hatchAt: now + HATCH_MS,
      lastTick: now,
      lastSample: now,
      lastGift: now,
      stage: 'egg',
      form: 'twilight',
      stats: { satiety: 72, mood: 72, energy: 82, purity: 88, health: 100 },
      balance: 50,
      xp: 0,
      sparks: 30,
      sleeping: false,
      extinguished: false,
      revived: false,
      inventory: { sunfruit: 1, shadowberry: 1, nectar: 0 },
      cooldowns: { feed: 0, play: 0, wash: 0, heal: 0, game: 0, gift: 0 },
      balanceSum: 50,
      balanceSamples: 1,
      journal: [],
      warnings: {},
      settings: { sound: false },
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;

    const merged = {
      ...base,
      ...raw,
      version: SAVE_VERSION,
      stats: { ...base.stats, ...(raw.stats || {}) },
      inventory: { ...base.inventory, ...(raw.inventory || {}) },
      cooldowns: { ...base.cooldowns, ...(raw.cooldowns || {}) },
      settings: { ...base.settings, ...(raw.settings || {}) },
      warnings: raw.warnings && typeof raw.warnings === 'object' ? raw.warnings : {},
      journal: Array.isArray(raw.journal) ? raw.journal.slice(-60) : [],
    };

    for (const key of STAT_KEYS) {
      const value = Number(merged.stats[key]);
      merged.stats[key] = Number.isFinite(value) ? clamp(value) : base.stats[key];
    }

    merged.balance = clamp(Number(merged.balance) || 50);
    merged.sparks = Math.max(0, Math.floor(Number(merged.sparks) || 0));
    merged.xp = Math.max(0, Math.floor(Number(merged.xp) || 0));
    merged.name = sanitizeName(merged.name);

    if (!['egg', 'baby', 'teen', 'adult'].includes(merged.stage)) merged.stage = 'egg';
    if (!FORMS[merged.form]) merged.form = 'twilight';
    if (!Number.isFinite(merged.hatchAt)) merged.hatchAt = nowMs() + HATCH_MS;
    if (!Number.isFinite(merged.lastTick)) merged.lastTick = nowMs();
    if (!Number.isFinite(merged.lastSample)) merged.lastSample = nowMs();
    if (!Number.isFinite(merged.lastGift)) merged.lastGift = nowMs();
    if (!Number.isFinite(merged.balanceSum)) merged.balanceSum = merged.balance;
    if (!Number.isFinite(merged.balanceSamples) || merged.balanceSamples < 1) {
      merged.balanceSamples = 1;
      merged.balanceSum = merged.balance;
    }

    return merged;
  }

  let state = null;
  let firstRun = false;
  let lastSaveAt = 0;
  let journalDirty = true;

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      lastSaveAt = nowMs();
    } catch {
      /* приватный режим или переполнение — просто продолжаем без сохранения */
    }
  }

  function saveThrottled() {
    if (nowMs() - lastSaveAt > 10_000) save();
  }

  function load() {
    let raw = null;
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) raw = JSON.parse(stored);
    } catch {
      raw = null;
    }

    firstRun = !raw;
    state = normalizeState(raw);

    const elapsedMin = (nowMs() - state.lastTick) / 60_000;
    if (elapsedMin > 0.05) {
      applyElapsed(elapsedMin, { offline: elapsedMin > 2 });
      state.lastTick = nowMs();
      if (elapsedMin > 10 && state.stage !== 'egg') {
        toast(`Люмен ждал вас ${formatDuration(elapsedMin)}.`, 'info');
        logEvent(`Люмен ждал вас ${formatDuration(elapsedMin)}.`, 'info');
      }
    }

    checkHatch();
    if (state.extinguished) state.sleeping = false;
  }

  // -------------------------------------------------------------------------
  // Время и состояние
  // -------------------------------------------------------------------------

  function applyElapsed(minutes, { offline = false } = {}) {
    if (!state || state.stage === 'egg' || state.extinguished) return;

    const factor = offline ? OFFLINE_RATE : 1;
    const span = Math.min(minutes, offline ? OFFLINE_CAP_MIN : 15);
    if (!Number.isFinite(span) || span <= 0) return;

    const night = isNight();
    const s = state.stats;

    const satietyRate = state.sleeping ? 0.25 : 0.55;
    const moodRate = state.sleeping ? 0 : 0.35;
    const purityRate = state.sleeping ? 0.15 : 0.3;
    const energyRate = state.sleeping ? (night ? 4.2 : 3.2) : 0.3;

    s.satiety -= satietyRate * span * factor;
    s.mood -= moodRate * span * factor;
    s.purity -= purityRate * span * factor;
    s.energy += (state.sleeping ? energyRate : -energyRate) * span * factor;

    let damage = 0;
    if (s.satiety < 20) damage += 0.22;
    if (s.purity < 15) damage += 0.18;
    if (s.mood < 15) damage += 0.12;
    if (state.balance > 92 || state.balance < 8) damage += 0.08;

    if (damage > 0) {
      s.health -= damage * span * factor;
    } else if (s.satiety > 55 && s.purity > 55 && s.mood > 50) {
      s.health += 0.06 * span * factor;
    }

    const diff = 50 - state.balance;
    if (Math.abs(diff) > 0.01) {
      const drift = Math.min(Math.abs(diff), 0.03 * span * factor);
      state.balance += Math.sign(diff) * drift;
    }

    for (const key of STAT_KEYS) s[key] = clamp(s[key]);

    if (offline) s.health = Math.max(15, s.health);

    if (state.sleeping && s.energy >= 99) {
      state.sleeping = false;
      logEvent('Люмен выспался и проснулся сам.', 'good');
      toast('Люмен выспался и проснулся.', 'good');
    }

    if (s.health <= 0) extinguish();
  }

  function sampleBalance() {
    state.balanceSum += state.balance;
    state.balanceSamples += 1;
    state.lastSample = nowMs();
  }

  function shiftBalance(delta) {
    state.balance = clamp(state.balance + delta);
  }

  function centerBalance(amount) {
    const diff = 50 - state.balance;
    state.balance += Math.sign(diff) * Math.min(Math.abs(diff), amount);
  }

  function addSparks(amount) {
    state.sparks = Math.max(0, state.sparks + Math.round(amount));
  }

  function addXp(amount) {
    state.xp += Math.max(0, Math.round(amount));
    checkEvolution();
  }

  function checkHatch() {
    if (!state) return;
    if (state.stage === 'egg' && nowMs() >= state.hatchAt) hatchNow();
  }

  function hatchNow() {
    if (state.stage !== 'egg') return;
    const now = nowMs();
    state.stage = 'baby';
    state.hatchedAt = now;
    state.hatchAt = now;
    state.stats = { satiety: 70, mood: 70, energy: 80, purity: 90, health: 100 };
    state.balance = 50;
    addSparks(5);
    logEvent(`Из яйца появился ${state.name}. Начало пути.`, 'evolution');
    toast(`${state.name} проснулся!`, 'gold');
    evolveFlash();
    beep(660, 0.12, 'sine', 0.05);
    beep(880, 0.16, 'sine', 0.04);
    render();
    save();
  }

  function extinguish() {
    if (state.extinguished) return;
    state.extinguished = true;
    state.sleeping = false;
    state.stats.health = 0;
    logEvent(`${state.name} угас. Но свет ещё можно вернуть.`, 'warning');
    toast('Люмен угас. Соберите 25 искр для ритуала.', 'bad');
    beep(150, 0.5, 'sawtooth', 0.03);
    render();
    save();
  }

  function revive() {
    if (!state.extinguished) {
      toast('Люмен и так жив.', 'info');
      return;
    }
    if (state.sparks < REVIVE_COST) {
      toast(`Не хватает ${REVIVE_COST - state.sparks} искр. Сыграйте в звёздный дождь.`, 'bad');
      setTab('game');
      return;
    }

    state.sparks -= REVIVE_COST;
    state.extinguished = false;
    state.revived = true;
    state.sleeping = false;
    state.stats = { satiety: 40, mood: 40, energy: 50, purity: 50, health: 40 };
    state.balance = 50;
    state.warnings = {};
    if (state.stage === 'adult') state.form = 'phoenix';

    logEvent(`${state.name} вернулся из пепла.`, 'evolution');
    toast('Ритуал сработал. Люмен снова светится.', 'gold');
    evolveFlash();
    beep(520, 0.15, 'sine', 0.05);
    beep(780, 0.25, 'sine', 0.04);
    render();
    save();
  }

  // -------------------------------------------------------------------------
  // Действия
  // -------------------------------------------------------------------------

  function actionBlocked() {
    if (state.stage === 'egg') {
      toast('Яйцо ещё не проснулось.', 'info');
      return true;
    }
    if (state.extinguished) {
      toast('Сначала верните Люмена ритуалом.', 'bad');
      return true;
    }
    return false;
  }

  function coolingDown(key) {
    const until = state.cooldowns[key] || 0;
    if (until > nowMs()) {
      toast(`Ещё ${Math.ceil((until - nowMs()) / 1000)} с.`, 'info');
      return true;
    }
    return false;
  }

  function feed(foodId) {
    if (actionBlocked()) return;
    if (state.sleeping) {
      toast('Люмен спит. Сначала разбудите его.', 'info');
      return;
    }
    if (state.stats.satiety >= 95) {
      toast('Люмен сыт.', 'info');
      return;
    }
    if (coolingDown('feed')) return;

    const food = FOODS[foodId];
    if (!food) return;

    if (foodId !== 'pollen') {
      const count = state.inventory[foodId] || 0;
      if (count <= 0) {
        toast('Этого угощения нет в сумке.', 'bad');
        return;
      }
      state.inventory[foodId] = count - 1;
    }

    state.stats.satiety = clamp(state.stats.satiety + food.satiety);
    state.stats.mood = clamp(state.stats.mood + (food.mood || 0));
    if (food.balance) shiftBalance(food.balance);
    if (food.balanceCenter) centerBalance(food.balanceCenter);

    state.cooldowns.feed = nowMs() + ACTIONS.feed.cooldown;
    addXp(food.xp || 1);
    sampleBalance();

    toast(`${food.name}: Люмен довольно жуёт.`, 'good');
    beep(480, 0.08, 'triangle', 0.04);
    render();
    save();
  }

  function play() {
    if (actionBlocked()) return;
    if (state.sleeping) {
      toast('Люмен спит. Сначала разбудите его.', 'info');
      return;
    }
    if (state.stats.energy < 10) {
      toast('Люмен слишком устал для игр.', 'bad');
      return;
    }
    if (coolingDown('play')) return;

    state.stats.mood = clamp(state.stats.mood + 14);
    state.stats.energy = clamp(state.stats.energy - 5);
    state.stats.satiety = clamp(state.stats.satiety - 3);
    centerBalance(4);
    state.cooldowns.play = nowMs() + ACTIONS.play.cooldown;
    addXp(1);
    sampleBalance();

    toast(randomOf([
      'Люмен ловит собственный хвост из света.',
      'Вы играете в догонялки со звёздной пылью.',
      'Люмен довольно подпрыгивает.',
    ]), 'good');
    beep(620, 0.07, 'square', 0.03);
    render();
    save();
  }

  function wash() {
    if (actionBlocked()) return;
    if (state.sleeping) {
      toast('Люмен спит. Сначала разбудите его.', 'info');
      return;
    }
    if (state.stats.purity >= 95) {
      toast('Люмен и так сияет чистотой.', 'info');
      return;
    }
    if (coolingDown('wash')) return;

    state.stats.purity = clamp(state.stats.purity + 35);
    state.stats.mood = clamp(state.stats.mood + 4);
    state.stats.energy = clamp(state.stats.energy - 3);
    shiftBalance(3);
    state.cooldowns.wash = nowMs() + ACTIONS.wash.cooldown;
    addXp(1);
    sampleBalance();

    toast('Пыль смыта, шёрстка снова светится.', 'good');
    beep(700, 0.09, 'sine', 0.035);
    render();
    save();
  }

  function toggleSleep() {
    if (actionBlocked()) return;

    if (state.sleeping) {
      state.sleeping = false;
      logEvent('Люмен проснулся.', 'info');
      toast('Люмен проснулся.', 'info');
      beep(420, 0.08, 'sine', 0.03);
    } else {
      state.sleeping = true;
      logEvent('Люмен свернулся клубком и уснул.', 'info');
      toast('Люмен уснул. Энергия восстанавливается.', 'good');
      beep(300, 0.12, 'sine', 0.03);
    }
    render();
    save();
  }

  function heal() {
    if (actionBlocked()) return;
    if (state.sleeping) {
      toast('Люмен спит. Сначала разбудите его.', 'info');
      return;
    }
    if (state.stats.health >= 95) {
      toast('Люмен полностью здоров.', 'info');
      return;
    }
    if (coolingDown('heal')) return;

    state.stats.health = clamp(state.stats.health + 18);
    state.stats.energy = clamp(state.stats.energy - 5);
    state.cooldowns.heal = nowMs() + ACTIONS.heal.cooldown;
    addXp(1);
    sampleBalance();

    logEvent('Люмену стало лучше.', 'good');
    toast('Тёплый свет залечил царапины.', 'good');
    beep(540, 0.1, 'sine', 0.04);
    render();
    save();
  }

  function buy(itemId) {
    const item = SHOP.find((entry) => entry.id === itemId);
    if (!item) return;

    if (item.type === 'revive') {
      revive();
      return;
    }

    if (state.sparks < item.price) {
      toast(`Не хватает ${item.price - state.sparks} искр.`, 'bad');
      return;
    }

    if (state.stage === 'egg') {
      toast('Лавка откроется после пробуждения.', 'info');
      return;
    }

    state.sparks -= item.price;

    if (item.type === 'food') {
      state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
      toast(`Куплено: ${item.name}.`, 'good');
    } else {
      applyCareItem(item.id);
      toast(`${item.name} использован.`, 'good');
    }

    sampleBalance();
    beep(760, 0.07, 'triangle', 0.04);
    render();
    save();
  }

  function applyCareItem(id) {
    if (id === 'crystal') {
      state.stats.purity = clamp(state.stats.purity + 40);
      shiftBalance(3);
      addXp(1);
      logEvent('Кристалл чистоты растворился в воздухе.', 'good');
    } else if (id === 'tea') {
      state.stats.energy = clamp(state.stats.energy + 30);
      shiftBalance(2);
      addXp(1);
      logEvent('Люмен выпил звёздный чай и взбодрился.', 'good');
    } else if (id === 'moonball') {
      state.stats.mood = clamp(state.stats.mood + 25);
      state.stats.energy = clamp(state.stats.energy - 5);
      centerBalance(6);
      addXp(1);
      logEvent('Люмен поиграл с лунным мячом.', 'good');
    }
  }

  // -------------------------------------------------------------------------
  // Эволюция
  // -------------------------------------------------------------------------

  function checkEvolution() {
    if (!state) return;
    if (state.stage === 'baby' && state.xp >= XP_TEEN) evolve('teen');
    if (state.stage === 'teen' && state.xp >= XP_ADULT) evolve('adult');
  }

  function evolve(stage) {
    if (stage === 'teen') {
      state.stage = 'teen';
      state.stats.health = clamp(state.stats.health + 8);
      addSparks(8);
      logEvent(`${state.name} вырос до стадии «Мерцающий».`, 'evolution');
      toast('Люмен подрос! Новая стадия: Мерцающий.', 'gold');
    } else if (stage === 'adult') {
      const average = state.balanceSamples
        ? state.balanceSum / state.balanceSamples
        : state.balance;
      let form = 'twilight';
      if (state.revived) form = 'phoenix';
      else if (average >= 62) form = 'radiant';
      else if (average <= 38) form = 'umbral';

      state.stage = 'adult';
      state.form = form;
      state.stats.health = clamp(state.stats.health + 10);
      addSparks(15);

      const formInfo = FORMS[form];
      logEvent(`${state.name} выбрал форму: ${formInfo.badge}.`, 'evolution');
      toast(`Взрослая форма: ${formInfo.badge}!`, 'gold');
    } else {
      return;
    }

    evolveFlash();
    beep(600, 0.12, 'sine', 0.05);
    beep(900, 0.2, 'sine', 0.04);
    render();
    save();
  }

  function evolveFlash() {
    const wrap = $('#petWrap');
    if (!wrap) return;
    wrap.classList.remove('is-evolving');
    // Принудительный reflow, чтобы анимация запустилась повторно.
    void wrap.offsetWidth;
    wrap.classList.add('is-evolving');
    window.setTimeout(() => wrap.classList.remove('is-evolving'), 1400);
  }

  // -------------------------------------------------------------------------
  // Журнал и уведомления
  // -------------------------------------------------------------------------

  function logEvent(text, kind = 'info') {
    if (!state) return;
    state.journal.push({ t: nowMs(), text, kind });
    if (state.journal.length > 60) state.journal = state.journal.slice(-60);
    journalDirty = true;
  }

  function toast(text, kind = 'info') {
    const host = $('#toasts');
    if (!host) return;

    const el = document.createElement('div');
    el.className = `toast is-${kind}`;
    el.textContent = text;
    host.appendChild(el);

    while (host.children.length > 3) host.firstElementChild.remove();

    window.setTimeout(() => {
      el.classList.add('is-leaving');
      window.setTimeout(() => el.remove(), 280);
    }, 3200);
  }

  function maybeWarn(key, condition, text) {
    if (!condition) {
      delete state.warnings[key];
      return;
    }
    const last = state.warnings[key] || 0;
    if (nowMs() - last < 10 * 60 * 1000) return;
    state.warnings[key] = nowMs();
    logEvent(text, 'warning');
    toast(text, 'bad');
  }

  function checkWarnings() {
    if (!state || state.stage === 'egg' || state.extinguished) return;
    maybeWarn('hungry', state.stats.satiety < 20, 'Люмен голоден. Покормите его.');
    maybeWarn('dirty', state.stats.purity < 20, 'Люмен покрылся пылью. Пора помыть.');
    maybeWarn('sad', state.stats.mood < 20, 'Люмену одиноко. Поиграйте с ним.');
    maybeWarn('sick', state.stats.health < 30, 'Люмену плохо. Нужно лечение.');
    maybeWarn('tooLight', state.balance > 85, 'Слишком много света: Люмен не может усидеть на месте.');
    maybeWarn('tooDark', state.balance < 15, 'Тень сгущается. Добавьте Люмену света.');
  }

  function checkGift() {
    if (!state || state.stage === 'egg') return;
    if (nowMs() - state.lastGift < GIFT_COOLDOWN) return;
    state.lastGift = nowMs();
    addSparks(8);
    logEvent('Звёздный дар: +8 искр.', 'good');
    toast('Звёздный дар: +8 искр.', 'gold');
    beep(820, 0.1, 'sine', 0.04);
  }

  // -------------------------------------------------------------------------
  // Отрисовка интерфейса
  // -------------------------------------------------------------------------

  function render() {
    if (!state) return;
    renderHeader();
    renderStats();
    renderPet();
    renderBalance();
    renderActions();
    renderShopState();
    renderGameCooldown();
    if (journalDirty) {
      renderJournal();
      journalDirty = false;
    }
  }

  function renderHeader() {
    const sparks = $('#sparksValue');
    if (sparks) sparks.textContent = state.sparks;
    updatePhase();
  }

  function updatePhase() {
    const night = isNight();
    document.body.classList.toggle('is-night', night);
    document.body.classList.toggle('is-day', !night);

    const label = $('#phaseLabel');
    const icon = $('#phaseIcon');
    if (label) label.textContent = night ? 'Ночь' : 'День';
    if (icon) icon.textContent = night ? '☾' : '☀';

    const chip = $('#phaseChip');
    if (chip) chip.title = night
      ? 'Ночь: сон эффективнее, но энергии тратится меньше'
      : 'День: Люмен бодр, но быстрее устаёт';
  }

  function renderStats() {
    for (const key of STAT_KEYS) {
      const value = clamp(state.stats[key]);
      const valueEl = $(`#val${key[0].toUpperCase()}${key.slice(1)}`);
      const barEl = $(`#bar${key[0].toUpperCase()}${key.slice(1)}`);
      if (valueEl) valueEl.textContent = round(value);
      if (barEl) {
        barEl.style.width = `${value}%`;
        barEl.classList.toggle('is-low', value < 25);
        barEl.classList.toggle('is-mid', value >= 25 && value < 50);
        barEl.classList.toggle('is-good', value >= 70);
      }
    }

    const hint = $('#careHint');
    if (hint) {
      if (state.extinguished) hint.textContent = 'Нужен ритуал возвращения';
      else if (state.stage === 'egg') hint.textContent = 'Согрейте яйцо';
      else if (state.sleeping) hint.textContent = 'Сон восстанавливает силы';
      else if (state.stage === 'baby') hint.textContent = `Опыт ${state.xp} / ${XP_TEEN}`;
      else if (state.stage === 'teen') hint.textContent = `Опыт ${state.xp} / ${XP_ADULT}`;
      else hint.textContent = `Форма: ${FORMS[state.form].badge}`;
    }
  }

  function moodClass() {
    const s = state.stats;
    if (state.extinguished || state.stage === 'egg') return 'mood-neutral';
    if (s.mood < 35 || s.satiety < 25 || s.health < 35) return 'mood-sad';
    if (s.mood >= 65 && s.health >= 50 && s.satiety >= 40) return 'mood-happy';
    return 'mood-neutral';
  }

  function moodText() {
    if (state.extinguished) return 'Свет почти погас. Нужен ритуал возвращения.';
    if (state.stage === 'egg') return 'Яйцо тихо светится в темноте.';
    if (state.sleeping) return 'Люмен спит, свернувшись клубком света.';

    const s = state.stats;
    if (s.health < 30) return 'Люмену плохо. Нужна забота и лечение.';
    if (s.satiety < 25) return 'Люмен голоден и поглядывает на звёзды.';
    if (s.purity < 25) return 'Шёрстка потускнела от пыли.';
    if (s.energy < 20) return 'Люмен зевает и клонится ко сну.';
    if (s.mood < 30) return 'Люмену одиноко. Поиграйте с ним.';
    if (state.balance > 82) return 'Слишком много света — Люмен не может усидеть на месте.';
    if (state.balance < 18) return 'Тень сгущается, Люмен стал тихим.';

    if (state.stage === 'adult') {
      return randomOf([
        'Люмен уверенно держит собственное равновесие.',
        'Взрослый Люмен спокойно смотрит на звёзды.',
        'Кажется, Люмен доволен тем, кем стал.',
      ]);
    }

    return randomOf([
      'Люмен довольно мерцает.',
      'Кажется, сегодня хороший день.',
      'Люмен ловит звёздную пыль.',
      'Тихий свет дрожит у самого сердца.',
    ]);
  }

  function stageBadgeText() {
    if (state.stage === 'adult') return FORMS[state.form].badge;
    return STAGE_INFO[state.stage].badge;
  }

  function stageTitleText() {
    if (state.stage === 'adult') return FORMS[state.form].title;
    return STAGE_INFO[state.stage].title;
  }

  function renderPet() {
    const wrap = $('#petWrap');
    if (!wrap) return;

    const classes = [
      'is-egg', 'is-sleeping', 'is-sick', 'is-sad', 'is-extinguished',
      'mood-happy', 'mood-neutral', 'mood-sad',
      'stage-baby', 'stage-teen', 'stage-adult',
      'form-twilight', 'form-radiant', 'form-umbral', 'form-phoenix',
    ];
    wrap.classList.remove(...classes);

    wrap.classList.add(moodClass());
    if (state.stage === 'egg') wrap.classList.add('is-egg');
    if (state.sleeping) wrap.classList.add('is-sleeping');
    if (state.extinguished) wrap.classList.add('is-extinguished');
    if (state.stats.health < 35 || state.stats.purity < 20) wrap.classList.add('is-sick');
    if (state.stats.mood < 35 || state.stats.satiety < 25) wrap.classList.add('is-sad');
    if (state.stage !== 'egg') wrap.classList.add(`stage-${state.stage}`);
    if (state.stage === 'adult') wrap.classList.add(`form-${state.form}`);

    const nameEl = $('#petName');
    if (nameEl) nameEl.textContent = state.name;

    const svgTitle = $('#petSvgTitle');
    if (svgTitle) svgTitle.textContent = state.name;

    const badge = $('#stageBadge');
    if (badge) badge.textContent = stageBadgeText();

    const title = $('#petTitle');
    if (title) title.textContent = stageTitleText();

    const mood = $('#petMood');
    if (mood) mood.textContent = moodText();

    const age = $('#stageAge');
    if (age) {
      if (state.stage === 'egg') {
        const seconds = Math.max(0, Math.ceil((state.hatchAt - nowMs()) / 1000));
        age.textContent = `пробуждение через ${seconds} с`;
      } else {
        const minutes = Math.max(0, Math.floor((nowMs() - state.hatchedAt) / 60_000));
        age.textContent = `возраст ${minutes} мин`;
      }
    }
  }

  function balanceLabelText() {
    const value = state.balance;
    if (value < 20) return 'Глубокий сумрак';
    if (value < 40) return 'Сумрак';
    if (value <= 60) return 'Равновесие';
    if (value <= 80) return 'Сияние';
    return 'Сверхсвет';
  }

  function renderBalance() {
    const marker = $('#balanceMarker');
    if (marker) marker.style.left = `${clamp(state.balance)}%`;

    const label = $('#balanceLabel');
    if (label) label.textContent = balanceLabelText();
  }

  function cooldownLeft(key) {
    return Math.max(0, (state.cooldowns[key] || 0) - nowMs());
  }

  function setCooldown(button, element, key) {
    if (!button || !element) return;
    const left = cooldownLeft(key);
    if (left > 0) {
      element.hidden = false;
      element.textContent = `${Math.ceil(left / 1000)}с`;
      button.disabled = true;
    } else {
      element.hidden = true;
      element.textContent = '';
    }
  }

  function renderActions() {
    const feedBtn = $('#btnFeed');
    const playBtn = $('#btnPlay');
    const washBtn = $('#btnWash');
    const sleepBtn = $('#btnSleep');
    const healBtn = $('#btnHeal');
    const hatchBtn = $('#btnHatch');
    const reviveBtn = $('#btnRevive');

    const blocked = state.stage === 'egg' || state.extinguished;
    const sleeping = state.sleeping;

    if (feedBtn) feedBtn.disabled = blocked || sleeping || state.stats.satiety >= 95;
    if (playBtn) playBtn.disabled = blocked || sleeping || state.stats.energy < 10;
    if (washBtn) washBtn.disabled = blocked || sleeping || state.stats.purity >= 95;
    if (sleepBtn) sleepBtn.disabled = blocked;
    if (healBtn) healBtn.disabled = blocked || sleeping || state.stats.health >= 95;

    setCooldown(feedBtn, $('#cdFeed'), 'feed');
    setCooldown(playBtn, $('#cdPlay'), 'play');
    setCooldown(washBtn, $('#cdWash'), 'wash');
    setCooldown(healBtn, $('#cdHeal'), 'heal');

    if (feedBtn && state.cooldowns.feed > nowMs()) feedBtn.disabled = true;

    const feedHint = $('#feedHint');
    if (feedHint) {
      const total = Object.values(state.inventory).reduce((sum, count) => sum + (Number(count) || 0), 0);
      feedHint.textContent = total > 0 ? `Еда: ${total}` : 'Пыльца';
    }

    if (sleepBtn) {
      const label = sleepBtn.querySelector('strong');
      const hint = sleepBtn.querySelector('small');
      if (label) label.textContent = sleeping ? 'Разбудить' : 'Спать';
      if (hint) hint.textContent = sleeping ? 'Проснуться' : 'Энергия';
    }

    if (hatchBtn) {
      hatchBtn.hidden = state.stage !== 'egg';
      if (state.stage === 'egg') {
        const seconds = Math.max(0, Math.ceil((state.hatchAt - nowMs()) / 1000));
        hatchBtn.textContent = `✦ Поторопить пробуждение · ${seconds} с`;
      }
    }

    if (reviveBtn) {
      reviveBtn.hidden = !state.extinguished;
      reviveBtn.disabled = state.sparks < REVIVE_COST;
      reviveBtn.textContent = state.sparks >= REVIVE_COST
        ? `✦ Провести ритуал возвращения · ${REVIVE_COST} искр`
        : `✦ Нужно ${REVIVE_COST - state.sparks} искр · играть`;
    }
  }

  // -------------------------------------------------------------------------
  // Лавка
  // -------------------------------------------------------------------------

  let shopBuilt = false;

  function buildShop() {
    const grid = $('#shopGrid');
    if (!grid || shopBuilt) return;
    shopBuilt = true;

    for (const item of SHOP) {
      const card = document.createElement('div');
      card.className = 'shop-item';
      card.dataset.item = item.id;

      const top = document.createElement('div');
      top.className = 'shop-item-top';

      const icon = document.createElement('span');
      icon.className = 'shop-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = item.icon;

      const name = document.createElement('span');
      name.className = 'shop-name';
      name.textContent = item.name;

      top.append(icon, name);

      const desc = document.createElement('p');
      desc.className = 'shop-desc';
      desc.textContent = item.desc;

      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'shop-buy';
      buy.dataset.buy = item.id;

      const label = document.createElement('span');
      label.textContent = item.type === 'food' ? 'Купить' : item.type === 'revive' ? 'Ритуал' : 'Применить';

      const price = document.createElement('span');
      price.className = 'shop-price';
      price.textContent = `✦ ${item.price}`;

      buy.append(label, price);
      buy.addEventListener('click', () => buy(item.id));

      const owned = document.createElement('span');
      owned.className = 'shop-owned';
      owned.dataset.owned = item.id;

      card.append(top, desc, buy, owned);
      grid.appendChild(card);
    }
  }

  function renderShopState() {
    for (const item of SHOP) {
      const buy = $(`[data-buy="${item.id}"]`);
      const owned = $(`[data-owned="${item.id}"]`);

      if (buy) {
        if (item.type === 'revive') {
          buy.disabled = !state.extinguished || state.sparks < item.price;
        } else {
          buy.disabled = state.sparks < item.price || state.stage === 'egg';
        }
      }

      if (owned) {
        if (item.type === 'food') {
          const count = state.inventory[item.id] || 0;
          owned.textContent = count > 0 ? `в сумке: ${count}` : '';
        } else if (item.type === 'revive') {
          owned.textContent = state.extinguished ? 'доступно' : 'только при угасании';
        } else {
          owned.textContent = '';
        }
      }
    }
  }

  function renderFoodList() {
    const list = $('#foodList');
    if (!list) return;
    list.textContent = '';

    for (const [id, food] of Object.entries(FOODS)) {
      const count = id === 'pollen' ? Infinity : (state.inventory[id] || 0);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'food-item';
      button.disabled = count <= 0 || state.stats.satiety >= 95;

      const icon = document.createElement('span');
      icon.className = 'food-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = food.icon;

      const body = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'food-name';
      name.textContent = food.name;
      const desc = document.createElement('span');
      desc.className = 'food-desc';
      desc.textContent = food.desc;
      body.append(name, document.createElement('br'), desc);

      const badge = document.createElement('span');
      badge.className = 'food-count';
      badge.textContent = id === 'pollen' ? '∞' : count;

      button.append(icon, body, badge);
      button.addEventListener('click', () => {
        feed(id);
        closeModal($('#foodModal'));
      });

      list.appendChild(button);
    }
  }

  // -------------------------------------------------------------------------
  // Дневник
  // -------------------------------------------------------------------------

  function renderJournal() {
    const list = $('#journalList');
    if (!list) return;
    list.textContent = '';

    if (!state.journal.length) {
      const empty = document.createElement('li');
      empty.className = 'journal-empty';
      empty.textContent = 'Пока тихо. Позаботьтесь о Люмене — и здесь появятся записи.';
      list.appendChild(empty);
      return;
    }

    const entries = state.journal.slice(-40).reverse();
    for (const entry of entries) {
      const item = document.createElement('li');
      item.className = `journal-item kind-${entry.kind || 'info'}`;

      const time = document.createElement('span');
      time.className = 'journal-time';
      time.textContent = formatTime(entry.t);

      const text = document.createElement('span');
      text.className = 'journal-text';
      text.textContent = entry.text;

      item.append(time, text);
      list.appendChild(item);
    }
  }

  // -------------------------------------------------------------------------
  // Мини-игра «Звёздный дождь»
  // -------------------------------------------------------------------------

  const game = {
    active: false,
    paused: false,
    raf: 0,
    lastTs: 0,
    remaining: GAME_LENGTH,
    score: 0,
    sparks: 0,
    xp: 0,
    balanceShift: 0,
    stars: [],
    particles: [],
    bgStars: [],
    basketX: 320,
    keys: { left: false, right: false },
    spawnTimer: 0,
    ctx: null,
    canvas: null,
    width: 640,
    height: 360,
  };

  const BASKET = { width: 92, height: 16, y: 330, speed: 460 };

  function initGameCanvas() {
    const canvas = $('#gameCanvas');
    if (!canvas) return;
    game.canvas = canvas;
    game.ctx = canvas.getContext('2d');

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = game.width * dpr;
    canvas.height = game.height * dpr;
    game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    game.bgStars = Array.from({ length: 34 }, () => ({
      x: Math.random() * game.width,
      y: Math.random() * game.height * 0.8,
      r: 0.6 + Math.random() * 1.6,
      a: 0.2 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    }));

    drawGame();
  }

  function startGame() {
    if (game.active) return;

    if (state.stage === 'egg') {
      toast('Сначала дождитесь пробуждения.', 'info');
      return;
    }
    if (state.extinguished) {
      toast('Сначала верните Люмена.', 'bad');
      return;
    }
    if (state.sleeping) {
      toast('Люмен спит. Разбудите его перед игрой.', 'info');
      return;
    }

    const left = cooldownLeft('game');
    if (left > 0) {
      toast(`Следующий дождь через ${Math.ceil(left / 1000)} с.`, 'info');
      renderGameCooldown();
      return;
    }

    game.active = true;
    game.paused = false;
    game.remaining = GAME_LENGTH;
    game.score = 0;
    game.sparks = 0;
    game.xp = 0;
    game.balanceShift = 0;
    game.stars = [];
    game.particles = [];
    game.basketX = game.width / 2;
    game.spawnTimer = 0.2;
    game.lastTs = 0;
    game.keys.left = false;
    game.keys.right = false;

    $('#gameOverlay').classList.add('is-hidden');
    updateGameHud();
    beep(720, 0.1, 'sine', 0.04);

    cancelAnimationFrame(game.raf);
    game.raf = requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    if (!game.active) return;

    if (!game.lastTs) game.lastTs = timestamp;
    let dt = (timestamp - game.lastTs) / 1000;
    game.lastTs = timestamp;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;

    game.remaining -= dt;
    if (game.remaining <= 0) {
      game.remaining = 0;
      endGame();
      return;
    }

    updateGame(dt);
    drawGame();
    updateGameHud();

    game.raf = requestAnimationFrame(gameLoop);
  }

  function updateGame(dt) {
    if (game.keys.left) game.basketX -= BASKET.speed * dt;
    if (game.keys.right) game.basketX += BASKET.speed * dt;
    game.basketX = Math.max(BASKET.width / 2 + 6, Math.min(game.width - BASKET.width / 2 - 6, game.basketX));

    const elapsed = GAME_LENGTH - game.remaining;
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnStar(elapsed);
      game.spawnTimer = Math.max(0.26, 0.58 - elapsed * 0.009) + Math.random() * 0.16;
    }

    for (const star of game.stars) {
      star.y += star.vy * dt;
      star.rot += star.vr * dt;
    }

    for (let i = game.stars.length - 1; i >= 0; i -= 1) {
      const star = game.stars[i];
      if (star.y - star.r > game.height + 10) {
        game.stars.splice(i, 1);
        continue;
      }
      const withinX = Math.abs(star.x - game.basketX) <= BASKET.width / 2 + star.r * 0.5;
      const withinY = star.y + star.r >= BASKET.y - 4 && star.y - star.r <= BASKET.y + BASKET.height;
      if (withinX && withinY) {
        catchStar(star, i);
      }
    }

    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const p = game.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
  }

  function spawnStar(elapsed) {
    const roll = Math.random();
    let type = 'light';
    if (roll > 0.9) type = 'white';
    else if (roll > 0.55) type = 'shadow';

    const radius = type === 'white' ? 8 : 9.5;
    game.stars.push({
      x: 24 + Math.random() * (game.width - 48),
      y: -20,
      vy: 78 + elapsed * 2.1 + Math.random() * 42,
      r: radius,
      type,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 2.2,
    });
  }

  function catchStar(star, index) {
    game.stars.splice(index, 1);
    game.score += star.type === 'white' ? 2 : 1;
    game.sparks += star.type === 'white' ? 3 : 1;
    game.xp += star.type === 'white' ? 2 : 1;
    if (star.type === 'light') game.balanceShift += 1.2;
    if (star.type === 'shadow') game.balanceShift -= 1.2;

    const color = star.type === 'light' ? '#ffd479' : star.type === 'shadow' ? '#b39dff' : '#ffffff';
    for (let i = 0; i < 7; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 90;
      game.particles.push({
        x: star.x,
        y: star.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color,
      });
    }

    beep(star.type === 'white' ? 980 : star.type === 'light' ? 820 : 520, 0.06, 'sine', 0.03);
  }

  function endGame() {
    if (!game.active) return;
    game.active = false;
    cancelAnimationFrame(game.raf);
    game.raf = 0;

    addSparks(game.sparks);
    addXp(game.xp);
    if (game.balanceShift) shiftBalance(game.balanceShift);
    sampleBalance();

    state.cooldowns.game = nowMs() + GAME_COOLDOWN;

    const balanceWord = game.balanceShift > 0 ? 'к свету' : game.balanceShift < 0 ? 'к тени' : 'без сдвига';
    logEvent(
      `Звёздный дождь: ${game.score} очков, +${game.sparks} искр, баланс ${balanceWord}.`,
      'good'
    );
    toast(`Дождь окончен: +${game.sparks} искр.`, 'gold');

    const overlay = $('#gameOverlay');
    if (overlay) {
      overlay.classList.remove('is-hidden');
      $('#gameOverlayTitle').textContent = 'Дождь закончился';
      $('#gameOverlayText').textContent =
        `Очки: ${game.score} · Искры: +${game.sparks} · Опыт: +${game.xp}` +
        (game.balanceShift ? ` · Баланс: ${game.balanceShift > 0 ? '+' : ''}${game.balanceShift.toFixed(1)}` : '');
    }

    render();
    renderGameCooldown();
    save();
  }

  function renderGameCooldown() {
    const button = $('#gameStart');
    const note = $('#gameCooldown');
    if (!button) return;

    const left = cooldownLeft('game');

    if (game.active) {
      button.disabled = true;
      button.textContent = 'Игра идёт';
      if (note) note.textContent = 'Управление: мышь, палец или стрелки ← →.';
      return;
    }

    if (left > 0) {
      button.disabled = true;
      button.textContent = `Подождите ${Math.ceil(left / 1000)} с`;
      if (note) note.textContent = `Следующий звёздный дождь через ${Math.ceil(left / 1000)} с.`;
    } else {
      button.disabled = false;
      button.textContent = 'Начать';
      if (note) note.textContent = 'Одна игра — 30 секунд. Искры и опыт начисляются сразу.';
    }
  }

  function updateGameHud() {
    const score = $('#gameScore');
    const time = $('#gameTime');
    if (score) score.textContent = game.score;
    if (time) time.textContent = Math.max(0, Math.ceil(game.remaining));
  }

  function drawGame() {
    const ctx = game.ctx;
    if (!ctx) return;

    const { width, height } = game;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0b0820');
    gradient.addColorStop(0.55, '#151033');
    gradient.addColorStop(1, '#080612');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const time = performance.now() / 1000;
    for (const star of game.bgStars) {
      const alpha = star.a * (0.6 + 0.4 * Math.sin(time * 1.6 + star.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Лёгкое северное сияние
    const glow = ctx.createRadialGradient(width * 0.5, height * 0.95, 10, width * 0.5, height * 0.95, width * 0.65);
    glow.addColorStop(0, 'rgba(140, 110, 255, 0.16)');
    glow.addColorStop(1, 'rgba(140, 110, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const p of game.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const star of game.stars) {
      const color = star.type === 'light' ? '#ffd479' : star.type === 'shadow' ? '#b39dff' : '#ffffff';
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.rotate(star.rot);
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = color;
      pathStar(ctx, 0, 0, star.r, star.r * 0.44);
      ctx.fill();
      ctx.restore();
    }

    // Чаша
    ctx.save();
    ctx.shadowColor = 'rgba(255, 212, 121, 0.55)';
    ctx.shadowBlur = 18;
    const bx = game.basketX - BASKET.width / 2;
    const by = BASKET.y;
    const basketGradient = ctx.createLinearGradient(bx, by, bx, by + BASKET.height);
    basketGradient.addColorStop(0, '#ffe6a8');
    basketGradient.addColorStop(1, '#c58b3f');
    ctx.fillStyle = basketGradient;
    pathRoundRect(ctx, bx, by, BASKET.width, BASKET.height, 8);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillRect(bx + 8, by + 2, BASKET.width - 16, 2);

    if (!game.active && game.remaining === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '600 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Дождь закончился', width / 2, height / 2);
    }
  }

  function pathStar(ctx, cx, cy, outer, inner, points = 5) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function pathRoundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  // -------------------------------------------------------------------------
  // Звук
  // -------------------------------------------------------------------------

  let audioContext = null;

  function beep(frequency = 440, duration = 0.08, type = 'sine', gain = 0.04) {
    if (!state || !state.settings.sound) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume();

      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      /* звук не критичен */
    }
  }

  function toggleSound() {
    state.settings.sound = !state.settings.sound;
    const button = $('#soundBtn');
    if (button) {
      button.setAttribute('aria-pressed', String(state.settings.sound));
      button.setAttribute('aria-label', state.settings.sound ? 'Выключить звук' : 'Включить звук');
      button.title = state.settings.sound ? 'Звук включён' : 'Звук выключен';
    }
    if (state.settings.sound) beep(660, 0.08, 'sine', 0.04);
    save();
  }

  // -------------------------------------------------------------------------
  // Вкладки и модальные окна
  // -------------------------------------------------------------------------

  function setTab(name) {
    if (game.active && name !== 'game') endGame();

    $$('.tab').forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    $$('.panel').forEach((panel) => {
      const active = panel.id === `panel${name[0].toUpperCase()}${name.slice(1)}`;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });

    if (name === 'game') {
      renderGameCooldown();
      drawGame();
    }
    if (name === 'journal') {
      journalDirty = true;
      renderJournal();
    }
  }

  function openModal(modal, focusSelector) {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    const target = focusSelector ? $(focusSelector, modal) : modal.querySelector('button, input');
    if (target) window.setTimeout(() => target.focus(), 60);
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function initModals() {
    $('#nameConfirm')?.addEventListener('click', () => {
      const input = $('#nameInput');
      state.name = sanitizeName(input ? input.value : '');
      if (input) input.value = state.name;

      if (firstRun) {
        state.hatchAt = nowMs() + HATCH_MS;
        state.createdAt = nowMs();
        state.hatchedAt = nowMs();
        logEvent(`В темноте появилось тёплое яйцо. Будущий Люмен получил имя ${state.name}.`, 'good');
        toast(`Добро пожаловать, ${state.name}!`, 'gold');
        firstRun = false;
      } else {
        logEvent(`Люмена теперь зовут ${state.name}.`, 'info');
      }

      closeModal($('#nameModal'));
      render();
      save();
    });

    $('#nameInput')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        $('#nameConfirm')?.click();
      }
    });

    $('#foodClose')?.addEventListener('click', () => closeModal($('#foodModal')));
    $('#resetCancel')?.addEventListener('click', () => closeModal($('#resetModal')));

    $('#resetConfirm')?.addEventListener('click', () => {
      closeModal($('#resetModal'));
      hardReset();
    });

    $$('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (event) => {
        if (event.target !== backdrop) return;
        if (backdrop.id === 'nameModal') return;
        closeModal(backdrop);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      $$('.modal-backdrop.is-open').forEach((modal) => {
        if (modal.id !== 'nameModal') closeModal(modal);
      });
    });
  }

  function hardReset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ничего */
    }

    state = defaultState();
    firstRun = true;
    journalDirty = true;
    shopBuilt = false;

    const grid = $('#shopGrid');
    if (grid) grid.textContent = '';
    buildShop();

    const input = $('#nameInput');
    if (input) input.value = 'Люмен';

    setTab('shop');
    render();
    openModal($('#nameModal'), '#nameInput');
    save();
  }

  // -------------------------------------------------------------------------
  // События
  // -------------------------------------------------------------------------

  function bindEvents() {
    $('#btnFeed')?.addEventListener('click', () => {
      if (actionBlocked()) return;
      if (state.sleeping) {
        toast('Люмен спит. Сначала разбудите его.', 'info');
        return;
      }
      if (state.stats.satiety >= 95) {
        toast('Люмен сыт.', 'info');
        return;
      }
      renderFoodList();
      openModal($('#foodModal'), '.food-item:not(:disabled)');
    });

    $('#btnPlay')?.addEventListener('click', play);
    $('#btnWash')?.addEventListener('click', wash);
    $('#btnSleep')?.addEventListener('click', toggleSleep);
    $('#btnHeal')?.addEventListener('click', heal);
    $('#btnRevive')?.addEventListener('click', revive);

    $('#btnHatch')?.addEventListener('click', () => {
      if (state.stage !== 'egg') return;
      state.hatchAt -= 12_000;
      if (state.hatchAt <= nowMs()) {
        hatchNow();
      } else {
        const seconds = Math.max(0, Math.ceil((state.hatchAt - nowMs()) / 1000));
        toast(`Пробуждение ближе: ${seconds} с.`, 'info');
        render();
        save();
      }
    });

    $('#soundBtn')?.addEventListener('click', toggleSound);
    $('#resetBtn')?.addEventListener('click', () => openModal($('#resetModal'), '#resetCancel'));

    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => setTab(tab.dataset.tab));
    });

    $('#gameStart')?.addEventListener('click', startGame);

    const canvas = $('#gameCanvas');
    canvas?.addEventListener('pointermove', (event) => {
      if (!game.active) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      game.basketX = clamp(((event.clientX - rect.left) / rect.width) * game.width, 46, game.width - 46);
    });

    canvas?.addEventListener('pointerdown', (event) => {
      if (!game.active) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      game.basketX = clamp(((event.clientX - rect.left) / rect.width) * game.width, 46, game.width - 46);
    });

    document.addEventListener('keydown', (event) => {
      if (!game.active) return;
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'ф', 'Ф'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A' || event.key === 'ф' || event.key === 'Ф') {
          game.keys.left = true;
        } else {
          game.keys.right = true;
        }
      }
    });

    document.addEventListener('keyup', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A' || event.key === 'ф' || event.key === 'Ф') {
        game.keys.left = false;
      }
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D' || event.key === 'в' || event.key === 'В') {
        game.keys.right = false;
      }
    });

    // Поддержка русской раскладки для D
    document.addEventListener('keydown', (event) => {
      if (!game.active) return;
      if (event.key === 'd' || event.key === 'D' || event.key === 'в' || event.key === 'В') {
        event.preventDefault();
        game.keys.right = true;
      }
    });

    document.addEventListener('visibilitychange', () => {
      game.lastTs = 0;
      if (document.hidden) save();
    });

    window.addEventListener('beforeunload', save);
  }

  // -------------------------------------------------------------------------
  // Главный цикл
  // -------------------------------------------------------------------------

  function tick() {
    if (!state) return;
    const now = nowMs();
    const elapsedMin = (now - state.lastTick) / 60_000;

    if (elapsedMin > 0) {
      applyElapsed(elapsedMin, { offline: elapsedMin > 2 });
      state.lastTick = now;
    }

    if (now - state.lastSample > 5 * 60 * 1000) sampleBalance();

    checkHatch();
    checkGift();
    checkWarnings();

    render();
    saveThrottled();
  }

  // -------------------------------------------------------------------------
  // Запуск
  // -------------------------------------------------------------------------

  function init() {
    load();
    buildShop();
    initGameCanvas();
    bindEvents();
    initModals();

    const soundBtn = $('#soundBtn');
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', String(state.settings.sound));
      soundBtn.setAttribute('aria-label', state.settings.sound ? 'Выключить звук' : 'Включить звук');
      soundBtn.title = state.settings.sound ? 'Звук включён' : 'Звук выключен';
    }

    render();
    drawGame();

    if (firstRun) {
      openModal($('#nameModal'), '#nameInput');
    } else {
      toast(`С возвращением. ${state.name} ждал вас.`, 'info');
    }

    window.setInterval(tick, TICK_MS);
  }

  // Отладочный интерфейс для любопытных и для тестов.
  window.__lumen = {
    state: () => state,
    save,
    addSparks: (amount) => {
      addSparks(Number(amount) || 0);
      render();
      save();
    },
    setStat: (key, value) => {
      if (STAT_KEYS.includes(key)) {
        state.stats[key] = clamp(Number(value) || 0);
        render();
        save();
      }
    },
    setBalance: (value) => {
      state.balance = clamp(Number(value) || 0);
      render();
      save();
    },
    advance: (minutes) => {
      applyElapsed(Number(minutes) || 0, { offline: false });
      state.lastTick = nowMs();
      render();
      save();
    },
    evolve: () => {
      state.xp = Math.max(state.xp, XP_ADULT);
      checkEvolution();
      render();
      save();
    },
    hatch: () => hatchNow(),
    reset: () => hardReset(),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
