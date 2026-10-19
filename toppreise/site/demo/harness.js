/**
 * Toppreise Suite Interactive Demo Harness
 * Bridges host marketing frame with authentic Toppreise snapshot.
 * Provides deterministic price history seeding, client-side XHR/fetch interceptors,
 * link shielding, and real-time userscript toggle / preset controls.
 */

(() => {
  'use strict';

  const FROZEN_NOW = 1760000000000;
  const PIDS = ['944295', '909930', '887057', '887222', '886747', '887218', '886628', '907751'];
  const ROLES = ['deep', 'markup', 'fallback', 'deep', 'markup', 'deep', 'fallback', 'deep'];

  const LEGEND_HTML = `
    <div class="PriceChartLegend">
      <div class="col-4"><div class="title">Tiefstpreis</div><div class="Plugin_Price">1800.00</div></div>
      <div class="col-4"><div class="title">Höchstpreis</div><div class="Plugin_Price">2600.00</div></div>
    </div>
  `;

  // Parse card price from DOM
  function parseCardPrice(pid) {
    const a = document.querySelector(`a[href*="-p${pid}"]`);
    if (!a) return 0;
    const parse = (t) => {
      const m = (t || '').match(/CHF\s*([0-9'’.,]+)/);
      if (!m) return 0;
      let s = m[1].replace(/['’\s]/g, '');
      if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
      return parseFloat(s) || 0;
    };
    let v = parse(a.textContent);
    if (!v) v = parse(a.closest('.f_collection')?.textContent);
    if (!v) v = parse(a.parentElement?.textContent);
    return v || 100;
  }

  // Generate deterministic stats for each role
  function generateSeedStats(role, price) {
    const p = Math.round(price * 100) / 100;
    const now = FROZEN_NOW;
    if (role === 'deep') {
      const prev_low = Math.round(p * 2.5 * 100) / 100;
      const med_price = Math.round(p * (10 / 3) * 100) / 100;
      const high_price = Math.round(p * 4.15 * 100) / 100;
      const pts = [];
      for (let i = 0; i < 15; i++) {
        pts.push([now - (30 - i) * 86400000, Math.round((high_price - i * ((high_price - med_price) / 14)) * 100) / 100]);
      }
      for (let i = 0; i < 15; i++) {
        pts.push([now - (15 - i) * 86400000, Math.round((med_price - i * ((med_price - prev_low) / 14)) * 100) / 100]);
      }
      return {
        tiefstpreis: p,
        previousLow: prev_low,
        hoechstpreis: high_price,
        medianPrice: med_price,
        timeSeries: pts,
        dataPointCount: 30,
        isNewAllTimeLow: true,
      };
    }
    if (role === 'markup') {
      return {
        tiefstpreis: Math.round(p * 0.5 * 100) / 100,
        hoechstpreis: Math.round(p * 0.6 * 100) / 100,
        medianPrice: Math.round(p * 0.55 * 100) / 100,
        isNewAllTimeLow: false,
      };
    }
    if (role === 'fallback') {
      return {
        tiefstpreis: p,
        previousLow: Math.round(p * 1.15 * 100) / 100,
        dataPointCount: 3,
      };
    }
    return { tiefstpreis: p, medianPrice: p, dataPointCount: 10 };
  }

  // Intercept XHR and Fetch to stub /plugins/product/pricechart
  function installMockNetwork() {
    const origFetch = window.fetch;
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/plugins/product/pricechart')) {
        return new Response(LEGEND_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return origFetch.apply(this, arguments);
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._tpUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (typeof this._tpUrl === 'string' && this._tpUrl.includes('/plugins/product/pricechart')) {
        Object.defineProperty(this, 'readyState', { get: () => 4 });
        Object.defineProperty(this, 'status', { get: () => 200 });
        Object.defineProperty(this, 'responseText', { get: () => LEGEND_HTML });
        setTimeout(() => {
          if (typeof this.onload === 'function') this.onload();
          if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
        }, 10);
        return;
      }
      return origSend.apply(this, arguments);
    };
  }

  // Toast notification inside the demo
  function showDemoToast(msg) {
    let toast = document.getElementById('tp-demo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tp-demo-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
        padding: 8px 16px;
        border-radius: 9999px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 9999999;
        pointer-events: none;
        transition: opacity 0.3s ease;
        opacity: 0;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2400);
  }

  // Intercept links to prevent leaving the demo iframe
  function installLinkShield() {
    document.addEventListener('click', (e) => {
      // Don't intercept clicks inside suite root or on suite card controls
      if (e.target.closest('#tp-root')) return;
      if (e.target.closest('.tp-sparkline-container, .tp-share-btn, .tp-dealer-name, .tp-review-link')) return;

      const a = e.target.closest('a');
      if (!a) return;

      const href = a.getAttribute('href') || '';
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        e.preventDefault();
        showDemoToast('Demo-Modus: Externe Links in der Vorschau deaktiviert.');
      }
    });
  }

  let pristineContentHtml = null;
  let isSuiteLoaded = false;
  let isSuiteActive = true;

  // Apply deterministic seeds to localStorage and memoryCache
  function seedHistories() {
    try {
      localStorage.clear();
      localStorage.setItem('tp_suite_v2_DEBUG', 'true');
      for (let i = 0; i < PIDS.length; i++) {
        const pid = PIDS[i];
        const role = ROLES[i];
        const price = parseCardPrice(pid);
        const stats = generateSeedStats(role, price);
        stats.time = Date.now();
        localStorage.setItem('tp_hist_v1_' + pid, JSON.stringify(stats));
        if (window.ToppreiseSuite?.memoryCache) {
          window.ToppreiseSuite.memoryCache.set(pid, stats);
        }
      }
    } catch (e) {
      console.warn('[DemoHarness] Seeding storage failed:', e);
    }
  }

  // Activate / deactivate suite
  function setSuiteActive(active) {
    isSuiteActive = active;
    if (active) {
      if (!isSuiteLoaded) {
        loadSuiteScript();
      } else {
        seedHistories();
        if (window.ToppreiseSuite?.processListings) {
          window.ToppreiseSuite.processListings();
        }
        const tpRoot = document.getElementById('tp-root');
        if (tpRoot) tpRoot.style.display = '';
      }
      showDemoToast('Toppreise Suite aktiviert 💎');
    } else {
      // Revert to pristine unmodified Toppreise HTML
      const tpContent = document.getElementById('tpContent');
      if (tpContent && pristineContentHtml) {
        tpContent.innerHTML = pristineContentHtml;
      }
      const tpRoot = document.getElementById('tp-root');
      if (tpRoot) tpRoot.style.display = 'none';
      const staleBar = document.getElementById('tp-suite-filter-bar');
      if (staleBar) staleBar.remove();
      const staleCta = document.getElementById('tp-floating-check-cta');
      if (staleCta) staleCta.remove();
      showDemoToast('Standard Toppreise (Suite deaktiviert)');
    }
    notifyParentState();
  }

  // Presets
  function applyPreset(preset) {
    if (!isSuiteActive) setSuiteActive(true);

    const bestpreiseBtn = document.getElementById('tp-bar-bestpreise-btn');
    const heatBtn = document.getElementById('tp-bar-heat-btn');

    if (preset === 'all') {
      if (window.ToppreiseSuite?.CONFIG) {
        window.ToppreiseSuite.CONFIG.BESTPREISE_ONLY = false;
        window.ToppreiseSuite.CONFIG.ENABLE_HEATMAP = true;
      } else if (bestpreiseBtn?.classList.contains('tp-tool-active')) {
        bestpreiseBtn.click();
      }
      window.ToppreiseSuite?.processListings?.();
      showDemoToast('Preset: Alle Angebote');
    } else if (preset === 'verified') {
      if (window.ToppreiseSuite?.CONFIG) {
        window.ToppreiseSuite.CONFIG.BESTPREISE_ONLY = true;
        window.ToppreiseSuite.CONFIG.ENABLE_HEATMAP = true;
      } else if (bestpreiseBtn && !bestpreiseBtn.classList.contains('tp-tool-active')) {
        bestpreiseBtn.click();
      }
      window.ToppreiseSuite?.processListings?.();
      showDemoToast('Preset: Nur verifizierte Deals (Score ≥ 70)');
    } else if (preset === 'heatmap') {
      if (window.ToppreiseSuite?.CONFIG) {
        window.ToppreiseSuite.CONFIG.ENABLE_HEATMAP = !window.ToppreiseSuite.CONFIG.ENABLE_HEATMAP;
      } else if (heatBtn) {
        heatBtn.click();
      }
      window.ToppreiseSuite?.processListings?.();
      showDemoToast('Heatmap umgeschaltet');
    }
    notifyParentState();
  }

  // Notify parent marketing window about state
  function notifyParentState() {
    try {
      window.parent.postMessage({
        type: 'TP_DEMO_STATE',
        active: isSuiteActive,
        bestpreiseOnly: window.ToppreiseSuite?.CONFIG?.BESTPREISE_ONLY || false,
        heatmapActive: window.ToppreiseSuite?.CONFIG?.ENABLE_HEATMAP ?? true,
      }, '*');
    } catch {}
  }

  // Load toppreise.user.js
  function loadSuiteScript() {
    isSuiteLoaded = true;
    seedHistories();
    const script = document.createElement('script');
    script.src = 'toppreise.user.js';
    script.onload = () => {
      // Suite loaded and executed document-idle
      setTimeout(() => {
        seedHistories();
        if (window.ToppreiseSuite?.processListings) {
          window.ToppreiseSuite.processListings();
        }
        notifyParentState();
      }, 50);
    };
    document.body.appendChild(script);
  }

  // Initialize harness
  function init() {
    installMockNetwork();
    installLinkShield();

    const tpContent = document.getElementById('tpContent');
    if (tpContent) {
      pristineContentHtml = tpContent.innerHTML;
    }

    // Check query param (?suite=0 to start in stock mode)
    const urlParams = new URLSearchParams(window.location.search);
    const startActive = urlParams.get('suite') !== '0';

    if (startActive) {
      loadSuiteScript();
    } else {
      isSuiteActive = false;
    }

    // Message bridge from outer window
    window.addEventListener('message', (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'SET_SUITE_ACTIVE') {
        setSuiteActive(Boolean(e.data.active));
      } else if (e.data.type === 'APPLY_PRESET') {
        applyPreset(e.data.preset);
      } else if (e.data.type === 'GET_STATE') {
        notifyParentState();
      }
    });

    window.ToppreiseDemo = {
      setSuiteActive,
      applyPreset,
      getState: () => ({ active: isSuiteActive }),
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
