(function() {
  const lightBg = 'images/backgrounds/bg_bloom_garden_light.png';
  const darkBg = 'images/backgrounds/bg_bloom_garden_dark.png';

  const bgLayer1 = document.getElementById('bgLayer1');
  const bgLayer2 = document.getElementById('bgLayer2');
  const themeToggle = document.getElementById('themeToggle');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const html = document.documentElement;

  let activeLayer = bgLayer1;
  let inactiveLayer = bgLayer2;

  if (bgLayer1) bgLayer1.classList.add('active');

  function applyBackground(url) {
    if (!inactiveLayer || !activeLayer) return;
    inactiveLayer.style.backgroundImage = `url('${url}')`;
    inactiveLayer.classList.add('active');
    activeLayer.classList.remove('active');
    [activeLayer, inactiveLayer] = [inactiveLayer, activeLayer];
  }

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    const brandImg = document.getElementById('topbarBrandImg');
    if (theme === 'dark') {
      if (themeToggleIcon) themeToggleIcon.src = 'images/theme_icons/theme_moon.png';
      if (brandImg) brandImg.src = 'images/logo/garden_logo_dark.png';
      applyBackground(darkBg);
    } else {
      if (themeToggleIcon) themeToggleIcon.src = 'images/theme_icons/theme_sun.png';
      if (brandImg) brandImg.src = 'images/logo/garden_logo_light.png';
      applyBackground(lightBg);
    }
    try { localStorage.setItem('garden_theme', theme); } catch(e) {}
  }

  try {
    const saved = localStorage.getItem('garden_theme');
    if (saved === 'dark') setTheme('dark');
  } catch(e) {}

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const cur = html.getAttribute('data-theme');
      setTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }

  const tabItems = document.querySelectorAll('.tab-item');
  const tabContents = document.querySelectorAll('.tab-content');

  function switchTab(tabName) {
    tabItems.forEach(t => {
      if (t.dataset.tab === tabName) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    tabContents.forEach(c => {
      if (c.id === `tab-${tabName}`) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabItems.forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
    });
  });

  document.querySelectorAll('[data-jump]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
      const target = card.dataset.jump;
      if (target) switchTab(target);
    });
  });

  function setupHorizontalScroll(scrollAreaId, leftBtnId, rightBtnId, sliderThumbId, scrollAmount) {
    const scrollArea = document.getElementById(scrollAreaId);
    const leftBtn = document.getElementById(leftBtnId);
    const rightBtn = document.getElementById(rightBtnId);
    const sliderThumb = document.getElementById(sliderThumbId);
    if (!scrollArea) return null;

    const sliderTrack = sliderThumb ? sliderThumb.parentElement : null;

    function updateSlider() {
      if (!sliderThumb) return;
      const max = scrollArea.scrollWidth - scrollArea.clientWidth;
      if (max <= 0) {
        sliderThumb.style.width = '100%';
        sliderThumb.style.left = '0';
        return;
      }
      const ratio = scrollArea.scrollLeft / max;
      const visibleRatio = scrollArea.clientWidth / scrollArea.scrollWidth;
      sliderThumb.style.width = (visibleRatio * 100) + '%';
      sliderThumb.style.left = (ratio * (100 - visibleRatio * 100)) + '%';
    }

    if (leftBtn) {
      leftBtn.addEventListener('click', () => {
        scrollArea.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      });
    }
    if (rightBtn) {
      rightBtn.addEventListener('click', () => {
        scrollArea.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      });
    }
    scrollArea.addEventListener('scroll', updateSlider);
    window.addEventListener('resize', updateSlider);
    setTimeout(updateSlider, 100);

    if (sliderThumb && sliderTrack) {
      let isDragging = false;
      let dragStartX = 0;
      let dragStartScrollLeft = 0;

      function onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartScrollLeft = scrollArea.scrollLeft;
        sliderTrack.classList.add('dragging');
        e.preventDefault();
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        const trackRect = sliderTrack.getBoundingClientRect();
        const trackWidth = trackRect.width;
        const thumbWidth = sliderThumb.getBoundingClientRect().width;
        const movableWidth = trackWidth - thumbWidth;
        if (movableWidth <= 0) return;
        const deltaX = e.clientX - dragStartX;
        const maxScroll = scrollArea.scrollWidth - scrollArea.clientWidth;
        const scrollDelta = (deltaX / movableWidth) * maxScroll;
        scrollArea.scrollLeft = dragStartScrollLeft + scrollDelta;
      }

      function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;
        sliderTrack.classList.remove('dragging');
      }

      sliderThumb.addEventListener('mousedown', onPointerDown);
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);

      sliderThumb.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        onPointerDown({ clientX: touch.clientX, button: 0, preventDefault: () => e.preventDefault() });
      }, { passive: false });
      document.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        onPointerMove({ clientX: touch.clientX });
      }, { passive: true });
      document.addEventListener('touchend', onPointerUp);
      document.addEventListener('touchcancel', onPointerUp);
    }

    return updateSlider;
  }

  const divUpdate = setupHorizontalScroll('divScrollArea', 'divLeftBtn', 'divRightBtn', 'divSliderThumb', 240);
  const decUpdate = setupHorizontalScroll('decScrollArea', 'decLeftBtn', 'decRightBtn', 'decSliderThumb', 520);

  tabItems.forEach(item => {
    item.addEventListener('click', () => {
      setTimeout(() => {
        if (divUpdate) divUpdate();
        if (decUpdate) decUpdate();
      }, 50);
    });
  });

  document.querySelectorAll('.priority-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('.priority-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('.reports-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('.reports-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('.decision-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  const ACTIVITY_COLLAPSE_KEY = 'garden_activity_collapsed';
  const activityToggle = document.getElementById('activityToggle');
  const body = document.body;

  function applyActivityState(collapsed) {
    if (collapsed) {
      body.classList.add('activity-collapsed');
      if (activityToggle) activityToggle.setAttribute('aria-expanded', 'false');
    } else {
      body.classList.remove('activity-collapsed');
      if (activityToggle) activityToggle.setAttribute('aria-expanded', 'true');
    }
  }

  try {
    const savedCollapsed = localStorage.getItem(ACTIVITY_COLLAPSE_KEY) === '1';
    applyActivityState(savedCollapsed);
  } catch (e) {
    applyActivityState(false);
  }

  if (activityToggle) {
    activityToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = body.classList.contains('activity-collapsed');
      const next = !isCollapsed;
      applyActivityState(next);
      try {
        localStorage.setItem(ACTIVITY_COLLAPSE_KEY, next ? '1' : '0');
      } catch (e) {}
    });
  }

  const userArea = document.getElementById('userArea');
  const userDropdown = document.getElementById('userDropdown');

  function closeUserDropdown() {
    if (userArea) userArea.classList.remove('is-open');
    if (userDropdown) userDropdown.setAttribute('aria-hidden', 'true');
  }

  function openUserDropdown() {
    if (userArea) userArea.classList.add('is-open');
    if (userDropdown) userDropdown.setAttribute('aria-hidden', 'false');
  }

  function toggleUserDropdown() {
    if (!userArea) return;
    if (userArea.classList.contains('is-open')) {
      closeUserDropdown();
    } else {
      openUserDropdown();
    }
  }

  if (userArea) {
    userArea.addEventListener('click', (e) => {
      if (userDropdown && userDropdown.contains(e.target)) return;
      e.stopPropagation();
      toggleUserDropdown();
    });

    userArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (userDropdown && userDropdown.contains(e.target)) return;
        e.preventDefault();
        toggleUserDropdown();
      } else if (e.key === 'Escape') {
        closeUserDropdown();
        userArea.focus();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!userArea) return;
    if (!userArea.contains(e.target)) {
      closeUserDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUserDropdown();
  });

  const FAV_KEY = 'garden_favorites';
  const pageFavBtn = document.getElementById('pageFavoriteBtn');
  const pageFavToast = document.getElementById('pageFavoriteToast');

  const headerFavWrap = document.getElementById('headerFavoriteWrap');
  const headerFavBtn = document.getElementById('favoriteHeaderBtn');
  const favDropdown = document.getElementById('favoriteDropdown');
  const favDropdownList = document.getElementById('favoriteDropdownList');
  const favDropdownEmpty = document.getElementById('favoriteDropdownEmpty');
  const favDropdownCount = document.getElementById('favoriteDropdownCount');
  const favDropdownAdd = document.getElementById('favoriteDropdownAdd');
  const favDropdownToast = document.getElementById('favoriteDropdownToast');

  const MSG_ADDED = 'お気に入りに追加しました';
  const MSG_REMOVED = 'お気に入りを解除しました';

  function getCurrentPageInfo() {
    const titleEl = document.querySelector('.page-title');
    const titleText = titleEl ? titleEl.childNodes[0].nodeValue.trim() : document.title;
    return {
      title: titleText,
      url: location.pathname + location.search + location.hash,
      icon: 'images/icons_bloom/orb_bloom.png',
      addedAt: Date.now()
    };
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(list) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function isCurrentPageFavorited() {
    const list = loadFavorites();
    const current = getCurrentPageInfo();
    return list.some(item => item.url === current.url);
  }

  const _toastTimers = new WeakMap();
  function showToast(toastEl, message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    const prev = _toastTimers.get(toastEl);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 1800);
    _toastTimers.set(toastEl, t);
  }

  function showPageFavToast(message) {
    showToast(pageFavToast, message);
  }

  function showHeaderFavToast(message) {
    showToast(favDropdownToast, message);
  }

  function applyPageFavState(isFav) {
    if (!pageFavBtn) return;
    pageFavBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    pageFavBtn.title = isFav ? 'お気に入りから外す' : 'このページをお気に入りに追加';
  }

  function renderFavoriteDropdown() {
    if (!favDropdown || !favDropdownList) return;
    const list = loadFavorites();
    favDropdownList.innerHTML = '';

    if (favDropdownCount) favDropdownCount.textContent = String(list.length);

    if (list.length === 0) {
      favDropdown.classList.remove('has-items');
    } else {
      favDropdown.classList.add('has-items');
      list.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'favorite-dropdown-item';
        row.setAttribute('role', 'menuitem');
        row.dataset.url = item.url || '';
        row.dataset.idx = String(idx);

        const iconWrap = document.createElement('span');
        iconWrap.className = 'favorite-dropdown-item-icon';
        const iconImg = document.createElement('img');
        iconImg.src = item.icon || 'images/icons_bloom/orb_bloom.png';
        iconImg.alt = '';
        iconImg.onerror = function() {
          this.style.display = 'none';
        };
        iconWrap.appendChild(iconImg);

        const label = document.createElement('span');
        label.className = 'favorite-dropdown-item-label';
        label.textContent = item.title || '(無題)';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'favorite-dropdown-item-remove';
        removeBtn.title = 'お気に入りから外す';
        removeBtn.setAttribute('aria-label', 'お気に入りから外す');
        removeBtn.textContent = '×';

        row.appendChild(iconWrap);
        row.appendChild(label);
        row.appendChild(removeBtn);
        favDropdownList.appendChild(row);
      });
    }

    if (favDropdownAdd) {
      const isFavd = isCurrentPageFavorited();
      if (isFavd) {
        favDropdownAdd.classList.add('is-disabled');
        favDropdownAdd.setAttribute('aria-disabled', 'true');
        favDropdownAdd.title = 'このページは既にお気に入り登録済みです';
      } else {
        favDropdownAdd.classList.remove('is-disabled');
        favDropdownAdd.removeAttribute('aria-disabled');
        favDropdownAdd.title = '現在のページをお気に入りに追加';
      }
    }
  }

  function openHeaderFavDropdown() {
    if (!headerFavWrap || !favDropdown) return;
    closeUserDropdown();
    headerFavWrap.classList.add('is-open');
    favDropdown.setAttribute('aria-hidden', 'false');
    if (headerFavBtn) headerFavBtn.setAttribute('aria-expanded', 'true');
    renderFavoriteDropdown();
  }

  function closeHeaderFavDropdown() {
    if (!headerFavWrap || !favDropdown) return;
    headerFavWrap.classList.remove('is-open');
    favDropdown.setAttribute('aria-hidden', 'true');
    if (headerFavBtn) headerFavBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleHeaderFavDropdown() {
    if (!headerFavWrap) return;
    if (headerFavWrap.classList.contains('is-open')) {
      closeHeaderFavDropdown();
    } else {
      openHeaderFavDropdown();
    }
  }

  const _origCloseUserDropdown = closeUserDropdown;
  const _origOpenUserDropdown = openUserDropdown;

  if (headerFavBtn) {
    headerFavBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHeaderFavDropdown();
    });
  }

  if (favDropdown) {
    favDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (favDropdownList) {
    favDropdownList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.favorite-dropdown-item-remove');
      const itemRow = e.target.closest('.favorite-dropdown-item');
      if (!itemRow) return;

      if (removeBtn) {
        e.stopPropagation();
        const idx = parseInt(itemRow.dataset.idx, 10);
        const list = loadFavorites();
        if (Number.isFinite(idx) && idx >= 0 && idx < list.length) {
          const removedUrl = list[idx].url;
          list.splice(idx, 1);
          saveFavorites(list);
          renderFavoriteDropdown();
          const current = getCurrentPageInfo();
          if (removedUrl === current.url) {
            applyPageFavState(false);
          }
          showHeaderFavToast(MSG_REMOVED);
        }
        return;
      }

      const url = itemRow.dataset.url;
      if (url) {
        closeHeaderFavDropdown();
        if (url === (location.pathname + location.search + location.hash)) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          location.href = url;
        }
      }
    });
  }

  if (favDropdownAdd) {
    favDropdownAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      if (favDropdownAdd.classList.contains('is-disabled')) return;
      const list = loadFavorites();
      const current = getCurrentPageInfo();
      const exists = list.some(item => item.url === current.url);
      if (exists) return;
      list.push(current);
      saveFavorites(list);
      applyPageFavState(true);
      renderFavoriteDropdown();
      showHeaderFavToast(MSG_ADDED);
    });
  }

  document.addEventListener('click', (e) => {
    if (!headerFavWrap) return;
    if (!headerFavWrap.contains(e.target)) {
      closeHeaderFavDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHeaderFavDropdown();
  });

  if (pageFavBtn) {
    applyPageFavState(isCurrentPageFavorited());

    pageFavBtn.addEventListener('click', () => {
      const list = loadFavorites();
      const current = getCurrentPageInfo();
      const idx = list.findIndex(item => item.url === current.url);

      if (idx >= 0) {
        list.splice(idx, 1);
        saveFavorites(list);
        applyPageFavState(false);
        showPageFavToast(MSG_REMOVED);
      } else {
        list.push(current);
        saveFavorites(list);
        applyPageFavState(true);
        showPageFavToast(MSG_ADDED);
      }

      if (headerFavWrap && headerFavWrap.classList.contains('is-open')) {
        renderFavoriteDropdown();
      }
    });
  }

  renderFavoriteDropdown();

  const NAV_PAGES_KEY = 'garden_nav_pages_collapsed';
  const navPagesToggle = document.getElementById('navPagesToggle');
  const sidebarDual = document.getElementById('sidebarDual');
  const bodyEl = document.body;

  function applyNavPagesState(isCollapsed) {
    if (isCollapsed) {
      bodyEl.classList.add('nav-pages-collapsed');
    } else {
      bodyEl.classList.remove('nav-pages-collapsed');
    }
    if (navPagesToggle) {
      navPagesToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      navPagesToggle.title = isCollapsed ? 'メニュー名を表示' : 'メニュー名を非表示';
    }
  }

  try {
    const savedNav = localStorage.getItem(NAV_PAGES_KEY);
    applyNavPagesState(savedNav === '1');
  } catch (e) {
    applyNavPagesState(false);
  }

  if (navPagesToggle) {
    navPagesToggle.addEventListener('click', () => {
      const isCollapsed = bodyEl.classList.contains('nav-pages-collapsed');
      const next = !isCollapsed;
      applyNavPagesState(next);
      try {
        localStorage.setItem(NAV_PAGES_KEY, next ? '1' : '0');
      } catch (e) {}
    });
  }

  const navAppItems = document.querySelectorAll('.nav-app-item');
  const CURRENT_APP = 'bloom';
  navAppItems.forEach(el => {
    if (el.dataset.app === CURRENT_APP) {
      el.classList.add('is-current');
    }
  });

  navAppItems.forEach(el => {
    el.addEventListener('click', (e) => {
      const status = el.dataset.status;
      const app = el.dataset.app;
      if (status === 'todo' || status === 'concept' || status === 'dev') {
        e.preventDefault();
        showHeaderFavToast('「' + (el.title || app) + '」は準備中です');
      }
    });
  });

})();
