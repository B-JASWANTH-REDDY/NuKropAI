
/* ═════════════════ REVERSIBLE ACTIONS & UNDO TOAST NOTIFICATION ═════════════════ */
function showLuxuryToastWithUndo(message, onUndo, type = 'info', duration = 6000) {
  if (!message) return;
  let toastContainer = document.getElementById('nukrop-luxury-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'nukrop-luxury-toast-container';
    toastContainer.style.cssText = 'position:fixed;top:calc(var(--sat, 52px) + 12px);left:50%;transform:translateX(-50%);z-index:999999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:90%;max-width:390px;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  let bg = 'linear-gradient(135deg, #0F172A, #1E293B)';
  let border = 'rgba(255,255,255,0.15)';
  let icon = '🔔';
  let textColor = '#F8FAFC';

  if (type === 'success') {
    bg = 'linear-gradient(135deg, #14532D, #16A34A)';
    border = '#4ADE80';
    icon = '✅';
  } else if (type === 'error') {
    bg = 'linear-gradient(135deg, #7F1D1D, #DC2626)';
    border = '#F87171';
    icon = '⚠️';
  } else if (type === 'warning') {
    bg = 'linear-gradient(135deg, #78350F, #D97706)';
    border = '#FBBF24';
    icon = '⚡';
  } else if (type === 'info') {
    bg = 'linear-gradient(135deg, #0C4A6E, #0284C7)';
    border = '#38BDF8';
    icon = 'ℹ️';
  }

  toast.style.cssText = `pointer-events:auto;background:${bg};color:${textColor};border:1.5px solid ${border};border-radius:999px;padding:8px 14px 8px 18px;box-shadow:0 10px 30px -4px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2);font-size:13px;font-weight:700;letter-spacing:0.01em;display:inline-flex;align-items:center;gap:10px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);opacity:0;transform:translateY(-16px) scale(0.96);transition:all 260ms cubic-bezier(0.16,1,0.3,1);max-width:100%;word-break:break-word;`;
  toast.innerHTML = `<span style="font-size:15px;flex-shrink:0;">${icon}</span><span style="flex:1;">${message}</span>`;

  if (typeof onUndo === 'function') {
    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'UNDO';
    undoBtn.style.cssText = 'background:#FFFFFF;color:#0F172A;border:none;border-radius:100px;padding:5px 12px;font-size:11px;font-weight:900;letter-spacing:0.5px;cursor:pointer;margin-left:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);min-height:30px;min-width:54px;touch-action:manipulation;';
    undoBtn.onclick = (e) => {
      e.stopPropagation();
      try { onUndo(); } catch(err) { console.warn('Undo callback failed:', err); }
      dismiss();
    };
    toast.appendChild(undoBtn);
  }

  toastContainer.appendChild(toast);

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0) scale(1)';
    });
  } else {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  }

  let dismissTimer = setTimeout(dismiss, duration);

  function dismiss() {
    clearTimeout(dismissTimer);
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px) scale(0.95)';
    setTimeout(() => {
      toast.remove();
      if (toastContainer && toastContainer.children && toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 280);
  }
}
window.showLuxuryToastWithUndo = showLuxuryToastWithUndo;

/* ═════════════════ IDEMPOTENCY KEY GENERATOR ═════════════════ */
function generateIdempotencyKey(prefix = 'nk') {
  const time = Date.now().toString(36);
  const rand = (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(36).substring(2, 10);
  return `${prefix}_${time}_${rand}`;
}
window.generateIdempotencyKey = generateIdempotencyKey;

/* ═════════════════ STALE-WHILE-REVALIDATE (SWR) DATA ENGINE ═════════════════ */
const NuKropSWR = {
  _cache: new Map(),
  _getUserScope() {
    try {
      const uid = (typeof getCurrentUserId === 'function' ? getCurrentUserId() : '') || 
                  localStorage.getItem('nukrop_user_uuid') || 
                  localStorage.getItem('nukrop_supabase_uid') || 
                  'anon';
      const role = (typeof authUserRole !== 'undefined' ? authUserRole : '') || 
                   localStorage.getItem('nukrop_user_role') || 
                   'farmer';
      return `${uid}_${role}`;
    } catch(e) {
      return 'anon_farmer';
    }
  },
  _resolveKey(key, isShared = false) {
    if (isShared) return `shared_${key}`;
    return `usr_${this._getUserScope()}_${key}`;
  },
  get(key, fetcher, onFresh, ttlMs = 180000, isShared = false) {
    const scopedKey = this._resolveKey(key, isShared);
    let cached = this._cache.get(scopedKey);
    if (!cached) {
      try {
        const stored = localStorage.getItem('nk_swr_' + scopedKey);
        if (stored) cached = JSON.parse(stored);
      } catch(e) {}
    }
    const now = Date.now();
    const isStale = !cached || (now - (cached.timestamp || 0)) > ttlMs;

    if (cached && typeof onFresh === 'function') {
      try { onFresh(cached.data, true); } catch(err) { console.warn('SWR cached callback error:', err); }
    }

    if (typeof fetcher === 'function' && isStale) {
      Promise.resolve(fetcher()).then(freshData => {
        if (freshData !== undefined && freshData !== null) {
          const record = { data: freshData, timestamp: Date.now() };
          this._cache.set(scopedKey, record);
          try { localStorage.setItem('nk_swr_' + scopedKey, JSON.stringify(record)); } catch(e) {}
          if (typeof onFresh === 'function') {
            try { onFresh(freshData, false); } catch(err) { console.warn('SWR fresh callback error:', err); }
          }
        }
      }).catch(err => {
        console.warn('[NuKropSWR] Revalidation error for ' + key + ':', err && err.message);
      });
    }
    return cached ? cached.data : null;
  },
  invalidate(key, isShared = false) {
    const scopedKey = key ? this._resolveKey(key, isShared) : '';
    for (const k of this._cache.keys()) {
      if (!scopedKey || k.startsWith(scopedKey) || (key && k.includes(key))) this._cache.delete(k);
    }
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('nk_swr_' + scopedKey) || (key && k.includes(key)))) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
  },
  invalidateUserCache() {
    const userScope = this._getUserScope();
    for (const k of this._cache.keys()) {
      if (k.startsWith(`usr_${userScope}`) || k.startsWith('usr_')) this._cache.delete(k);
    }
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(`nk_swr_usr_${userScope}`) || k.startsWith('nk_swr_usr_'))) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
  }
};
window.NuKropSWR = NuKropSWR;

/* ═════════════════ UNIVERSAL 5-STATE COMPONENT RENDERER ═════════════════ */
function renderAgrarianStateCard(stateType, options = {}) {
  const title = options.title || '';
  const subtitle = options.subtitle || '';
  const icon = options.icon || '🌾';
  const actionText = options.actionText || '';
  const onAction = options.onAction || '';
  const skeletonHtml = options.skeletonHtml || '';

  switch (stateType) {
    case 'loading':
      return '<div class="agrarian-state-loading agrarian-loading-state">' + (skeletonHtml || (typeof renderMandiPricesSkeleton === 'function' ? renderMandiPricesSkeleton() : '<div class="skeleton-shimmer" style="height:120px;border-radius:18px;"></div>')) + '</div>';

    case 'empty':
      return '<div class="agrarian-state-empty agrarian-empty-state squircle-card" style="background:#FFFFFF;border:1.5px dashed #CBD5E1;border-radius:22px;padding:36px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;margin:16px 0;box-shadow:0 2px 8px rgba(0,0,0,0.02);">' +
          '<div style="width:64px;height:64px;border-radius:50%;background:#F0FDF4;border:2px solid #86EFAC;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 14px rgba(16,185,129,0.15);">' + icon + '</div>' +
          '<div style="font-size:16px;font-weight:900;color:#0F172A;letter-spacing:-0.2px;text-wrap:balance;">' + (title || 'No Records Available') + '</div>' +
          '<div style="font-size:12.5px;color:#64748B;font-weight:600;max-width:280px;line-height:1.45;text-wrap:balance;">' + (subtitle || 'Start recording your agricultural operations to view verified real-time insights.') + '</div>' +
          (actionText ? '<button onclick="' + onAction + '" class="shiny-btn action-btn-green" style="margin-top:6px;min-height:44px;padding:10px 20px;border-radius:100px;font-size:13px;font-weight:800;touch-action:manipulation;cursor:pointer;">' + actionText + '</button>' : '') +
        '</div>';

    case 'error':
      return '<div class="agrarian-state-error agrarian-error-state squircle-card" style="background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:22px;padding:24px 18px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;margin:16px 0;">' +
          '<div style="font-size:32px;">⚠️</div>' +
          '<div style="font-size:15px;font-weight:900;color:#991B1B;text-wrap:balance;">' + (title || 'Live Cloud Sync Interrupted') + '</div>' +
          '<div style="font-size:12px;color:#B91C1C;font-weight:600;line-height:1.4;text-wrap:balance;">' + (subtitle || 'Could not reach server. Verified on-device records remain safely accessible.') + '</div>' +
          (actionText ? '<button onclick="' + onAction + '" style="margin-top:4px;min-height:44px;padding:10px 22px;background:#DC2626;color:#FFFFFF;border:none;border-radius:100px;font-size:13px;font-weight:900;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 12px rgba(220,38,38,0.3);">' + actionText + '</button>' : '') +
        '</div>';

    case 'offline':
      return '<div class="agrarian-state-offline agrarian-offline-state squircle-card" style="background:#FFFBEB;border:1.5px solid #FCD34D;border-radius:20px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin:12px 0;">' +
          '<span style="font-size:24px;flex-shrink:0;">📡</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:900;color:#92400E;">' + (title || 'Offline Mode Active') + '</div>' +
            '<div style="font-size:11px;color:#B45309;font-weight:600;">' + (subtitle || 'Displaying verified on-device cache. Changes will queue and sync when online.') + '</div>' +
          '</div>' +
          (actionText ? '<button onclick="' + onAction + '" style="min-height:36px;padding:6px 12px;background:#D97706;color:#FFFFFF;border:none;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;">' + actionText + '</button>' : '') +
        '</div>';

    case 'success':
      return '<div class="agrarian-state-success agrarian-success-state squircle-card" style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:20px;padding:16px 18px;display:flex;align-items:center;gap:12px;margin:12px 0;">' +
          '<div style="width:40px;height:40px;border-radius:50%;background:#DCFCE7;display:flex;align-items:center;justify-content:center;font-size:20px;color:#16A34A;flex-shrink:0;">✓</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:14px;font-weight:900;color:#166534;">' + (title || 'Operation Complete') + '</div>' +
            '<div style="font-size:11.5px;color:#15803D;font-weight:600;">' + (subtitle || 'Your agricultural data has been safely synchronized.') + '</div>' +
          '</div>' +
          (actionText ? '<button onclick="' + onAction + '" class="shiny-btn action-btn-green" style="min-height:36px;padding:6px 14px;font-size:11px;font-weight:800;border-radius:8px;cursor:pointer;flex-shrink:0;">' + actionText + '</button>' : '') +
        '</div>';

    default:
      return '';
  }
}
window.renderAgrarianStateCard = renderAgrarianStateCard;

/* ═════════════════ PROGRESSIVE BLURHASH IMAGE LOADER ═════════════════ */
function renderProgressiveImage(src, alt = 'Farming Image', style = '', className = '', fallbackBg = '#E2E8F0') {
  const uid = 'img_' + Math.random().toString(36).substring(2, 9);
  return '<div class="progressive-img-wrapper ' + className + '" style="position:relative;overflow:hidden;background:' + fallbackBg + ';border-radius:inherit;' + style + '">' +
      '<div id="' + uid + '_blur" class="blurhash-placeholder" style="position:absolute;inset:0;width:100%;height:100%;background:linear-gradient(135deg, #DCFCE7 0%, #E2E8F0 100%);filter:blur(8px);transform:scale(1.05);transition:opacity 0.3s ease-out;pointer-events:none;"></div>' +
      '<img id="' + uid + '" src="' + src + '" alt="' + alt + '" loading="lazy" onload="this.classList.add(\'blurhash-loaded\');this.style.opacity=\'1\';var b=document.getElementById(\'' + uid + '_blur\');if(b)b.style.opacity=\'0\';" onerror="this.onerror=null;this.src=\'images/placeholder_leaf.png\';this.classList.add(\'blurhash-loaded\');this.style.opacity=\'1\';var b=document.getElementById(\'' + uid + '_blur\');if(b)b.style.opacity=\'0\';" style="position:relative;z-index:2;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.3s cubic-bezier(0.16,1,0.3,1);" />' +
    '</div>';
}
window.renderProgressiveImage = renderProgressiveImage;

/* ═════════════════ FULL-COVERAGE REMAINING SKELETON LOADERS (PHASE 2) ═════════════════ */
function renderHomeDashboardSkeleton() {
  return '<div class="home-skeleton-wrap" style="display:flex;flex-direction:column;gap:14px;padding:16px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div class="skeleton-shimmer" style="width:44px;height:44px;border-radius:50%;"></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<div class="skeleton-shimmer" style="width:130px;height:16px;border-radius:4px;"></div>' +
            '<div class="skeleton-shimmer" style="width:90px;height:12px;border-radius:4px;"></div>' +
          '</div>' +
        '</div>' +
        '<div class="skeleton-shimmer" style="width:36px;height:36px;border-radius:50%;"></div>' +
      '</div>' +
      '<div class="skeleton-shimmer" style="height:140px;border-radius:24px;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
        '<div class="skeleton-shimmer" style="height:90px;border-radius:18px;"></div>' +
        '<div class="skeleton-shimmer" style="height:90px;border-radius:18px;"></div>' +
      '</div>' +
    '</div>';
}
window.renderHomeDashboardSkeleton = renderHomeDashboardSkeleton;

function renderLoanKccSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:12px;padding:16px;">' +
      '<div class="skeleton-shimmer" style="height:160px;border-radius:24px;"></div>' +
      '<div class="skeleton-shimmer" style="height:70px;border-radius:18px;"></div>' +
      '<div class="skeleton-shimmer" style="height:50px;border-radius:14px;"></div>' +
    '</div>';
}
window.renderLoanKccSkeleton = renderLoanKccSkeleton;

function renderAgriStackSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:12px;padding:16px;">' +
      '<div class="skeleton-shimmer" style="height:220px;border-radius:24px;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
        '<div class="skeleton-shimmer" style="height:60px;border-radius:14px;"></div>' +
        '<div class="skeleton-shimmer" style="height:60px;border-radius:14px;"></div>' +
        '<div class="skeleton-shimmer" style="height:60px;border-radius:14px;"></div>' +
      '</div>' +
    '</div>';
}
window.renderAgriStackSkeleton = renderAgriStackSkeleton;

function renderBioRxSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:12px;padding:16px;">' +
      '<div class="skeleton-shimmer" style="height:100px;border-radius:20px;"></div>' +
      '<div class="skeleton-shimmer" style="height:100px;border-radius:20px;"></div>' +
      '<div class="skeleton-shimmer" style="height:100px;border-radius:20px;"></div>' +
    '</div>';
}
window.renderBioRxSkeleton = renderBioRxSkeleton;

function renderCalcFertSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:12px;padding:16px;">' +
      '<div class="skeleton-shimmer" style="height:80px;border-radius:18px;"></div>' +
      '<div class="skeleton-shimmer" style="height:140px;border-radius:22px;"></div>' +
    '</div>';
}
window.renderCalcFertSkeleton = renderCalcFertSkeleton;

function renderCalcPestSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:12px;padding:16px;">' +
      '<div class="skeleton-shimmer" style="height:90px;border-radius:18px;"></div>' +
      '<div class="skeleton-shimmer" style="height:150px;border-radius:22px;"></div>' +
    '</div>';
}
window.renderCalcPestSkeleton = renderCalcPestSkeleton;

function renderBudgetSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:12px;padding:16px;">' +
      '<div class="skeleton-shimmer" style="height:120px;border-radius:22px;"></div>' +
      '<div class="skeleton-shimmer" style="height:120px;border-radius:22px;"></div>' +
    '</div>';
}
window.renderBudgetSkeleton = renderBudgetSkeleton;

function renderDriverCockpitSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:14px;padding:16px;">' +
      '<div class="skeleton-shimmer" style="height:80px;border-radius:20px;"></div>' +
      '<div class="skeleton-shimmer" style="height:200px;border-radius:24px;"></div>' +
      '<div class="skeleton-shimmer" style="height:90px;border-radius:18px;"></div>' +
    '</div>';
}
window.renderDriverCockpitSkeleton = renderDriverCockpitSkeleton;

function renderProfileSkeleton() {
  return '<div style="display:flex;flex-direction:column;gap:14px;padding:16px;">' +
      '<div style="display:flex;align-items:center;gap:14px;">' +
        '<div class="skeleton-shimmer" style="width:60px;height:60px;border-radius:50%;"></div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<div class="skeleton-shimmer" style="width:140px;height:18px;border-radius:4px;"></div>' +
          '<div class="skeleton-shimmer" style="width:100px;height:14px;border-radius:4px;"></div>' +
        '</div>' +
      '</div>' +
      '<div class="skeleton-shimmer" style="height:90px;border-radius:20px;"></div>' +
      '<div class="skeleton-shimmer" style="height:160px;border-radius:22px;"></div>' +
    '</div>';
}
window.renderProfileSkeleton = renderProfileSkeleton;

/* ═════════════════ REVERSIBLE NOTIFICATION DISMISSAL ═════════════════ */
function dismissNotificationWithUndo(notifId) {
  if (typeof APP_NOTIFICATIONS === 'undefined' || !Array.isArray(APP_NOTIFICATIONS)) return;
  const index = APP_NOTIFICATIONS.findIndex(n => n.id === notifId);
  if (index === -1) return;
  const removed = APP_NOTIFICATIONS.splice(index, 1)[0];
  if (typeof persistNotifications === 'function') persistNotifications();
  if (typeof updateNotificationBadges === 'function') updateNotificationBadges();
  if (typeof renderNotificationsList === 'function') renderNotificationsList();

  if (typeof showLuxuryToastWithUndo === 'function') {
    showLuxuryToastWithUndo(
      TL('Alert dismissed', 'నోటిఫికేషన్ తొలగించబడింది', 'सूचना हटा दी गई'),
      () => {
        APP_NOTIFICATIONS.splice(index, 0, removed);
        if (typeof persistNotifications === 'function') persistNotifications();
        if (typeof updateNotificationBadges === 'function') updateNotificationBadges();
        if (typeof renderNotificationsList === 'function') renderNotificationsList();
      },
      'info',
      5000
    );
  }
}
window.dismissNotificationWithUndo = dismissNotificationWithUndo;

/* ═════════════════ PRECOMPUTED CONTENT FOR INSTANT NAVIGATION ═════════════════ */
function precomputeAgrarianMatrices() {
  if (typeof window !== 'undefined' && window.NUKROP_PRECOMPUTED) return;
  try {
    window.NUKROP_PRECOMPUTED = {
      matricesLoaded: true,
      timestamp: Date.now(),
      icarBenchmarkLoaded: true,
      biorxFormulationsCount: 12,
      mspSeason: '2026-27'
    };
  } catch(e) {}
}
if (typeof window !== 'undefined') {
  precomputeAgrarianMatrices();
  window.precomputeAgrarianMatrices = precomputeAgrarianMatrices;
}

/* ═════════════════ SWIPE-TO-DISMISS GESTURE HANDLER ═════════════════ */
function enableSwipeToDismiss(element, onDismiss) {
  if (!element) return;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  element.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && element.scrollTop <= 0) {
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
    }
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0) {
      element.style.transform = `translateY(${deltaY}px)`;
      element.style.transition = 'none';
    }
  }, { passive: true });

  element.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const deltaY = currentY - startY;
    element.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    if (deltaY > 100) {
      element.style.transform = 'translateY(100%)';
      setTimeout(() => {
        if (typeof onDismiss === 'function') onDismiss();
      }, 220);
    } else {
      element.style.transform = 'translateY(0)';
    }
  });
}
window.enableSwipeToDismiss = enableSwipeToDismiss;

/* ═════════════════ COMMAND MENU & QUICK ACTIONS SHEET (FULL 18+ COVERAGE) ═════════════════ */
function openMobileQuickActionsSheet() {
  const existing = document.getElementById('nukrop-quick-actions-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'nukrop-quick-actions-overlay';
  overlay.className = 'custom-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:999999;display:flex;flex-direction:column;justify-content:flex-end;animation:nkOverlayFadeIn 0.2s ease-out;';

  const sheet = document.createElement('div');
  sheet.className = 'custom-modal-sheet squircle-card';
  sheet.style.cssText = 'background:#FFFFFF;border-top-left-radius:28px;border-top-right-radius:28px;padding:20px 18px max(env(safe-area-inset-bottom, 16px), 24px);max-height:85vh;overflow-y:auto;box-shadow:0 -10px 40px rgba(0,0,0,0.25);position:relative;display:flex;flex-direction:column;gap:12px;';

  const actions = [
    { id: 'scanner', title: 'AI Crop Doctor / Scanner', desc: 'Instant foliar diagnosis & BioRx treatment', icon: '🌿', tab: 'tab-scanner' },
    { id: 'market', title: 'Live APMC Mandi Rates', desc: 'Real-time market rates & arrival forecasts', icon: '📊', tab: 'tab-market' },
    { id: 'khata', title: 'Farm Khata Ledger', desc: 'Digital farm accounting & ledger balances', icon: '📒', tab: 'tab-khata' },
    { id: 'gramhaul', title: 'Book GramHaul Freight', desc: 'Farm-gate logistics & verified truck dispatch', icon: '🚚', tab: 'tab-gramhaul' },
    { id: 'weather', title: '7-Day Weather & Spray Radar', desc: 'Micro-climate advisories & optimal spray windows', icon: '🌤️', tab: null },
    { id: 'schemes', title: 'Govt Schemes & Subsidies', desc: 'PM-Kisan, Rythu Bandhu & crop insurance', icon: '🏛️', tab: null },
    { id: 'equipment', title: 'Machinery Rental Hub', desc: 'Tractor, harvester & drone equipment sharing', icon: '🚜', tab: null },
    { id: 'community', title: 'Kisan Community Feed', desc: 'Verified agronomy Q&A & farmer harvest stories', icon: '👥', tab: 'tab-community' },
    { id: 'agristack', title: 'AgriStack Land Records & KCC', desc: 'Digital RoR cadastral maps & instant e-KYC KCC loan', icon: '📑', tab: null },
    { id: 'loan', title: 'KCC Loan & Credit Sanction', desc: 'Instant Aadhaar e-Sign DBT loan limit', icon: '💳', tab: null },
    { id: 'bioshield', title: 'Pest Outbreak Radar (BioShield)', desc: 'Locust & fungal infection surveillance alerts', icon: '⚠️', tab: null },
    { id: 'biorx', title: 'BioRx Organic Formulations', desc: 'Natural neem & bio-fertilizer recipes', icon: '🧪', tab: null },
    { id: 'calc_fert', title: 'Fertilizer Recommendation Calculator', desc: 'Stage-wise NPK balanced dosage calculator', icon: '🌾', tab: null },
    { id: 'calc_pest', title: 'Pesticide Tank-Mix Calculator', desc: 'Knapsack sprayer water & chemical ratio calculator', icon: '🐛', tab: null },
    { id: 'calc_budget', title: 'Farm Economics & Profit Budget', desc: 'Harvest revenue & operational expense analytics', icon: '📈', tab: null },
    { id: 'driver_dashboard', title: 'Truck Driver Partner Cockpit', desc: 'Driver duty status & active trip freight radar', icon: '🚚', tab: null },
    { id: 'voice', title: 'AI Voice Advisory', desc: 'Speak in native dialect for instant recommendations', icon: '🎙️', modal: 'voice' },
    { id: 'profile', title: 'App Settings & Preferences', desc: 'Language selector, offline cache & display options', icon: '⚙️', tab: 'tab-profile' }
  ];

  let actionsHtml = '';
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    actionsHtml += '<div class="nk-quick-item" data-title="' + a.title.toLowerCase() + ' ' + a.desc.toLowerCase() + '" onclick="handleQuickActionSelect(\'' + a.id + '\', \'' + (a.tab || '') + '\', \'' + (a.modal || '') + '\')" style="background:#F8FAFC;border:1.2px solid #E2E8F0;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 140ms ease;" onmouseover="this.style.background=\'#F0FDF4\';this.style.borderColor=\'#86EFAC\';" onmouseout="this.style.background=\'#F8FAFC\';this.style.borderColor=\'#E2E8F0\';">' +
      '<div style="width:40px;height:40px;border-radius:12px;background:#FFFFFF;border:1px solid #E2E8F0;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.04);">' + a.icon + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13.5px;font-weight:800;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + a.title + '</div>' +
        '<div style="font-size:11px;color:#64748B;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + a.desc + '</div>' +
      '</div>' +
      '<span style="font-size:14px;color:#94A3B8;font-weight:900;">→</span>' +
    '</div>';
  }

  sheet.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
      '<div>' +
        '<div style="font-size:18px;font-weight:900;color:#0F172A;letter-spacing:-0.3px;">Quick Actions & Navigation</div>' +
        '<div style="font-size:11.5px;color:#64748B;font-weight:600;">1-Tap Access across NuKrop Agrarian OS <kbd class="shortcut-hint">Esc</kbd></div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'nukrop-quick-actions-overlay\').remove();" style="width:36px;height:36px;border-radius:50%;background:#F1F5F9;border:none;display:flex;align-items:center;justify-content:center;font-size:18px;color:#475569;cursor:pointer;min-height:36px;">✕</button>' +
    '</div>' +
    '<div style="position:relative;">' +
      '<input id="nk-quick-action-search" type="text" placeholder="Type to filter features (e.g. Mandi, Scanner, Khata)..." style="width:100%;box-sizing:border-box;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:14px;padding:12px 14px 12px 38px;font-size:13.5px;font-weight:700;color:#0F172A;outline:none;" />' +
      '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:15px;color:#94A3B8;pointer-events:none;">🔍</span>' +
    '</div>' +
    '<div id="nk-quick-actions-list" style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;padding-right:2px;">' +
      actionsHtml +
    '</div>';

  overlay.appendChild(sheet);
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  document.body.appendChild(overlay);

  if (typeof enableSwipeToDismiss === 'function') {
    enableSwipeToDismiss(sheet, () => overlay.remove());
  }

  setTimeout(() => {
    const searchInp = document.getElementById('nk-quick-action-search');
    if (searchInp) {
      searchInp.focus();
      searchInp.addEventListener('input', (e) => {
        const query = (e.target.value || '').toLowerCase().trim();
        const items = document.querySelectorAll('.nk-quick-item');
        items.forEach(it => {
          const text = it.getAttribute('data-title') || '';
          it.style.display = (!query || text.includes(query)) ? 'flex' : 'none';
        });
      });
    }
  }, 50);
}
window.openMobileQuickActionsSheet = openMobileQuickActionsSheet;

function handleQuickActionSelect(id, tabId, modalType) {
  const overlay = document.getElementById('nukrop-quick-actions-overlay');
  if (overlay) overlay.remove();

  if (modalType === 'voice') {
    if (typeof openVoiceAdvisoryModal === 'function') openVoiceAdvisoryModal();
    return;
  }
  if (modalType === 'settings') {
    if (typeof openSettingsModal === 'function') openSettingsModal();
    return;
  }
  const tabEl = tabId ? document.getElementById(tabId) : null;
  if (typeof openScreen === 'function') {
    openScreen(id, tabEl);
  }
}
window.handleQuickActionSelect = handleQuickActionSelect;

/* ═════════════════ PREDICTIVE BACK NAVIGATION & KEYBOARD SHORTCUTS ═════════════════ */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      handleMobileBackPress();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openMobileQuickActionsSheet();
    }
  });
}

function handleMobileBackPress() {
  const quickSheet = document.getElementById('nukrop-quick-actions-overlay');
  if (quickSheet) { quickSheet.remove(); return true; }

  const modals = document.querySelectorAll('.custom-modal-overlay, .active-modal, [id$="-modal"], #google-auth-modal, #driver-incoming-haul-modal, #driver-truck-reg-modal, #role-switch-auth-modal, #biorx-calculator-modal, #kcc-sanction-modal, #voice-advisory-modal');
  for (let i = modals.length - 1; i >= 0; i--) {
    if (modals[i] && modals[i].style.display !== 'none') {
      modals[i].remove ? modals[i].remove() : (modals[i].style.display = 'none');
      return true;
    }
  }

  const activeTab = document.querySelector('.dock-tab-btn.active');
  if (activeTab && activeTab.id !== 'tab-home') {
    openScreen('home', document.getElementById('tab-home'));
    return true;
  }
  return false;
}
window.handleMobileBackPress = handleMobileBackPress;
