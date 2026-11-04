
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

/* ═════════════════ COMMAND MENU & QUICK ACTIONS SHEET ═════════════════ */
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
    { id: 'mandi', title: 'Live APMC Mandi Rates', desc: 'Real-time market rates & arrival forecasts', icon: '📊', tab: 'tab-mandi' },
    { id: 'khata', title: 'Farm Khata Ledger', desc: 'Digital farm accounting & ledger balances', icon: '📒', tab: 'tab-khata' },
    { id: 'gramhaul', title: 'Book GramHaul Freight', desc: 'Farm-gate logistics & verified truck dispatch', icon: '🚚', tab: 'tab-gramhaul' },
    { id: 'weather', title: '7-Day Weather & Spray Radar', desc: 'Micro-climate advisories & optimal spray windows', icon: '🌤️', tab: null },
    { id: 'schemes', title: 'Govt Schemes & Subsidies', desc: 'PM-Kisan, Rythu Bandhu & crop insurance', icon: '🏛️', tab: null },
    { id: 'machinery', title: 'Machinery Rental Hub', desc: 'Tractor, harvester & drone equipment sharing', icon: '🚜', tab: null },
    { id: 'community', title: 'Kisan Community Feed', desc: 'Verified agronomy Q&A & farmer harvest stories', icon: '👥', tab: 'tab-community' },
    { id: 'agristack', title: 'AgriStack Land Records & KCC', desc: 'Digital RoR cadastral maps & instant e-KYC KCC loan', icon: '📑', tab: null },
    { id: 'alerts', title: 'Pest Outbreak Radar', desc: 'Locust & fungal infection surveillance alerts', icon: '⚠️', tab: null },
    { id: 'voice', title: 'AI Voice Advisory', desc: 'Speak in native dialect for instant recommendations', icon: '🎙️', modal: 'voice' },
    { id: 'settings', title: 'App Settings & Preferences', desc: 'Language selector, offline cache & display options', icon: '⚙️', modal: 'settings' }
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
        '<div style="font-size:11.5px;color:#64748B;font-weight:600;">1-Tap Access across NuKrop Agrarian OS <span style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:4px;padding:1px 5px;font-family:monospace;font-size:10px;">Esc</span></div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'nukrop-quick-actions-overlay\').remove();" style="width:36px;height:36px;border-radius:50%;background:#F1F5F9;border:none;display:flex;align-items:center;justify-content:center;font-size:18px;color:#475569;cursor:pointer;min-height:36px;">✕</button>' +
    '</div>' +
    '<div style="position:relative;">' +
      '<input id="nk-quick-action-search" type="text" placeholder="Type to filter features (e.g. Mandi, Scanner)..." style="width:100%;box-sizing:border-box;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:14px;padding:12px 14px 12px 38px;font-size:13.5px;font-weight:700;color:#0F172A;outline:none;" />' +
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

  const modals = document.querySelectorAll('.custom-modal-overlay, #google-auth-modal, #driver-incoming-haul-modal, #driver-truck-reg-modal, #role-switch-auth-modal, #biorx-calculator-modal, #kcc-sanction-modal, #voice-advisory-modal');
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
