/*
  Behavior for the food search screen.
  1. Live search: typing in the search box filters the food grid by name,
     and shows an empty-state message when nothing matches.
  2. Favorites: tapping the heart on a card toggles it as a favorite
     and saves the list in localStorage so it persists between visits.
     Tapping the "รายการโปรด" pill shows only favorited cards.
  3. History: tapping any card records it as "recently viewed" (max 8,
     newest first) in localStorage. Tapping the "ประวัติ" pill shows
     only recently viewed cards, in that order.
  Both pills act as toggles: tap again (or use search) to go back
  to the full grid.
*/

(() => {
  const searchInput = document.getElementById('searchInput');
  const historyBtn = document.getElementById('historyBtn');
  const favoritesBtn = document.getElementById('favoritesBtn');
  const emptyState = document.getElementById('emptyState');
  const grid = document.getElementById('foodGrid');
  const cards = Array.from(grid.querySelectorAll('.food-card'));

  const STORAGE_KEYS = {
    favorites: 'foodApp.favorites',
    history: 'foodApp.history',
  };

  const loadList = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveList = (key, list) => {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* storage unavailable (e.g. private browsing) — fail silently */
    }
  };

  let favorites = new Set(loadList(STORAGE_KEYS.favorites));
  let history = loadList(STORAGE_KEYS.history);

  let activeMode = null; // null | 'history' | 'favorites'

  function getRestrictionIds(mode, favoriteIds, historyIds) {
    if (mode === 'favorites') {
      return new Set(favoriteIds);
    }

    if (mode === 'history') {
      return new Set(historyIds);
    }

    return null;
  }

  function getVisibleCardIds(cardData, query, restrictToIds) {
    const normalizedQuery = query.trim().toLowerCase();

    return new Set(
      cardData
        .filter((card) => {
          const matchesQuery = !normalizedQuery || card.name.toLowerCase().includes(normalizedQuery);
          const matchesMode = !restrictToIds || restrictToIds.has(card.id);
          return matchesQuery && matchesMode;
        })
        .map((card) => card.id)
    );
  }

  // ---- Favorites -------------------------------------------------

  function applyFavoriteStyles() {
    cards.forEach((card) => {
      const id = card.dataset.id;
      const btn = card.querySelector('.fav-btn');
      const isFav = favorites.has(id);
      btn.classList.toggle('is-active', isFav);
      btn.setAttribute('aria-pressed', String(isFav));
      btn.setAttribute(
        'aria-label',
        isFav ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'
      );
    });
  }

  function toggleFavorite(id) {
    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.add(id);
    }
    saveList(STORAGE_KEYS.favorites, Array.from(favorites));
    applyFavoriteStyles();
    if (activeMode === 'favorites') {
      renderMode();
    }
  }

  // ---- History ------------------------------------------------------

  function recordHistory(id) {
    history = [id, ...history.filter((h) => h !== id)].slice(0, 8);
    saveList(STORAGE_KEYS.history, history);
  }

  // ---- Rendering modes (history / favorites / all) -------------------

  function renderMode() {
    let visibleIds = null; // null = follow search only

    if (activeMode === 'favorites') {
      visibleIds = new Set(favorites);
    } else if (activeMode === 'history') {
      visibleIds = new Set(history);
    }

    applySearchAndVisibility(visibleIds);

    // When showing history, order the cards by recency.
    if (activeMode === 'history') {
      history.forEach((id) => {
        const card = cards.find((c) => c.dataset.id === id);
        if (card) grid.appendChild(card);
      });
    }
  }

  function setMode(mode) {
    activeMode = activeMode === mode ? null : mode;

    historyBtn.classList.toggle('is-active', activeMode === 'history');
    historyBtn.setAttribute('aria-pressed', String(activeMode === 'history'));

    favoritesBtn.classList.toggle('is-active', activeMode === 'favorites');
    favoritesBtn.setAttribute('aria-pressed', String(activeMode === 'favorites'));

    renderMode();
  }

  // ---- Search + combined visibility ----------------------------------

  function applySearchAndVisibility(restrictToIds) {
    const cardData = cards.map((card) => ({
      id: card.dataset.id,
      name: card.dataset.name,
    }));
    const visibleIds = getVisibleCardIds(cardData, searchInput.value, restrictToIds);

    cards.forEach((card) => {
      const visible = visibleIds.has(card.dataset.id);

      card.classList.toggle('is-hidden', !visible);
    });

    emptyState.hidden = visibleIds.size !== 0;
  }

  function handleSearchInput() {
    const restrictToIds = getRestrictionIds(activeMode, favorites, history);
    applySearchAndVisibility(restrictToIds);
  }

  // ---- Wire up events --------------------------------------------------

  searchInput.addEventListener('input', handleSearchInput);

  historyBtn.addEventListener('click', () => setMode('history'));
  favoritesBtn.addEventListener('click', () => setMode('favorites'));

  cards.forEach((card) => {
    const favBtn = card.querySelector('.fav-btn');

    favBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(card.dataset.id);
    });

    card.addEventListener('click', () => {
      recordHistory(card.dataset.id);
    });

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        recordHistory(card.dataset.id);
      }
    });
  });

  // ---- Initial paint -----------------------------------------------------

  applyFavoriteStyles();
  applySearchAndVisibility(null);
})();
