(() => {
    const SUPABASE_URL = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';

    // inject styles
    const style = document.createElement('style');
    style.textContent = `
    /* FAB */
    #searchFab {
        position: fixed;
        top: 20px;
        right: 24px;
        z-index: 900;
        width: 42px; height: 42px;
        border-radius: 50%;
        background: #fff;
        border: 1.5px solid #e2e8f0;
        box-shadow: 0 4px 16px rgba(0,0,0,0.10);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #0f172a;
        font-size: 16px;
        transition: box-shadow 0.15s, transform 0.15s;
    }
    #searchFab:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.14); transform: scale(1.06); }

    /* Overlay backdrop */
    #searchOverlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: rgba(15,23,42,0.55);
        backdrop-filter: blur(4px);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 80px 16px 40px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
    }
    #searchOverlay.open {
        opacity: 1;
        pointer-events: all;
    }

    /* Search box */
    .so-box {
        width: 100%;
        max-width: 640px;
        background: #fff;
        border-radius: 20px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.20);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 140px);
    }
    .so-input-row {
        display: flex;
        align-items: center;
        padding: 0 18px;
        border-bottom: 1px solid #f1f5f9;
        gap: 12px;
        flex-shrink: 0;
    }
    .so-input-row i { color: #94a3b8; font-size: 16px; flex-shrink: 0; }
    #soInput {
        flex: 1;
        border: none;
        outline: none;
        font-size: 16px;
        font-weight: 500;
        font-family: 'Inter', sans-serif;
        color: #0f172a;
        padding: 18px 0;
        background: transparent;
    }
    #soInput::placeholder { color: #cbd5e1; }
    .so-esc {
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
        background: #f1f5f9;
        padding: 3px 8px;
        border-radius: 6px;
        cursor: pointer;
        flex-shrink: 0;
    }

    /* Results */
    #soResults {
        overflow-y: auto;
        padding: 8px 0 12px;
    }
    .so-empty, .so-loading {
        padding: 32px 20px;
        text-align: center;
        color: #94a3b8;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    .so-empty i, .so-loading i { font-size: 28px; opacity: 0.35; }
    .so-section {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #94a3b8;
        padding: 10px 18px 4px;
    }
    .so-person {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 18px;
        text-decoration: none;
        transition: background 0.1s;
        cursor: pointer;
    }
    .so-person:hover { background: #f8fafc; }
    .so-avatar {
        width: 36px; height: 36px;
        border-radius: 10px;
        object-fit: cover;
        flex-shrink: 0;
    }
    .so-pname { font-size: 13px; font-weight: 700; color: #0f172a; }
    .so-pjob  { font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 1px; }
    .so-listing {
        display: block;
        padding: 10px 18px;
        text-decoration: none;
        transition: background 0.1s;
        cursor: pointer;
    }
    .so-listing:hover { background: #f8fafc; }
    .so-lbadge {
        display: inline-block;
        font-size: 10px; font-weight: 700;
        padding: 2px 8px; border-radius: 20px;
        text-transform: uppercase; letter-spacing: 0.3px;
        margin-bottom: 4px;
    }
    .so-for-sale    { background:#dcfce7; color:#15803d; }
    .so-for-rent    { background:#dbeafe; color:#1d4ed8; }
    .so-for-lease   { background:#fef9c3; color:#92400e; }
    .so-willing-to-buy   { background:#f0fdf4; color:#166534; }
    .so-willing-to-rent  { background:#eff6ff; color:#1e40af; }
    .so-willing-to-lease { background:#fefce8; color:#854d0e; }
    .so-forum { background:#ede9fe; color:#6d28d9; }
    .so-enter {
        font-size: 11px;
        font-weight: 700;
        color: #16a34a;
        background: #f0fdf4;
        padding: 3px 8px;
        border-radius: 6px;
        cursor: pointer;
        flex-shrink: 0;
    }
    .so-enter:hover { background: #dcfce7; }
    .so-cat {
        display: inline-block;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
        background: #f1f5f9;
        padding: 1px 8px;
        border-radius: 20px;
        margin-top: 4px;
    }
    .so-cat-people { color: #0369a1; background: #e0f2fe; }
    .so-lcontent { font-size: 12px; color: #334155; font-weight: 500; line-height: 1.4; }
    .so-fsubject { font-size: 13px; color: #0f172a; font-weight: 700; line-height: 1.35; margin-bottom: 2px; }
    .so-lposter  { font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 3px; }

    @media (max-width: 768px) {
        #searchFab { top: 14px; right: 14px; width: 38px; height: 38px; font-size: 14px; }
        #searchOverlay { padding: 60px 12px 24px; }
    }
    `;
    document.head.appendChild(style);

    // inject HTML once the body exists (this script may be loaded in <head>)
    let overlay;
    function init() {
        if (overlay) return;
        // skip FAB on home page (has its own search bar)
        const isHomePage = location.pathname.endsWith('home.html') || location.pathname === '/';
        if (!isHomePage) {
            const fab = document.createElement('button');
            fab.id = 'searchFab';
            fab.setAttribute('aria-label', 'Search');
            fab.innerHTML = '<i class="fas fa-magnifying-glass"></i>';
            fab.onclick = openOverlay;
            document.body.appendChild(fab);
        }

        overlay = document.createElement('div');
        overlay.id = 'searchOverlay';
        overlay.innerHTML = `
            <div class="so-box">
                <div class="so-input-row">
                    <i class="fas fa-magnifying-glass"></i>
                    <input id="soInput" type="text" enterkeyhint="search" placeholder="Search people, listings, forum…" autocomplete="off">
                    <span class="so-enter" onclick="window.__searchEnter()">↵ Enter</span>
                    <span class="so-esc" onclick="window.__closeSearchOverlay()">ESC</span>
                </div>
                <div id="soResults">
                    <div class="so-empty"><i class="fas fa-magnifying-glass"></i><span>Start typing to search.</span></div>
                </div>
            </div>`;
        overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
        document.body.appendChild(overlay);

        const soInput = document.getElementById('soInput');
        soInput.addEventListener('input', onInput);
        // Enter (or the mobile keyboard "search"/return key) runs the search immediately.
        soInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchNow(); } });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

        wireUniversalInputs();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    // Any general-purpose page search bar opens the universal overlay when focused/clicked,
    // carrying over whatever the user already typed. Contextual bars (e.g. chat conversation
    // search) are intentionally left alone.
    const UNIVERSAL_INPUT_SELECTORS = '#searchInput, #homeSearchInput, #globalSearchInput';
    function wireUniversalInputs() {
        document.querySelectorAll(UNIVERSAL_INPUT_SELECTORS).forEach(inp => {
            if (inp.dataset.universalWired) return;
            inp.dataset.universalWired = '1';
            inp.setAttribute('readonly', 'readonly');
            inp.style.cursor = 'pointer';
            const open = (e) => {
                if (e) e.preventDefault();
                const val = (inp.value || '').trim();
                inp.blur();
                openOverlay();
                if (val) {
                    const so = document.getElementById('soInput');
                    if (so) { so.value = val; searchNow(); }
                }
            };
            inp.addEventListener('focus', open);
            inp.addEventListener('click', open);
        });
    }

    // Force an immediate search, bypassing the debounce (used by Enter / the Enter button).
    function searchNow() {
        const q = (document.getElementById('soInput')?.value || '').trim();
        clearTimeout(_timer);
        if (!q) return;
        _lastQ = '';
        document.getElementById('soResults').innerHTML =
            '<div class="so-loading"><i class="fas fa-spinner fa-spin"></i><span>Searching…</span></div>';
        runSearch(q);
    }

    window.__closeSearchOverlay = closeOverlay;
    window.__searchEnter = searchNow;

    function openOverlay() {
        overlay.classList.add('open');
        setTimeout(() => document.getElementById('soInput').focus(), 50);
    }
    function closeOverlay() {
        overlay.classList.remove('open');
    }

    let _timer = null, _lastQ = '';
    function onInput() {
        const q = document.getElementById('soInput').value.trim();
        clearTimeout(_timer);
        if (!q) {
            document.getElementById('soResults').innerHTML =
                '<div class="so-empty"><i class="fas fa-magnifying-glass"></i><span>Start typing to search.</span></div>';
            return;
        }
        document.getElementById('soResults').innerHTML =
            '<div class="so-loading"><i class="fas fa-spinner fa-spin"></i><span>Searching…</span></div>';
        _timer = setTimeout(() => runSearch(q), 280);
    }

    async function runSearch(q) {
        if (q === _lastQ) return;
        _lastQ = q;
        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const pat = `%${q}%`;
        const [pr, lr, fr] = await Promise.all([
            sb.from('profiles').select('id,full_name,avatar_url,job_title,division')
              .or(`full_name.ilike.${pat},job_title.ilike.${pat},division.ilike.${pat}`).limit(6),
            sb.from('listings').select('id,content,category,user_name,user_id,created_at')
              .or(`content.ilike.${pat},category.ilike.${pat},user_name.ilike.${pat}`)
              .eq('archived', false).order('created_at', { ascending: false }).limit(10),
            sb.from('forum_posts').select('id,subject,content,user_name,user_img,created_at,is_anonymous')
              .or(`subject.ilike.${pat},content.ilike.${pat},user_name.ilike.${pat}`)
              .or('source.eq.forum,source.is.null')
              .order('created_at', { ascending: false }).limit(8)
        ]);
        renderResults(pr.data || [], lr.data || [], fr.data || []);
    }

    function renderResults(people, listings, forum) {
        const el = document.getElementById('soResults');
        if (!people.length && !listings.length && !forum.length) {
            el.innerHTML = '<div class="so-empty"><i class="fas fa-circle-xmark"></i><span>No results found.</span></div>';
            return;
        }
        let html = '';
        if (people.length) {
            html += `<div class="so-section">People</div>`;
            people.forEach(p => {
                const name   = esc(p.full_name || 'Realmate Member');
                const job    = esc(p.job_title || '');
                const avatar = p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name||'?')}&background=0f172a&color=32cd32`;
                html += `<a href="dashboard.html?user_id=${p.id}" class="so-person" onclick="window.__closeSearchOverlay()">
                    <img src="${avatar}" class="so-avatar" onerror="this.src='https://ui-avatars.com/api/?name=?&background=0f172a&color=32cd32'">
                    <div><div class="so-pname">${name}</div>${job ? `<div class="so-pjob">${job}</div>` : ''}<span class="so-cat so-cat-people">People</span></div>
                </a>`;
            });
        }
        if (listings.length) {
            html += `<div class="so-section" style="margin-top:${people.length?'8px':'0'}">Listings</div>`;
            listings.forEach(l => {
                const cat     = esc(l.category || '');
                const content = esc((l.content || '').slice(0, 100));
                const poster  = esc(l.user_name || '');
                const cls     = (l.category||'').toLowerCase().replace(/\s+/g,'-');
                html += `<a href="dashboard.html?user_id=${l.user_id}" class="so-listing" onclick="window.__closeSearchOverlay()">
                    ${cat ? `<span class="so-lbadge so-${cls}">${cat}</span>` : ''}
                    <div class="so-lcontent">${content}${(l.content||'').length>100?'…':''}</div>
                    ${poster ? `<div class="so-lposter">${poster}</div>` : ''}
                </a>`;
            });
        }
        if (forum.length) {
            html += `<div class="so-section" style="margin-top:${(people.length||listings.length)?'8px':'0'}">Forum</div>`;
            forum.forEach(f => {
                const subject = esc((f.subject || '').slice(0, 80));
                const content = esc((f.content || '').slice(0, 100));
                const poster  = esc(f.is_anonymous ? 'Anonymous' : (f.user_name || ''));
                html += `<div class="so-listing" onclick="window.__openForumPost('${f.id}')">
                    <span class="so-lbadge so-forum"><i class="fas fa-comments" style="font-size:9px;"></i> Forum</span>
                    ${subject ? `<div class="so-fsubject">${subject}</div>` : ''}
                    ${content ? `<div class="so-lcontent">${content}${(f.content||'').length>100?'…':''}</div>` : ''}
                    ${poster ? `<div class="so-lposter">${poster}</div>` : ''}
                </div>`;
            });
        }
        el.innerHTML = html;
    }

    // Deep-link into a forum post: forum.html reads these on load to scroll + highlight it.
    window.__openForumPost = function(postId) {
        try {
            localStorage.setItem('route_target_post_id', String(postId));
            localStorage.setItem('route_target_anchor_id', 'post-' + postId);
        } catch (e) {}
        closeOverlay();
        window.location.href = 'forum.html';
    };

    function esc(s) {
        return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
})();
