(() => {
  const style = document.createElement('style');
  style.textContent = `
    #feederCadSearch{position:absolute;z-index:80;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;width:min(680px,calc(100% - 20px));padding:7px;background:rgba(17,24,39,.94);border:1px solid #475569;border-radius:10px;box-shadow:0 5px 18px rgba(0,0,0,.35)}
    #feederCadSearch input{flex:1;min-width:0;padding:9px 11px;border-radius:7px;border:1px solid #64748b;background:#fff;color:#111827;font-size:14px;direction:ltr}
    #feederCadSearch button{border:0;border-radius:7px;padding:9px 12px;background:#087f5b;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap}
    #feederCadSearch button.nav{background:#334155}
    #feederCadSearch button:disabled{opacity:.45;cursor:not-allowed}
    #feederCadSearch span{color:#e5e7eb;font-size:12px;white-space:nowrap}
    #feederCadSearchCount{min-width:52px;text-align:center;padding:7px 6px;border:1px solid #475569;border-radius:7px;background:#1e293b;color:#fff;font-weight:800;font-variant-numeric:tabular-nums}
    #feederCadBrowsePanel{position:fixed;z-index:9999;top:0;left:0;width:0;display:none;max-height:min(55vh,460px);overflow:auto;padding:7px;border:1px solid #475569;border-radius:9px;background:rgba(15,23,42,.98);box-shadow:0 10px 28px rgba(0,0,0,.45)}
    #feederCadBrowsePanel.is-open{display:block}
    .feeder-cad-result{display:flex;align-items:center;gap:8px;width:100%;padding:8px 9px;margin:2px 0;border:1px solid transparent;border-radius:6px;background:#1e293b;color:#f1f5f9;text-align:right;cursor:pointer;font-size:12px}
    .feeder-cad-result:hover,.feeder-cad-result.is-current{border-color:#ef4444;background:#3f1d1d}
    .feeder-cad-result-index{flex:0 0 34px;color:#fca5a5;font-weight:800;text-align:center}
.feeder-cad-result-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    

    @media(max-width:600px){#feederCadSearch{top:5px;gap:4px;padding:5px;overflow:visible}#feederCadSearch span{display:none}#feederCadSearchCount{display:inline-block!important;min-width:42px;padding:7px 4px}#feederCadSearch input{font-size:13px;padding:8px;min-width:90px}#feederCadSearch button{padding:8px 8px;font-size:12px}}
  `;
  document.head.appendChild(style);
  const box = document.createElement('div');
  box.id = 'feederCadSearch';
  box.innerHTML = '<input id="feederCadSearchInput" placeholder="🔎 ابحث داخل الرسم مثل F-8.13" autocomplete="off"><button id="feederCadSearchBtn">بحث</button><button id="feederCadSearchPrev" class="nav" type="button" disabled>السابق</button><span id="feederCadSearchCount">0/0</span><button id="feederCadSearchNext" class="nav" type="button" disabled>التالي</button><button id="feederCadSearchBrowse" class="nav" type="button" disabled>استعراض</button><span id="feederCadSearchStatus">جاهز</span><div id="feederCadBrowsePanel" aria-label="استعراض نتائج البحث"></div>';
  const host = document.querySelector('.viewer-canvas-area') || document.body;
  host.appendChild(box);
  // Keep the browse panel outside the canvas container so it cannot be clipped by
  // the viewer's overflow/transform layers.
  const browsePanelElement = box.querySelector('#feederCadBrowsePanel');
  if (browsePanelElement) document.body.appendChild(browsePanelElement);

  let occurrence = 0;
  let resultCount = 0;
  let lastQuery = '';
  let equipmentRecords = null;

  fetch('../data/equipment-lookup.json', { cache: 'force-cache' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('equipment database unavailable')))
    .then(data => { equipmentRecords = data.records || {}; if (browsePanel.classList.contains('is-open')) renderBrowseList(); })
    .catch(() => { equipmentRecords = {}; });

  const input = document.getElementById('feederCadSearchInput');
  const searchBtn = document.getElementById('feederCadSearchBtn');
  const prevBtn = document.getElementById('feederCadSearchPrev');
  const nextBtn = document.getElementById('feederCadSearchNext');
  const status = document.getElementById('feederCadSearchStatus');
  const countBox = document.getElementById('feederCadSearchCount');
  const browseBtn = document.getElementById('feederCadSearchBrowse');
  const browsePanel = document.getElementById('feederCadBrowsePanel');
  let browseResults = [];

  function updateButtons() {
    const enabled = resultCount > 1;
    prevBtn.disabled = !enabled;
    nextBtn.disabled = !enabled;
    countBox.textContent = resultCount ? ((occurrence + 1) + '/' + resultCount) : '0/0';
    browseBtn.disabled = resultCount < 1;
  }

  function runSearch(reset = true) {
    const query = input.value.trim();
    if (reset || query !== lastQuery) occurrence = 0;
    lastQuery = query;

    const result = window.cadViewerSearch?.(query, occurrence);
    if (!result?.found) {
      resultCount = 0;
      browseResults = [];
      browsePanel.classList.remove('is-open');
      status.textContent = query ? 'لم يتم العثور' : 'جاهز';
      updateButtons();
      return;
    }

    resultCount = result.count;
    occurrence = result.index;
    browseResults = result.results || [];
    status.textContent = (result.index + 1) + '/' + result.count + '  ' + result.text;
    updateButtons();
    if (browsePanel.classList.contains('is-open')) renderBrowseList();
  }

  function renderBrowseList() {
    browsePanel.innerHTML = '';
    browseResults.forEach((item) => {
      const button = document.createElement('div');
      button.className = 'feeder-cad-result' + (item.index === occurrence ? ' is-current' : '');
      button.setAttribute('role', 'button');
      button.tabIndex = 0;
      button.innerHTML = '<span class="feeder-cad-result-index">' + (item.index + 1) + '</span><span class="feeder-cad-result-text"></span>';
      button.querySelector('.feeder-cad-result-text').textContent = item.text;
      const selectResult = () => {
        occurrence = item.index;
        runSearch(false);
        renderBrowseList();
      };
      button.addEventListener('click', (event) => {
        if (event.target.closest('.feeder-cad-location')) return;
        selectResult();
      });
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectResult();
        }
      });
      browsePanel.appendChild(button);
    });
  }

  function positionBrowsePanel() {
    if (!browsePanel.classList.contains('is-open')) return;
    const rect = box.getBoundingClientRect();
    browsePanel.style.top = Math.round(rect.bottom + 6) + 'px';
    browsePanel.style.left = Math.round(rect.left) + 'px';
    browsePanel.style.width = Math.round(rect.width) + 'px';
  }

  function toggleBrowse() {
    if (!resultCount) return;
    const open = !browsePanel.classList.contains('is-open');
    browsePanel.classList.toggle('is-open', open);
    if (open) {
      renderBrowseList();
      positionBrowsePanel();
    } else {
      browsePanel.style.width = '';
    }
  }

  window.addEventListener('resize', positionBrowsePanel);
  window.addEventListener('scroll', positionBrowsePanel, true);

  function moveResult(step) {
    if (!lastQuery || resultCount < 2) return;
    occurrence = (occurrence + step + resultCount) % resultCount;
    runSearch(false);
    if (browsePanel.classList.contains('is-open')) renderBrowseList();
  }

  searchBtn.onclick = () => runSearch(true);
  prevBtn.onclick = () => moveResult(-1);
  nextBtn.onclick = () => moveResult(1);
  browseBtn.onclick = toggleBrowse;

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveResult(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveResult(-1);
    }
  });

  input.addEventListener('input', () => {
    occurrence = 0;
    resultCount = 0;
    lastQuery = '';
    browseResults = [];
    browsePanel.classList.remove('is-open');
    status.textContent = 'جاهز';
    updateButtons();
  });
})();
