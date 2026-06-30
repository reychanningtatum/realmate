const _sbSearch = window.supabase.createClient(
    'https://wmegpgrfrtprhuzmgjma.supabase.co',
    'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4'
);

let _searchTimer = null;
let _lastQuery   = '';
let _activeTab   = 'all';
let _allPeople   = [];
let _allListings = [];

function switchTab(btn) {
    document.querySelectorAll('.s-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activeTab = btn.dataset.tab;
    renderResults(_allPeople, _allListings);
}

function onSearchInput() {
    const q = document.getElementById('globalSearchInput').value.trim();
    document.getElementById('searchClearBtn').style.display = q ? 'flex' : 'none';
    clearTimeout(_searchTimer);
    if (!q) { clearSearch(); return; }
    document.getElementById('searchTabs').style.display = 'flex';
    showSearching();
    _searchTimer = setTimeout(() => runSearch(q), 300);
}

function clearSearch() {
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('searchClearBtn').style.display = 'none';
    document.getElementById('searchTabs').style.display = 'none';
    _allPeople = []; _allListings = [];
    document.getElementById('searchResults').innerHTML = `
        <div class="search-empty-state">
            <i class="fas fa-magnifying-glass"></i>
            <p>Start typing to search across the entire Realmate network.</p>
        </div>`;
}

function showSearching() {
    document.getElementById('searchResults').innerHTML = `
        <div class="search-empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Searching…</p>
        </div>`;
}

async function runSearch(q) {
    if (q === _lastQuery) return;
    _lastQuery = q;

    const pattern = `%${q}%`;

    const [peopleRes, listingsRes] = await Promise.all([
        _sbSearch.from('profiles')
            .select('id, full_name, avatar_url, job_title, division, bio')
            .or(`full_name.ilike.${pattern},job_title.ilike.${pattern},division.ilike.${pattern}`)
            .limit(20),
        _sbSearch.from('listings')
            .select('id, content, category, user_name, user_id, created_at')
            .or(`content.ilike.${pattern},category.ilike.${pattern},user_name.ilike.${pattern}`)
            .eq('archived', false)
            .order('created_at', { ascending: false })
            .limit(30)
    ]);

    _allPeople   = peopleRes.data   || [];
    _allListings = listingsRes.data || [];
    renderResults(_allPeople, _allListings);
}

function renderResults(people, listings) {
    const container = document.getElementById('searchResults');
    const showPeople   = _activeTab === 'all' || _activeTab === 'people';
    const showListings = _activeTab === 'all' || _activeTab === 'listings';

    const filteredPeople   = showPeople   ? people   : [];
    const filteredListings = showListings ? listings : [];

    if (!filteredPeople.length && !filteredListings.length) {
        container.innerHTML = `
            <div class="search-empty-state">
                <i class="fas fa-circle-xmark"></i>
                <p>No results found. Try a different keyword.</p>
            </div>`;
        return;
    }

    let html = '';

    if (filteredPeople.length) {
        html += `<div class="search-section-label"><i class="fas fa-users"></i> People <span class="s-count">${filteredPeople.length}</span></div>`;
        html += `<div class="people-grid">`;
        filteredPeople.forEach(p => {
            const name   = esc(p.full_name || 'Realmate Member');
            const job    = esc(p.job_title || 'Real Estate Professional');
            const div    = esc(p.division  || '');
            const bio    = esc((p.bio || '').slice(0, 80));
            const avatar = p.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || '?')}&background=0f172a&color=32cd32`;
            html += `
            <a href="dashboard.html?user_id=${p.id}" class="people-card">
                <img src="${avatar}" class="people-avatar"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name||'?')}&background=0f172a&color=32cd32'">
                <div class="people-info">
                    <div class="people-name">${name}</div>
                    <div class="people-job">${job}${div ? ' · ' + div : ''}</div>
                    ${bio ? `<div class="people-bio">${bio}…</div>` : ''}
                </div>
                <i class="fas fa-chevron-right people-arrow"></i>
            </a>`;
        });
        html += `</div>`;
    }

    if (filteredListings.length) {
        html += `<div class="search-section-label" style="margin-top:${filteredPeople.length ? '32px' : '0'}"><i class="fas fa-tag"></i> Listings <span class="s-count">${filteredListings.length}</span></div>`;
        html += `<div class="listings-stack">`;
        filteredListings.forEach(l => {
            const cat     = esc(l.category || '');
            const content = esc((l.content || '').slice(0, 160));
            const poster  = esc(l.user_name || 'Unknown');
            const date    = new Date(l.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
            const catClass = cat.toLowerCase().replace(/\s+/g, '-');
            html += `
            <a href="livemarket.html" class="listing-result-card">
                <div class="lr-top">
                    ${cat ? `<span class="lr-badge lr-${catClass}">${cat}</span>` : ''}
                    <span class="lr-date">${date}</span>
                </div>
                <div class="lr-content">${content}${(l.content||'').length > 160 ? '…' : ''}</div>
                <div class="lr-poster"><i class="fas fa-user-circle"></i> ${poster}</div>
            </a>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

function esc(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, ' ');
}

// Pre-fill from URL ?q=
window.addEventListener('DOMContentLoaded', () => {
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
        document.getElementById('globalSearchInput').value = q;
        onSearchInput();
    }
});
