(() => {
  const style = document.createElement('style');
  style.textContent = `
    #feederCadSearch{position:absolute;z-index:80;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;width:min(680px,calc(100% - 20px));padding:7px;background:rgba(17,24,39,.94);border:1px solid #475569;border-radius:10px;box-shadow:0 5px 18px rgba(0,0,0,.35)}
    #feederCadSearch input{flex:1;min-width:0;padding:9px 11px;border-radius:7px;border:1px solid #64748b;background:#fff;color:#111827;font-size:14px;direction:ltr}
    #feederCadSearch button{border:0;border-radius:7px;padding:9px 12px;background:#087f5b;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap}
    #feederCadSearch button.nav{background:#334155}
    #feederCadSearch button:disabled{opacity:.45;cursor:not-allowed}
    #feederCadSearch span{color:#e5e7eb;font-size:12px;white-space:nowrap}
    @media(max-width:600px){#feederCadSearch{top:5px;gap:4px;padding:5px}#feederCadSearch span{display:none}#feederCadSearch input{font-size:13px;padding:8px}#feederCadSearch button{padding:8px 9px;font-size:12px}}
  `;
  document.head.appendChild(style);
  const box = document.createElement('div');
  box.id = 'feederCadSearch';
  box.innerHTML = '<input id="feederCadSearchInput" placeholder="🔎 ابحث داخل الرسم مثل F-8.13" autocomplete="off"><button id="feederCadSearchBtn">بحث</button><button id="feederCadSearchPrev" class="nav" type="button" disabled>السابق</button><button id="feederCadSearchNext" class="nav" type="button" disabled>التالي</button><span id="feederCadSearchStatus">جاهز</span>';
  const host = document.querySelector('.viewer-canvas-area') || document.body;
  host.appendChild(box);

  let occurrence = 0;
  let resultCount = 0;
  let lastQuery = '';

  const input = document.getElementById('feederCadSearchInput');
  const searchBtn = document.getElementById('feederCadSearchBtn');
  const prevBtn = document.getElementById('feederCadSearchPrev');
  const nextBtn = document.getElementById('feederCadSearchNext');
  const status = document.getElementById('feederCadSearchStatus');

  function updateButtons() {
    const enabled = resultCount > 1;
    prevBtn.disabled = !enabled;
    nextBtn.disabled = !enabled;
  }

  function runSearch(reset = true) {
    const query = input.value.trim();
    if (reset || query !== lastQuery) occurrence = 0;
    lastQuery = query;

    const result = window.cadViewerSearch?.(query, occurrence);
    if (!result?.found) {
      resultCount = 0;
      status.textContent = query ? 'لم يتم العثور' : 'جاهز';
      updateButtons();
      return;
    }

    resultCount = result.count;
    occurrence = result.index;
    status.textContent = (result.index + 1) + '/' + result.count + '  ' + result.text;
    updateButtons();
  }

  function moveResult(step) {
    if (!lastQuery || resultCount < 2) return;
    occurrence = (occurrence + step + resultCount) % resultCount;
    runSearch(false);
  }

  searchBtn.onclick = () => runSearch(true);
  prevBtn.onclick = () => moveResult(-1);
  nextBtn.onclick = () => moveResult(1);

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
    status.textContent = 'جاهز';
    updateButtons();
  });
})();
