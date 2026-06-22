const supabaseUrl = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
const supabaseKey = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';
const _sb = supabase.createClient(supabaseUrl, supabaseKey);

async function logout() {
    await _sb.auth.signOut();
    localStorage.clear();
    location.href = "index.html";
}

// ── Category helpers ──────────────────────────────
const CAT_CLASS = {
    "FOR SALE": "cat-sale", "FOR RENT": "cat-rent", "FOR LEASE": "cat-lease",
    "WILLING TO BUY": "cat-wbuy", "WILLING TO RENT": "cat-wrent", "WILLING TO LEASE": "cat-wlease"
};

function catTag(cat) {
    return `<span class="cat-tag ${CAT_CLASS[cat] || ''}">${cat}</span>`;
}

function buildFMVBadge(fmvResult) {
    if (!fmvResult) return '';
    try {
        const { fmvFormatted, diffStr } = formatFMV(fmvResult);
        return `<div class="fmv-badge ${fmvResult.verdictClass}">
            <i class="fas fa-chart-bar"></i>
            FMV ~${fmvFormatted}
            <span class="fmv-diff">${diffStr}</span>
            <span class="fmv-verdict">${fmvResult.verdict}</span>
        </div>`;
    } catch(e) { return ''; }
}

function safeText(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

const _lbStore = {};
function imagesHtml(listing) {
    const imgs = listing.image_urls?.length ? listing.image_urls : (listing.image_url ? [listing.image_url] : []);
    if (!imgs.length) return '';
    const key = listing.id || ('k' + Math.random().toString(36).slice(2));
    _lbStore[key] = imgs;
    if (imgs.length === 1) return `<div class="listing-card-images" data-lbkey="${key}"><img class="single-img" src="${imgs[0]}" loading="lazy" data-lbidx="0" style="cursor:pointer;"></div>`;
    if (imgs.length === 2) return `
        <div class="listing-card-images" data-lbkey="${key}">
            <div class="listing-img-grid cols-2">
                ${imgs.map((u, i) => `<div class="img-wrap"><img src="${u}" loading="lazy" data-lbidx="${i}" style="cursor:pointer;"></div>`).join('')}
            </div>
        </div>`;
    const extra = imgs.length > 3 ? imgs.length - 3 : 0;
    return `
        <div class="listing-card-images" data-lbkey="${key}">
            <div class="listing-img-grid cols-3">
                <div class="img-wrap cols-3-main"><img src="${imgs[0]}" loading="lazy" data-lbidx="0" style="cursor:pointer;"></div>
                <div class="img-wrap"><img src="${imgs[1]}" loading="lazy" data-lbidx="1" style="cursor:pointer;"></div>
                <div class="img-wrap" style="position:relative;">
                    <img src="${imgs[2]}" loading="lazy" data-lbidx="2" style="cursor:pointer;">
                    ${extra > 0 ? `<div class="img-more-overlay" data-lbidx="2" style="cursor:pointer;">+${extra}</div>` : ''}
                </div>
            </div>
        </div>`;
}

let _lbImgs = [], _lbIdx = 0;
function openLightbox(key, idx) {
    _lbImgs = _lbStore[key] || []; _lbIdx = idx;
    const lb = document.getElementById('lmLightbox');
    document.getElementById('lmLbImg').src = _lbImgs[idx];
    document.getElementById('lmLbCounter').textContent = `${idx + 1} / ${_lbImgs.length}`;
    document.getElementById('lmLbPrev').style.display = _lbImgs.length > 1 ? 'flex' : 'none';
    document.getElementById('lmLbNext').style.display = _lbImgs.length > 1 ? 'flex' : 'none';
    lb.classList.add('open');
}
function closeLightbox() { document.getElementById('lmLightbox').classList.remove('open'); }
function lbNav(dir) {
    _lbIdx = (_lbIdx + dir + _lbImgs.length) % _lbImgs.length;
    document.getElementById('lmLbImg').src = _lbImgs[_lbIdx];
    document.getElementById('lmLbCounter').textContent = `${_lbIdx + 1} / ${_lbImgs.length}`;
}
document.addEventListener('keydown', e => {
    if (!document.getElementById('lmLightbox')?.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') lbNav(-1);
    else if (e.key === 'ArrowRight') lbNav(1);
    else if (e.key === 'Escape') closeLightbox();
});

function avatarFallback(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=32cd32&color=fff`;
}

const PARTNER_MAP = {
    "FOR SALE": "WILLING TO BUY", "WILLING TO BUY": "FOR SALE",
    "FOR RENT": "WILLING TO RENT",  "WILLING TO RENT": "FOR RENT",
    "FOR LEASE": "WILLING TO LEASE","WILLING TO LEASE": "FOR LEASE"
};

// ── Listing card ──────────────────────────────────
// matchLabel: { myCategory, myContent } when this card matches one of the user's own listings
function buildListingCard(listing, matchLabel = null, fmvResult = null, myMatchCount = 0) {
    const card = document.createElement('div');
    card.className = 'listing-card' + (matchLabel ? ' is-match' : '');

    const matchScore = matchLabel?.matchScore || 0;
    const matchGrade = matchScore >= 80 ? 'Excellent' : matchScore >= 50 ? 'Strong' : matchScore >= 30 ? 'Good' : 'Possible';
    const matchColor = matchScore >= 80 ? '#16a34a' : matchScore >= 50 ? '#2563eb' : matchScore >= 30 ? '#f59e0b' : '#94a3b8';
    const matchReasons = matchLabel?.matchReasons || [];
    const matchBanner = matchLabel ? `
        <div class="match-banner">
            <i class="fas fa-bolt"></i>
            Matches your <strong>${matchLabel.myCategory}</strong> listing
            <span style="margin-left:auto;display:flex;align-items:center;gap:6px;">
                <span style="font-size:10px;font-weight:800;color:${matchColor};background:rgba(255,255,255,0.9);padding:2px 8px;border-radius:20px;">${matchGrade} Match</span>
            </span>
            <i class="fas fa-chevron-right match-banner-arrow"></i>
        </div>
        ${matchReasons.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;padding:4px 12px 8px;background:#eff6ff;">
            ${matchReasons.map(r => `<span style="font-size:10px;font-weight:600;color:#1e40af;background:#dbeafe;padding:2px 8px;border-radius:12px;"><i class="fas fa-check" style="font-size:8px;margin-right:3px;"></i>${r}</span>`).join('')}
        </div>` : ''}` : '';

    card.innerHTML = `
        ${matchBanner}
        ${imagesHtml(listing)}
        <div class="listing-card-body">
            <div class="listing-card-top">
                ${catTag(listing.category)}
                ${myMatchCount > 0 ? `<button class="ai-match-badge has-matches" onclick="event.stopPropagation(); selectCatByName('MATCHES');"><i class="fas fa-robot"></i> ${myMatchCount} Match${myMatchCount !== 1 ? 'es' : ''}</button>` : ''}
                <span class="listing-card-date">${timeAgo(listing.created_at)}</span>
            </div>
            <p class="listing-text">${safeText(listing.content)}</p>
            ${buildFMVBadge(fmvResult)}
            <div class="listing-card-user">
                <img src="${listing.user_img || avatarFallback(listing.user_name)}"
                     onerror="this.src='${avatarFallback(listing.user_name)}'">
                <div class="listing-card-user-info">
                    <div class="listing-card-user-name">${listing.user_name || 'Unknown'}</div>
                    <div class="listing-card-user-job">${listing.user_job || ''}</div>
                </div>
                ${listing.is_anonymous ? '' : mateButtonHtml(listing.user_name, 'btn-mate btn-mate-sm')}
            </div>
        </div>
    `;

    // Wire up image lightbox clicks
    const imgWrap = card.querySelector('.listing-card-images[data-lbkey]');
    if (imgWrap) {
        const key = imgWrap.dataset.lbkey;
        imgWrap.querySelectorAll('[data-lbidx]').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                openLightbox(key, parseInt(el.dataset.lbidx));
            });
        });
    }

    if (matchLabel) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            showMatchView(matchLabel.myListing, [listing]);
        });
    }

    return card;
}

// ── Market Price Ticker Algorithm ─────────────────
const KNOWN_PROJECTS = [
    // ── Official Alveo Land Projects ──────────────────────────
    'One Maridien','Two Maridien','Verve One','Verve Two',
    'Park Triangle Residences','Gentry Residences','Park East Place',
    'Two Serendra','Kroma','Lerato',
    'The Columns Ayala Avenue','The Columns Legazpi Village',
    'Senta','Mondia','Treveia','Venare','Lumira','Mirala',
    'Venido','Aveia','Evo Commercial Lot','The Residences At Evo City',
    // ── Other known projects ──────────────────────────────────
    'TREC','The Residences At Greenbelt',
];

// Tokens that are NOT project names (bedroom/unit indicators, common words)
const NON_PROJECT_TOKENS = new Set([
    // Unit/size
    'BR','BDRM','BEDROOM','BEDROOMS','STUDIO','SQM','SQMT','SQMTR',
    // Price/transaction
    'PHP','FOR','SALE','RENT','LEASE','RFO','PSF','PSM','NEGOTIABLE',
    'BUDGET','ASKING','PRICE','ONLY','AVAILABLE','RUSH','SELLING','BUYING',
    'WILLING','OPEN','VIEWING','OFFER','OFFERS','CASH','TERMS',
    // Unit descriptors
    'UNIT','FLOOR','TOWER','BUILDING','BLOCK','LOT','CBD',
    // Locations (should not be mistaken for project names)
    'BGC','MAKATI','TAGUIG','PASIG','MANDALUYONG','ORTIGAS','MANILA',
    'ALABANG','CEBU','QC','EASTWOOD','MCKINLEY','SALCEDO','LEGAZPI',
    'BONIFACIO','GLOBAL','CITY','METRO',
    // Developers
    'ALVEO','SMDC','DMCI','AYALA','MEGAWORLD','FILINVEST','ROCKWELL',
    'CAMELLA','AVIDA','AMAIA','FEDERAL',
]);

function extractPrice(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    // Try each line first (price alone on a line is unambiguous)
    for (const line of lines) {
        const lower = line.toLowerCase();
        let m = lower.match(/^(?:php|₱|p)?\s*(\d+\.?\d*)\s*m(?:illion)?(?:\b|$)/);
        if (m) return parseFloat(m[1]) * 1_000_000;
        m = line.replace(/,/g, '').match(/^(\d{7,9})$/);
        if (m) return parseFloat(m[1]);
    }
    // Fallback: scan full text
    const lower = text.toLowerCase();
    let m = lower.match(/(\d+\.?\d*)\s*m(?:illion)?(?:\b|$)/);
    if (m) return parseFloat(m[1]) * 1_000_000;
    m = text.replace(/,/g, '').match(/\b(\d{7,9})\b/);
    if (m) return parseFloat(m[1]);
    return null;
}

function extractUnit(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    // Check each line — a line with just "1BR" or "1 BEDROOM" is definitive
    for (const line of lines) {
        const lower = line.toLowerCase().trim();
        if (lower.match(/^studio$/)) return 'Studio';
        if (lower.match(/^1\s*br$|^1\s*bedroom$|^one\s*bedroom$/)) return '1BR';
        if (lower.match(/^2\s*br$|^2\s*bedroom$|^two\s*bedroom$/)) return '2BR';
        if (lower.match(/^3\s*br$|^3\s*bedroom$|^three\s*bedroom$/)) return '3BR';
        if (lower.match(/^4\s*br$|^4\s*bedroom$|^four\s*bedroom$/)) return '4BR';
    }
    // Fallback: inline detection
    const lower = text.toLowerCase();
    if (lower.match(/\bstudio\b/)) return 'Studio';
    if (lower.match(/\b1\s*br\b|1\s*bedroom|one\s*bedroom/)) return '1BR';
    if (lower.match(/\b2\s*br\b|2\s*bedroom|two\s*bedroom/)) return '2BR';
    if (lower.match(/\b3\s*br\b|3\s*bedroom|three\s*bedroom/)) return '3BR';
    if (lower.match(/\b4\s*br\b|4\s*bedroom|four\s*bedroom/)) return '4BR';
    return null;
}

function toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

const COMPANY_NAMES = [
    'alveo land corp', 'alveo land', 'alveo',
    'ayala land', 'ayala', 'smdc', 'avida', 'amaia',
    'dmci', 'rockwell', 'megaworld', 'federal land',
    'robinsons land', 'filinvest', 'century properties',
    'bgc', 'makati', 'pasig', 'taguig', 'mandaluyong',
    'quezon city', 'manila', 'alabang', 'ortigas',
];

// ── Learned project names persisted in localStorage ──
const LEARNED_KEY = 'realmate_detected_projects';

function getLearnedProjects() {
    try { return JSON.parse(localStorage.getItem(LEARNED_KEY)) || []; }
    catch { return []; }
}

function saveLearnedProject(name) {
    const list = getLearnedProjects();
    const lower = name.toLowerCase();
    const alreadyKnown = KNOWN_PROJECTS.some(p => p.toLowerCase() === lower);
    const alreadyLearned = list.some(p => p.toLowerCase() === lower);
    const isCompany = COMPANY_NAMES.some(c => lower === c);
    if (!alreadyKnown && !alreadyLearned && !isCompany && name.length >= 3) {
        list.push(name);
        localStorage.setItem(LEARNED_KEY, JSON.stringify(list));
    }
}

function allKnownProjects() {
    // Merge official list + learned list, longest-first for correct matching priority
    return [...KNOWN_PROJECTS, ...getLearnedProjects()]
        .sort((a, b) => b.length - a.length);
}

// Patterns that often precede a project name in listing text
const PROJECT_CONTEXT = /(?:project|tower|residences|suites|place|at|near|in|inside|unit\s+at|condo\s+at|property\s+at)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)/g;

function extractProject(text) {
    const lower = text.toLowerCase();
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

    // 1. Check each line against known projects first (line-by-line is most precise)
    for (const line of lines) {
        const lineLower = line.toLowerCase();
        for (const proj of allKnownProjects()) {
            if (lineLower === proj.toLowerCase() || lineLower.includes(proj.toLowerCase())) return proj;
        }
    }

    // 2. Fallback: check full text
    for (const proj of allKnownProjects()) {
        if (lower.includes(proj.toLowerCase())) return proj;
    }

    // 2. Context-aware: look for project names after trigger words
    let m;
    const contextRe = new RegExp(PROJECT_CONTEXT.source, 'gi');
    while ((m = contextRe.exec(text)) !== null) {
        const candidate = toTitleCase(m[1].trim());
        const isCompany = COMPANY_NAMES.some(c => candidate.toLowerCase() === c);
        if (!isCompany && candidate.split(' ').length >= 1 && candidate.length >= 4) {
            saveLearnedProject(candidate);
            return candidate;
        }
    }

    // 3. Fallback: scan line by line for standalone capitalized words
    //    that aren't company/location/unit tokens
    for (const line of lines) {
        const cleaned = line
            .replace(/\b\d+\s*BR\b/gi, '')
            .replace(/\bSTUDIO\b/gi, '')
            .replace(/\b\d+\s*BEDROOM\b/gi, '')
            .trim();
        if (!cleaned) continue;

        const words = cleaned.toUpperCase().split(/\s+/).filter(Boolean);
        // Filter out non-project tokens, company names, price tokens (e.g. 18M, 8.5M), numbers
        const projectWords = words.filter(w =>
            !NON_PROJECT_TOKENS.has(w) &&
            !COMPANY_NAMES.some(c => c.toUpperCase() === w) &&
            !/^\d+(\.\d+)?M?$/.test(w) &&   // price/number tokens
            !/^\d+$/.test(w)                 // pure numbers
        );
        if (!projectWords.length) continue;

        const candidate = toTitleCase(projectWords.join(' '));
        const isCompany = COMPANY_NAMES.some(c => candidate.toLowerCase() === c);
        if (!isCompany && candidate.length >= 3) {
            saveLearnedProject(candidate);
            return candidate;
        }
    }

    return null;
}

function buildMarketPrices(listings) {
    const buckets = {}; // key: "Project||Unit"

    listings.forEach(l => {
        const text = l.content || '';
        const price = extractPrice(text);
        const unit  = extractUnit(text);
        const proj  = extractProject(text);
        if (!price || !unit || !proj) return;

        // Skip company/developer names — not actual project names
        if (COMPANY_NAMES.some(c => proj.toLowerCase() === c)) return;
        const key = `${proj.toLowerCase()}||${unit.toLowerCase()}`;
        if (!buckets[key]) buckets[key] = { proj, unit, prices: [] };
        buckets[key].prices.push(price);
    });

    return Object.values(buckets)
        .map(b => {
            const avg = b.prices.reduce((s, p) => s + p, 0) / b.prices.length;
            const min = Math.min(...b.prices);
            const max = Math.max(...b.prices);
            return { ...b, avg, min, max, count: b.prices.length };
        })
        .sort((a, b) => a.proj.localeCompare(b.proj));
}

function formatPrice(n) {
    if (n >= 1_000_000) return '₱' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000)     return '₱' + (n / 1_000).toFixed(0) + 'K';
    return '₱' + n.toFixed(0);
}

function buildTicker(listings) {
    const items = buildMarketPrices(listings);
    const el = document.getElementById('tickerContent');
    if (!el) return;

    if (!items.length) {
        el.innerHTML = `<span class="ticker-loading">No market data yet — post listings to build the price index</span>`;
        el.style.animation = 'none';
        return;
    }

    // Build ticker HTML (doubled for seamless loop)
    function renderItems() {
        return items.map(item => {
            const spread = item.count > 1 && item.max > item.min
                ? `<span class="count">${formatPrice(item.min)} – ${formatPrice(item.max)}</span>`
                : '';
            const sampleCount = item.count > 1
                ? `<span class="count">${item.count} listings</span>`
                : '';
            return `
                <div class="ticker-item">
                    <span class="proj">${item.proj.toUpperCase()}</span>
                    <span class="unit">${item.unit}</span>
                    <span class="price">${formatPrice(item.avg)}</span>
                    ${spread}
                    ${sampleCount}
                </div>
                <span class="ticker-separator">·</span>
            `;
        }).join('');
    }

    // Duplicate content so the scroll loops seamlessly
    el.innerHTML = renderItems() + renderItems();

    // Adjust speed based on content length (more items = faster)
    const duration = Math.max(20, items.length * 8);
    el.style.animationDuration = duration + 's';
}

// ── State ─────────────────────────────────────────
let allListings = [];
let myListings = [];
let activeCategory = 'ALL'; // default: show all listings
let myListingsSubCat = 'ALL';

function selectCat(btn) {
    document.querySelectorAll('.chip:not(.chip-sub)').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    const subfilter = document.getElementById('myListingsSubfilter');
    if (subfilter) subfilter.style.display = activeCategory === 'MY_LISTINGS' ? 'flex' : 'none';
    applyFilters();
}

function selectSubCat(btn) {
    document.querySelectorAll('.chip-sub').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    myListingsSubCat = btn.dataset.sub;
    applyFilters();
}

// ── Smart AI Matching Engine ─────────────────────

const LOCATION_KEYWORDS = {
    'bgc': 'BGC', 'bonifacio': 'BGC', 'fort': 'BGC', 'taguig': 'Taguig',
    'makati': 'Makati', 'salcedo': 'Makati', 'legazpi': 'Makati', 'rockwell': 'Makati',
    'pasig': 'Pasig', 'ortigas': 'Pasig', 'eastwood': 'Pasig',
    'mandaluyong': 'Mandaluyong', 'quezon city': 'Quezon City', 'qc': 'Quezon City',
    'alabang': 'Alabang', 'muntinlupa': 'Muntinlupa', 'pasay': 'Pasay',
    'paranaque': 'Parañaque', 'parañaque': 'Parañaque',
    'las pinas': 'Las Piñas', 'las piñas': 'Las Piñas',
    'laguna': 'Laguna', 'cavite': 'Cavite', 'cebu': 'Cebu',
    'rizal': 'Rizal', 'bulacan': 'Bulacan', 'pampanga': 'Pampanga',
    'mckinley': 'BGC', 'mckinley hill': 'BGC', 'uptown': 'BGC',
};

const FEATURE_KEYWORDS = [
    'furnished', 'fully furnished', 'semi furnished', 'bare',
    'parking', 'with parking', 'no parking',
    'balcony', 'corner unit', 'penthouse', 'loft',
    'pool', 'gym', 'rfo', 'ready for occupancy', 'preselling', 'pre-selling',
    'high floor', 'low floor', 'mid floor',
    'pet friendly', 'smoking', 'non smoking',
];

function extractLocations(text) {
    const lower = text.toLowerCase();
    const found = new Set();
    Object.entries(LOCATION_KEYWORDS).forEach(([key, val]) => {
        if (lower.includes(key)) found.add(val);
    });
    return [...found];
}

function extractProject(text) {
    const upper = text.toUpperCase();
    for (const proj of KNOWN_PROJECTS) {
        if (upper.includes(proj.toUpperCase())) return proj;
    }
    return null;
}

function extractFeatures(text) {
    const lower = text.toLowerCase();
    return FEATURE_KEYWORDS.filter(f => lower.includes(f));
}

function extractBudgetRange(text) {
    const lower = text.toLowerCase().replace(/,/g, '');
    const prices = [];
    const patterns = [
        /(\d+\.?\d*)\s*m(?:illion)?/gi,
        /(?:₱|php|p)\s*(\d+\.?\d*)\s*m/gi,
        /\b(\d{7,9})\b/g,
        /(\d+)\s*k/gi,
    ];
    for (const pat of patterns) {
        let m;
        while ((m = pat.exec(lower)) !== null) {
            let val = parseFloat(m[1]);
            if (pat.source.includes('k')) val *= 1000;
            else if (pat.source.includes('m')) val *= 1_000_000;
            if (val > 0) prices.push(val);
        }
    }
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

function parseListing(listing) {
    const text = listing.content || '';
    return {
        id: listing.id,
        category: listing.category,
        locations: extractLocations(text),
        unit: extractUnit(text),
        project: extractProject(text),
        price: extractPrice(text),
        budget: extractBudgetRange(text),
        features: extractFeatures(text),
        userId: listing.user_id,
        raw: listing
    };
}

function computeMatchScore(mine, other) {
    let score = 0;
    let reasons = [];

    // Category must be complementary (required)
    const partnerCat = PARTNER_MAP[mine.category];
    if (!partnerCat || other.category !== partnerCat) return { score: 0, reasons: [] };
    score += 10;

    // Location match (high weight)
    if (mine.locations.length && other.locations.length) {
        const overlap = mine.locations.filter(l => other.locations.includes(l));
        if (overlap.length > 0) {
            score += 30;
            reasons.push(`Location: ${overlap.join(', ')}`);
        }
    }

    // Project match (very high weight)
    if (mine.project && other.project && mine.project.toLowerCase() === other.project.toLowerCase()) {
        score += 35;
        reasons.push(`Project: ${mine.project}`);
    }

    // Unit type match
    if (mine.unit && other.unit && mine.unit === other.unit) {
        score += 20;
        reasons.push(`Unit: ${mine.unit}`);
    }

    // Price/budget compatibility
    const sellerPrice = mine.category.includes('FOR') ? mine.price : other.price;
    const buyerBudget = mine.category.includes('WILLING') ? mine.budget : other.budget;
    if (sellerPrice && buyerBudget) {
        if (sellerPrice >= buyerBudget.min * 0.8 && sellerPrice <= buyerBudget.max * 1.2) {
            score += 25;
            reasons.push('Price in range');
        } else if (sellerPrice >= buyerBudget.min * 0.6 && sellerPrice <= buyerBudget.max * 1.5) {
            score += 10;
            reasons.push('Price close to range');
        }
    }

    // Feature overlap
    if (mine.features.length && other.features.length) {
        const common = mine.features.filter(f => other.features.includes(f));
        if (common.length > 0) {
            score += common.length * 5;
            reasons.push(`Features: ${common.join(', ')}`);
        }
    }

    return { score, reasons };
}

// Build a map: other listing id → which of my listings it matches
// Also builds myMatchCount: myListing.id → number of matches found
let myMatchCountMap = new Map();
function buildMatchMap() {
    const map = new Map();
    myMatchCountMap = new Map();

    const parsedMine = myListings.map(parseListing);
    const parsedAll = allListings.map(parseListing);

    parsedMine.forEach(mine => {
        let count = 0;
        parsedAll.forEach(other => {
            if (other.userId === mine.userId) return;
            const { score, reasons } = computeMatchScore(mine, other);
            if (score < 10) return; // no match at all

            const existing = map.get(other.id);
            if (!existing || existing.matchScore < score) {
                map.set(other.id, {
                    myCategory: mine.raw.category,
                    myContent: mine.raw.content,
                    myListing: mine.raw,
                    matchScore: score,
                    matchReasons: reasons
                });
            }
            count++;
        });
        if (count > 0) myMatchCountMap.set(mine.raw.id, count);
    });

    return map;
}

function applyLocationFilter() {
    const sel = document.getElementById('locationInput');
    const btn = document.getElementById('locationOkBtn');
    const wrap = sel?.closest('.location-wrap');
    const hasFilter = sel?.value !== '';
    if (btn)  btn.classList.toggle('applied', hasFilter);
    if (wrap) wrap.classList.toggle('active', hasFilter);
    applyFilters();
}

function applyFilters() {
    const q    = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const loc  = (document.getElementById('locationInput')?.value || '').toLowerCase().trim();
    const grid = document.getElementById('listingsGrid');
    if (!grid) return;

    const matchMap = buildMatchMap();
    const localUser = JSON.parse(localStorage.getItem('user'));

    let pool;
    const myUserId = myListings[0]?.user_id;
    const othersOnly = l => !myUserId || l.user_id !== myUserId;

    if (activeCategory === 'MATCHES') {
        pool = allListings.filter(l => othersOnly(l) && matchMap.has(l.id));
    } else if (activeCategory === 'MY_LISTINGS') {
        pool = allListings.filter(l => localUser && l.user_name === localUser.name);
        if (myListingsSubCat !== 'ALL') pool = pool.filter(l => l.category === myListingsSubCat);
    } else if (activeCategory === 'ALL') {
        pool = allListings.filter(othersOnly);
    } else {
        pool = allListings.filter(l => othersOnly(l) && l.category === activeCategory);
    }

    if (q)   pool = pool.filter(l => (l.content || '').toLowerCase().includes(q) || (l.user_name || '').toLowerCase().includes(q));
    if (loc) pool = pool.filter(l => (l.content || '').toLowerCase().includes(loc));

    grid.innerHTML = '';
    if (!pool.length) {
        const msg = activeCategory === 'MATCHES'
            ? 'No matches for your listings yet.<br><small>Post a listing on your profile and the AI will find partner listings here.</small>'
            : 'No listings found.<br><small>Try a different filter or search term.</small>';
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-satellite-dish"></i><p>${msg}</p></div>`;
        return;
    }

    // Pre-compute FMV for all FOR SALE listings
    const fmvMap = new Map();
    try {
        const forSaleListings = allListings.filter(l => l.category === 'FOR SALE');
        pool.forEach(l => {
            if (l.category === 'FOR SALE') {
                const result = calculateFMV(l, forSaleListings);
                if (result) fmvMap.set(l.id, result);
            }
        });
    } catch(e) { console.warn('FMV error:', e); }

    // Matches first (sorted by score), then others
    const matched   = pool.filter(l => matchMap.has(l.id))
        .sort((a, b) => (matchMap.get(b.id)?.matchScore || 0) - (matchMap.get(a.id)?.matchScore || 0));
    const unmatched = pool.filter(l => !matchMap.has(l.id));
    [...matched, ...unmatched].forEach(l => grid.appendChild(
        buildListingCard(l, matchMap.get(l.id) || null, fmvMap.get(l.id) || null, myMatchCountMap.get(l.id) || 0)
    ));
}

function selectCatByName(catName) {
    const chip = document.querySelector(`.chip[data-cat="${catName}"]`);
    if (chip) selectCat(chip);
}

// ── Load ledger ───────────────────────────────────
async function loadLedger() {
    const grid = document.getElementById('listingsGrid');
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading listings…</p></div>`;

    const localUser = JSON.parse(localStorage.getItem('user'));

    const [{ data, error }, { data: mine }] = await Promise.all([
        _sb.from('listings').select('*').eq('archived', false)
            .order('created_at', { ascending: false }),
        localUser
            ? _sb.from('listings').select('*').eq('archived', false).eq('user_id', (await _sb.auth.getUser()).data?.user?.id || '__none__')
            : Promise.resolve({ data: [] })
    ]);

    if (error || !data) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load listings</p></div>`;
        return;
    }

    allListings = data;
    myListings = mine || [];
    buildTicker(data);

    const learned = getLearnedProjects();
    if (learned.length) console.log('[Realmate] Auto-detected projects:', learned);

    applyFilters();
}

// ── AI Match view ─────────────────────────────────
function exitMatchView() {
    localStorage.removeItem('matchQuery');
    localStorage.removeItem('matchResults');
    document.getElementById('matchView').style.display = 'none';
    document.getElementById('ledgerView').style.display = '';
    const fb = document.querySelector('.filter-bar');
    if (fb) fb.style.display = '';
    loadLedger();
}

function showMatchView(query, matches) {
    document.getElementById('ledgerView').style.display = 'none';
    const fb = document.querySelector('.filter-bar');
    if (fb) fb.style.display = 'none';
    document.getElementById('matchView').style.display = 'block';

    // Your listing card
    const imgs = query.image_urls?.length ? query.image_urls : (query.image_url ? [query.image_url] : []);
    document.getElementById('yourListingCard').innerHTML = `
        ${catTag(query.category)}
        ${imgs.length ? `<img class="your-listing-img" src="${imgs[0]}">` : ''}
        <p class="your-listing-text">${safeText(query.content || query.text)}</p>
        <div class="ai-monitoring-strip">
            <i class="fas fa-satellite-dish"></i>
            AI Engine — live monitoring active
        </div>
    `;

    // Match count badge
    const badge = document.getElementById('matchCountBadge');
    badge.textContent = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;

    // Match cards
    const container = document.getElementById('matchesContainer');
    container.innerHTML = '';

    if (!matches.length) {
        container.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-satellite-dish"></i>
                <h3>No Matches Yet</h3>
                <p>The AI Engine will alert you when a partner listing enters the market.</p>
            </div>`;
        return;
    }

    matches.forEach(m => {
        const card = document.createElement('div');
        card.className = 'match-card';
        const matchImgs = m.image_urls?.length ? m.image_urls : (m.image_url || m.image ? [m.image_url || m.image] : []);
        card.innerHTML = `
            <div class="match-card-top">
                <div class="match-user">
                    <img src="${m.user_img || m.userImg || avatarFallback(m.user_name || m.userName)}"
                         onerror="this.src='${avatarFallback(m.user_name || m.userName)}'">
                    <div>
                        <div class="match-user-name">${m.user_name || m.userName || 'Unknown'}</div>
                        <div class="match-user-job">${m.user_job || m.userJob || ''}</div>
                    </div>
                </div>
                <div class="ai-verified-chip"><i class="fas fa-check-circle"></i> AI Match</div>
            </div>
            ${catTag(m.category)}
            <p class="match-card-text">${safeText(m.content || m.text)}</p>
            ${matchImgs.length ? `<img class="match-card-img" src="${matchImgs[0]}" loading="lazy">` : ''}
            ${mateButtonHtml(m.user_name || m.userName || '')}
        `;
        container.appendChild(card);
    });
}

// ── Init ──────────────────────────────────────────
async function init() {
    const query = JSON.parse(localStorage.getItem('matchQuery'));
    const results = JSON.parse(localStorage.getItem('matchResults'));

    if (query && results) {
        showMatchView(query, results);
    } else {
        await loadLedger();
    }
}

init();

// ── Post Listing Modal ────────────────────────────
let lmSelectedCat = null;
let lmImageFiles  = [];

function openPostModal() {
    document.getElementById('postModalOverlay').classList.add('open');
    document.getElementById('lmPostText').focus();
}

function closePostModal(e) {
    if (e && e.target !== document.getElementById('postModalOverlay')) return;
    document.getElementById('postModalOverlay').classList.remove('open');
    resetPostModal();
}

function resetPostModal() {
    lmSelectedCat = null;
    lmImageFiles  = [];
    document.querySelectorAll('.lm-cat-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('lmPostText').value = '';
    document.getElementById('lmImagePreview').innerHTML = '';
    document.getElementById('lmPostStatus').textContent = '';
    document.getElementById('lmPostStatus').className = 'lm-post-status';
    const toggle = document.getElementById('lmAnonToggle');
    if (toggle) { toggle.checked = false; }
    const row = document.getElementById('lmAnonRow');
    if (row) { row.classList.remove('active'); }
    const sub = document.getElementById('lmAnonSub');
    if (sub) { sub.textContent = 'Using your real identity'; }
}

document.getElementById('lmCatGrid').addEventListener('click', e => {
    const btn = e.target.closest('.lm-cat-btn');
    if (!btn) return;
    document.querySelectorAll('.lm-cat-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    lmSelectedCat = btn.dataset.cat;
});

const LM_MAX_IMAGES = 10;

function previewLMImages(input) {
    const selected = Array.from(input.files);
    if (selected.length > LM_MAX_IMAGES) {
        alert(`You can only upload up to ${LM_MAX_IMAGES} images. Only the first ${LM_MAX_IMAGES} will be used.`);
    }
    lmImageFiles = selected.slice(0, LM_MAX_IMAGES);

    const dt = new DataTransfer();
    lmImageFiles.forEach(f => dt.items.add(f));
    input.files = dt.files;

    const preview = document.getElementById('lmImagePreview');
    preview.innerHTML = '';

    const label = document.querySelector('.lm-img-label');
    const countBadge = label?.querySelector('.lm-img-count');
    if (countBadge) countBadge.remove();
    if (lmImageFiles.length > 0 && label) {
        const badge = document.createElement('span');
        badge.className = 'lm-img-count';
        badge.textContent = `${lmImageFiles.length}/${LM_MAX_IMAGES}`;
        label.appendChild(badge);
    }

    lmImageFiles.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = e => {
            const thumb = document.createElement('div');
            thumb.className = 'lm-thumb';
            thumb.innerHTML = `
                <img src="${e.target.result}">
                <button class="lm-thumb-remove" onclick="removeLMImage(${i})"><i class="fas fa-times"></i></button>
            `;
            preview.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    });
}

function removeLMImage(index) {
    lmImageFiles.splice(index, 1);
    const dt = new DataTransfer();
    lmImageFiles.forEach(f => dt.items.add(f));
    document.getElementById('lmPostImages').files = dt.files;
    previewLMImages(document.getElementById('lmPostImages'));
}

function toggleLMAnonMode() {
    const toggle = document.getElementById('lmAnonToggle');
    const row    = document.getElementById('lmAnonRow');
    const sub    = document.getElementById('lmAnonSub');
    const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
    if (toggle.checked) {
        if (!settings.anonName) {
            settings.anonName = generateAnonName();
            localStorage.setItem('userSettings', JSON.stringify(settings));
        }
        row.classList.add('active');
        sub.textContent = `Posting as "${settings.anonName}"`;
    } else {
        row.classList.remove('active');
        sub.textContent = 'Using your real identity';
    }
}

async function submitLMPost() {
    const status  = document.getElementById('lmPostStatus');
    const content = document.getElementById('lmPostText').value.trim();

    if (!lmSelectedCat) { status.className = 'lm-post-status error'; status.textContent = 'Please select a category.'; return; }
    if (!content)        { status.className = 'lm-post-status error'; status.textContent = 'Please write something about your listing.'; return; }

    const localUser = JSON.parse(localStorage.getItem('user'));
    if (!localUser)      { status.className = 'lm-post-status error'; status.textContent = 'You must be logged in to post.'; return; }

    const isAnon = false;

    const btn = document.getElementById('lmSubmitBtn');
    btn.disabled = true;
    status.className = 'lm-post-status';
    status.textContent = 'Posting…';

    try {
        // Upload images (compressed before upload)
        let imageUrls = [];
        if (lmImageFiles.length > 0) {
            const compressed = await compressImages(lmImageFiles);
            const uploads = compressed.map(async (file, i) => {
                const ext  = file.name.split('.').pop();
                const path = `listings/${Date.now()}_${i}.${ext}`;
                const { error } = await _sb.storage.from('images').upload(path, file, { upsert: true });
                if (error) throw error;
                return _sb.storage.from('images').getPublicUrl(path).data.publicUrl;
            });
            imageUrls = await Promise.all(uploads);
        }

        const { data: authData } = await _sb.auth.getUser();
        const postName = isAnon ? settings.anonName : localUser.name;
        const postImg  = isAnon
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(settings.anonName)}&background=0f172a&color=fff`
            : (localUser.image || '');
        const { error } = await _sb.from('listings').insert({
            user_id:      authData?.user?.id,
            user_name:    postName,
            user_job:     isAnon ? '' : (localUser.job || ''),
            user_img:     postImg,
            category:     lmSelectedCat,
            content,
            image_urls:   imageUrls.length ? imageUrls : null,
            is_anonymous: isAnon,
            archived:     false,
            pinned:       false
        });

        if (error) throw error;

        status.className = 'lm-post-status success';
        status.textContent = '✅ Posted successfully!';
        setTimeout(() => {
            closePostModal(null);
            resetPostModal();
            loadLedger();
        }, 1000);
    } catch (err) {
        status.className = 'lm-post-status error';
        status.textContent = '❌ ' + (err.message || 'Failed to post.');
    } finally {
        btn.disabled = false;
    }
}

// ── Load YouTube embed with IFrame API for full volume ──
let _ytPlayer = null;

function onYouTubeIframeAPIReady() {
    // Called by YouTube API script — player created after video ID is known
}

function updateFilterBarTop() {
    const ticker  = document.querySelector('.ticker-wrap');
    const stickyBar = document.querySelector('.sticky-ticker-bar');
    const filterBar = document.querySelector('.filter-bar');
    if (!filterBar) return;
    const t = (ticker?.offsetHeight || 0) + (stickyBar?.offsetHeight || 0);
    filterBar.style.top = t + 'px';
}

async function renderMarketReportPdf() {
    const { data, error: dbErr } = await _sb.from('site_settings').select('value').eq('key', 'market_report_pdf').single();
    if (dbErr || !data?.value) {
        console.warn('No PDF URL in site_settings:', dbErr);
        return;
    }

    const wrap  = document.getElementById('pdfStripWrap');
    const strip = document.getElementById('pdfPageStrip');
    if (!wrap || !strip) return;

    const pdfUrl = data.value.split('?')[0];

    const lib = window.pdfjsLib;
    if (!lib) {
        console.error('PDF.js (pdfjsLib) not found on window — check CDN script');
        return;
    }

    lib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Respect user preference
    if (localStorage.getItem('rm_hide_pdf') === '1') return;

    // Show a loading placeholder immediately
    wrap.style.display = 'flex';
    const loader = document.createElement('div');
    loader.id = 'pdfLoader';
    loader.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b;padding:4px 0;';
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading report…';
    strip.appendChild(loader);
    updateFilterBarTop();

    try {
        // Fetch as ArrayBuffer — avoids CORS issues with the PDF.js worker
        const resp = await fetch(pdfUrl);
        if (!resp.ok) throw new Error('Fetch failed: HTTP ' + resp.status);
        const arrayBuffer = await resp.arrayBuffer();

        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        _pdfDoc = pdf;
        const PAGE_H = 126;

        loader.remove();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page   = await pdf.getPage(i);
            const baseVp = page.getViewport({ scale: 1 });
            const scale  = PAGE_H / baseVp.height;
            const vp     = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const ctx    = canvas.getContext('2d');
            const dpr    = window.devicePixelRatio || 1;
            canvas.width  = Math.floor(vp.width  * dpr);
            canvas.height = Math.floor(vp.height * dpr);
            canvas.style.width  = Math.floor(vp.width)  + 'px';
            canvas.style.height = Math.floor(vp.height) + 'px';
            canvas.style.borderRadius = '8px';
            canvas.style.flexShrink  = '0';
            canvas.style.border      = '1px solid #e2e8f0';
            canvas.style.boxShadow   = '0 2px 8px rgba(0,0,0,0.10)';
            canvas.title = 'Click to open full view';
            canvas.style.cursor = 'pointer';
            ctx.scale(dpr, dpr);

            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            canvas.addEventListener('click', openPdfViewer);
            strip.appendChild(canvas);
        }

        // Store URL for download
        window._pdfDownloadUrl = pdfUrl;

        wrap.style.display = 'flex';
        updateFilterBarTop();
    } catch (e) {
        console.error('PDF render error:', e);
        loader.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Could not load report';
    }
}

// ── PDF Viewer Modal ──────────────────────────────────
let _pdfDoc = null; // store reference for modal rendering

async function openPdfViewer() {
    const lb    = document.getElementById('pdfLightbox');
    const pages = document.getElementById('pdfLbPages');
    if (!lb || !pages || !_pdfDoc) return;

    pages.innerHTML = '<div style="color:#fff; display:flex; align-items:center; gap:10px; padding:40px;"><i class="fas fa-spinner fa-spin"></i> Loading pages…</div>';
    lb.style.display = 'block';
    lb.scrollTop = 0;

    pages.innerHTML = '';
    const isMobile = window.innerWidth <= 640;
    const maxW = isMobile ? window.innerWidth : Math.min(window.innerWidth * 0.88, 860);
    const dpr  = window.devicePixelRatio || 1;

    for (let i = 1; i <= _pdfDoc.numPages; i++) {
        const page   = await _pdfDoc.getPage(i);
        const baseVp = page.getViewport({ scale: 1 });
        const scale  = maxW / baseVp.width;
        const vp     = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');
        canvas.width  = Math.floor(vp.width  * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width  = Math.floor(vp.width)  + 'px';
        canvas.style.height = Math.floor(vp.height) + 'px';
        canvas.style.cssText += '; border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,0.4); display:block;';
        ctx.scale(dpr, dpr);

        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        pages.appendChild(canvas);
    }
}

function closePdfLightbox() {
    document.getElementById('pdfLightbox').style.display = 'none';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closePdfLightbox(); });

async function downloadPdf() {
    const url = window._pdfDownloadUrl;
    if (!url) return;
    try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'market-report.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) {
        console.error('Download failed:', e);
    }
}

// PDF.js script is loaded before livemarket.js so pdfjsLib is already available
renderMarketReportPdf();

(async function loadYoutubeEmbed() {
    const { data } = await _sb.from('site_settings').select('value').eq('key', 'youtube_url').single();
    if (!data?.value) return;
    if (localStorage.getItem('rm_hide_video') === '1') return;
    try {
        const u = new URL(data.value);
        let videoId = null;
        if (u.hostname.includes('youtu.be')) {
            videoId = u.pathname.slice(1);
        } else if (u.hostname.includes('youtube.com')) {
            if (u.pathname === '/watch') videoId = u.searchParams.get('v');
            else if (u.pathname.startsWith('/live/')) videoId = u.pathname.split('/live/')[1].split('?')[0];
            else if (u.pathname.startsWith('/embed/')) videoId = u.pathname.split('/embed/')[1].split('?')[0];
        }
        if (!videoId) return;

        const section = document.getElementById('ytEmbedSection');
        section.style.display = 'block';

        // Load YouTube IFrame API
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);

        // Override the global callback
        window.onYouTubeIframeAPIReady = function() {
            _ytPlayer = new YT.Player('ytEmbedFrame', {
                videoId,
                width: '100%',
                height: '100%',
                playerVars: { autoplay: 1, mute: 0, rel: 0, modestbranding: 1, playsinline: 1 },
                events: {
                    onReady: function(e) {
                        const autoMute = localStorage.getItem('rm_automute_video') === '1';
                        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                        if (!autoMute && !isMobile) {
                            try { e.target.unMute(); e.target.setVolume(100); } catch {}
                        }
                        if (isMobile && !autoMute) {
                            _ytMuted = true;
                            const btn = document.getElementById('ytMuteBtn');
                            if (btn) btn.innerHTML = '<i class="fas fa-volume-xmark"></i>';
                            const hint = document.getElementById('ytMuteHint');
                            if (hint) hint.style.display = 'block';
                        }
                        updateFilterBarTop();
                    },
                    onStateChange: function(e) {
                    }
                }
            });
        };

        updateFilterBarTop();
        window.addEventListener('resize', updateFilterBarTop);
    } catch {}
})();

// Sync top padding on mobile for fixed header
(function() {
    const wrap = document.querySelector('.top-fixed-wrap');
    if (!wrap) return;
    function sync() {
        document.documentElement.style.setProperty('--top-fixed-height', wrap.offsetHeight + 'px');
    }
    sync();
    window.addEventListener('resize', sync);
    setTimeout(sync, 500);
})();

// ── Video controls ──
let _ytMuted = false;
function toggleYtMute(btn) {
    if (!_ytPlayer) return;
    _ytMuted = !_ytMuted;
    if (_ytMuted) {
        _ytPlayer.mute();
    } else {
        _ytPlayer.unMute();
        _ytPlayer.setVolume(100);
    }
    btn.innerHTML = _ytMuted ? '<i class="fas fa-volume-xmark"></i>' : '<i class="fas fa-volume-high"></i>';
    if (!_ytMuted) {
        const hint = document.getElementById('ytMuteHint');
        if (hint) hint.style.display = 'none';
    }
}
function closeYtVideo() {
    document.getElementById('ytEmbedSection').style.display = 'none';
    if (_ytPlayer) try { _ytPlayer.stopVideo(); } catch {}

    updateFilterBarTop();
}

// ── Apply user preferences from settings ──
(function applyMarketPrefs() {
    const hideVideo  = localStorage.getItem('rm_hide_video')  === '1';
    const hidePdf    = localStorage.getItem('rm_hide_pdf')    === '1';
    const hideGraphs = localStorage.getItem('rm_show_graphs') === '0';

    if (hideVideo) {
        document.getElementById('ytEmbedSection').style.display = 'none';
    }
    if (localStorage.getItem('rm_hide_ticker') === '1') {
        const t = document.getElementById('tickerWrap');
        if (t) t.style.display = 'none';
    }

    // If video, PDF and graphs are all hidden, collapse the entire sticky bar
    if (hideVideo && hidePdf && hideGraphs) {
        const bar = document.querySelector('.sticky-ticker-bar');
        if (bar) bar.style.display = 'none';
        const tabs = document.querySelector('.market-main-tabs');
        if (tabs) tabs.style.top = '40px';
    }
    setTimeout(updateFilterBarTop, 100);
})();

