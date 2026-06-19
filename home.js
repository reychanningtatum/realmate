// ── Supabase ──────────────────────────────────────
const SUPABASE_URL = "https://wmegpgrfrtprhuzmgjma.supabase.co";
const SUPABASE_KEY = "sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4";
const _supaHome = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Current user ──────────────────────────────────
const isGuest = localStorage.getItem("isGuest") === "true";
function getUser() {
    return JSON.parse(localStorage.getItem("user")) || null;
}

// ── Helpers ───────────────────────────────────────
function safeText(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

function timeAgo(ts) {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

function avatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=0f172a&color=32cd32`;
}

function handleAuth() {
    localStorage.clear();
    localStorage.setItem("isGuest", "false");
    location.href = "index.html";
}

function initGuestUI() {
    if (!isGuest) return;
    const navPortfolio = document.getElementById("navPortfolio");
    const navMatches   = document.getElementById("navMatches");
    if (navPortfolio) navPortfolio.style.display = "none";
    if (navMatches)   navMatches.style.display   = "none";
    if (authText)     authText.innerText          = "Login / Sign Up";
}

// ── Init user avatar in create post ──────────────
function initCreatePost() {
    const user = getUser();
    if (!user) return;
    const el = document.getElementById('createPostAvatar');
    if (!el) return;
    if (user.image) {
        el.style.background = `url('${user.image}') center/cover no-repeat`;
        el.innerHTML = '';
    } else {
        el.style.background = '#0f172a';
        el.innerHTML = `<span style="color:#32cd32;font-size:15px;font-weight:700;">${(user.name||'U').charAt(0).toUpperCase()}</span>`;
    }
}

// ══════════════════════════════════════════════════
//  STORIES
// ══════════════════════════════════════════════════

let _allStories = [];
let _storyViewerIdx = 0;
let _storyViewerTimer = null;

async function loadStories() {
    const strip = document.getElementById('storiesStrip');
    if (!strip) return;

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: stories, error } = await _supaHome
        .from('stories')
        .select('id, user_id, image_url, created_at, user_name, user_img')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });

    if (error) {
        // stories table may not exist yet — hide the section silently
        document.getElementById('storiesWrap')?.style.setProperty('display', 'none');
        return;
    }

    _allStories = stories || [];

    // Group by user
    const byUser = new Map();
    _allStories.forEach(s => {
        if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
        byUser.get(s.user_id).push(s);
    });

    // Keep add-story button, rebuild the rest
    const addBtn = strip.querySelector('.story-add-btn');
    strip.innerHTML = '';
    if (addBtn) strip.appendChild(addBtn);

    const user = getUser();
    let storyIndex = 0;
    byUser.forEach((userStories, uid) => {
        const first = userStories[0];
        const name  = first.user_name || 'Member';
        const img   = first.user_img  || avatarUrl(name);
        const isMine = user && first.user_id === (user.supabaseId || uid);
        const card = document.createElement('div');
        card.className = 'story-card' + (isMine ? ' my-story' : '');
        card.dataset.storyIndex = storyIndex;
        card.innerHTML = `
            <div class="story-img-wrap">
                <img src="${first.image_url}" loading="lazy">
                <div class="story-ring"></div>
            </div>
            <div class="story-avatar-wrap">
                <img src="${img}" onerror="this.src='${avatarUrl(name)}'">
            </div>
            <span class="story-name">${safeText(name.split(' ')[0])}</span>
        `;
        card.addEventListener('click', () => openStoryViewer(storyIndex));
        strip.appendChild(card);
        storyIndex++;
    });
}

function openAddStory() {
    document.getElementById('storyModalOverlay').classList.add('open');
}

function closeAddStory(e) {
    if (e && e.target !== document.getElementById('storyModalOverlay')) return;
    document.getElementById('storyModalOverlay').classList.remove('open');
    document.getElementById('storyImageInput').value = '';
    document.getElementById('storyPreview').style.display = 'none';
    document.getElementById('storyPreview').src = '';
    document.getElementById('storyStatus').textContent = '';
    document.getElementById('storySubmitBtn').disabled = true;
    const area = document.getElementById('storyUploadArea');
    if (area) area.style.display = 'flex';
}

function previewStoryImage(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById('storyPreview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        document.getElementById('storyUploadArea').style.display = 'none';
        document.getElementById('storySubmitBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

async function submitStory() {
    const btn    = document.getElementById('storySubmitBtn');
    const status = document.getElementById('storyStatus');
    const input  = document.getElementById('storyImageInput');
    const user   = getUser();

    if (!user || !input.files[0]) return;
    btn.disabled = true;
    status.textContent = 'Uploading…';

    try {
        const { data: authData } = await _supaHome.auth.getUser();
        const uid = authData?.user?.id;

        const file = input.files[0];
        const path = `stories/${uid || 'anon'}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadErr } = await _supaHome.storage.from('images').upload(path, file, { upsert: true });
        if (uploadErr) throw uploadErr;

        const imageUrl = _supaHome.storage.from('images').getPublicUrl(path).data.publicUrl;

        const { error: insertErr } = await _supaHome.from('stories').insert({
            user_id:   uid,
            user_name: user.name,
            user_img:  user.image || '',
            image_url: imageUrl
        });
        if (insertErr) throw insertErr;

        status.textContent = '✅ Story shared!';
        setTimeout(() => { closeAddStory(); loadStories(); }, 800);
    } catch (err) {
        status.textContent = '❌ ' + (err.message || 'Upload failed');
        btn.disabled = false;
    }
}

function openStoryViewer(groupIndex) {
    const groups = [...document.querySelectorAll('.story-card')];
    if (!groups.length) return;
    _storyViewerIdx = groupIndex;
    renderStoryViewer();
    document.getElementById('storyViewerOverlay').classList.add('open');
    startStoryTimer();
}

function renderStoryViewer() {
    const cards = [...document.querySelectorAll('.story-card')];
    const card  = cards[_storyViewerIdx];
    if (!card) return;
    const idx   = parseInt(card.dataset.storyIndex);
    const img   = card.querySelector('.story-img-wrap img')?.src || '';
    const name  = card.querySelector('.story-name')?.textContent || '';
    const avatarSrc = card.querySelector('.story-avatar-wrap img')?.src || '';

    document.getElementById('storyViewerImg').src = img;
    document.getElementById('storyViewerUser').innerHTML = `
        <img src="${avatarSrc}">
        <div>
            <strong>${safeText(name)}</strong>
            <small>${timeAgo((_allStories[idx] || {}).created_at)}</small>
        </div>
    `;

    const total = cards.length;
    document.getElementById('storyViewerProgress').innerHTML = Array.from({ length: total }, (_, i) =>
        `<div class="sv-prog-bar${i === _storyViewerIdx ? ' active' : (i < _storyViewerIdx ? ' done' : '')}"></div>`
    ).join('');

    document.getElementById('storyNavPrev').style.display = _storyViewerIdx > 0 ? 'flex' : 'none';
    document.getElementById('storyNavNext').style.display = _storyViewerIdx < total - 1 ? 'flex' : 'none';
}

function navigateStory(dir) {
    clearTimeout(_storyViewerTimer);
    const total = document.querySelectorAll('.story-card').length;
    _storyViewerIdx = Math.max(0, Math.min(total - 1, _storyViewerIdx + dir));
    renderStoryViewer();
    startStoryTimer();
}

function startStoryTimer() {
    clearTimeout(_storyViewerTimer);
    _storyViewerTimer = setTimeout(() => {
        const total = document.querySelectorAll('.story-card').length;
        if (_storyViewerIdx < total - 1) navigateStory(1);
        else closeStoryViewer();
    }, 5000);
}

function closeStoryViewer() {
    clearTimeout(_storyViewerTimer);
    document.getElementById('storyViewerOverlay').classList.remove('open');
}

// ══════════════════════════════════════════════════
//  CREATE POST
// ══════════════════════════════════════════════════

let _homePostFiles = [];

let _homePostType = '';

const _postTypeConfig = {
    achievement: {
        subject: 'Achievement',
        placeholder: 'Share your win — closed a deal, hit a target, earned recognition…',
        badge: '<i class="fas fa-trophy" style="color:#f59e0b;margin-right:6px;"></i> Achievement Post',
        badgeBg: '#fffbeb',
        badgeBorder: '#fde68a',
        badgeColor: '#92400e'
    },
    thought: {
        subject: 'Thought',
        placeholder: 'Share an insight, opinion, or industry observation…',
        badge: '<i class="fas fa-lightbulb" style="color:#6366f1;margin-right:6px;"></i> Thought Post',
        badgeBg: '#eef2ff',
        badgeBorder: '#c7d2fe',
        badgeColor: '#3730a3'
    }
};

function expandCreatePost(type) {
    _homePostType = type || '';
    const textarea = document.getElementById('homePostText');
    const badge = document.getElementById('postTypeBadge');
    const cfg = _postTypeConfig[_homePostType];

    if (cfg) {
        textarea.placeholder = cfg.placeholder;
        badge.innerHTML = `<span style="display:inline-flex;align-items:center;font-size:12px;font-weight:700;padding:5px 12px;border-radius:50px;background:${cfg.badgeBg};border:1px solid ${cfg.badgeBorder};color:${cfg.badgeColor};">${cfg.badge}</span>`;
        badge.style.display = 'block';
    } else {
        textarea.placeholder = "What's on your mind?";
        badge.style.display = 'none';
    }

    if (type === 'photo') {
        document.getElementById('homePostMedia')?.click();
    }

    document.querySelector('.create-post-top').style.display = 'none';
    document.querySelector('.create-post-shortcuts').style.display = 'none';
    document.getElementById('createPostExpanded').style.display = 'block';
    textarea.focus();
}

function setPostType(type) {
    _homePostType = (_homePostType === type) ? '' : type;
    const textarea = document.getElementById('homePostText');
    const badge = document.getElementById('postTypeBadge');
    const cfg = _postTypeConfig[_homePostType];
    if (cfg) {
        textarea.placeholder = cfg.placeholder;
        badge.innerHTML = `<span style="display:inline-flex;align-items:center;font-size:12px;font-weight:700;padding:5px 12px;border-radius:50px;background:${cfg.badgeBg};border:1px solid ${cfg.badgeBorder};color:${cfg.badgeColor};">${cfg.badge} <i class="fas fa-times" style="margin-left:8px;font-size:10px;cursor:pointer;opacity:0.6;" onclick="setPostType('${_homePostType}')"></i></span>`;
        badge.style.display = 'block';
    } else {
        textarea.placeholder = "What's on your mind?";
        badge.style.display = 'none';
    }
    textarea.focus();
}

function collapseCreatePost() {
    _homePostType = '';
    document.getElementById('createPostExpanded').style.display = 'none';
    document.getElementById('postTypeBadge').style.display = 'none';
    document.querySelector('.create-post-top').style.display = '';
    document.querySelector('.create-post-shortcuts').style.display = '';
    document.getElementById('homePostText').value = '';
    document.getElementById('homePostMediaPreview').innerHTML = '';
    _homePostFiles = [];
}

function previewHomeMedia(input) {
    _homePostFiles = Array.from(input.files);
    const preview = document.getElementById('homePostMediaPreview');
    preview.innerHTML = '';
    _homePostFiles.forEach((file, i) => {
        const isVideo = file.type.startsWith('video/');
        const el = document.createElement('div');
        el.className = 'home-post-thumb';
        if (isVideo) {
            const url = URL.createObjectURL(file);
            el.innerHTML = `<video src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></video>
                <button class="home-thumb-remove" onclick="removeHomeMedia(${i})"><i class="fas fa-times"></i></button>`;
        } else {
            const reader = new FileReader();
            reader.onload = e => {
                el.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">
                    <button class="home-thumb-remove" onclick="removeHomeMedia(${i})"><i class="fas fa-times"></i></button>`;
            };
            reader.readAsDataURL(file);
        }
        preview.appendChild(el);
    });
}

function removeHomeMedia(i) {
    _homePostFiles.splice(i, 1);
    const dt = new DataTransfer();
    _homePostFiles.forEach(f => dt.items.add(f));
    document.getElementById('homePostMedia').files = dt.files;
    previewHomeMedia(document.getElementById('homePostMedia'));
}

async function submitHomePost() {
    const text = document.getElementById('homePostText').value.trim();
    if (!text && !_homePostFiles.length) return;

    const user = getUser();
    if (!user) return;

    const submitBtn = document.querySelector('.create-post-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const { data: authData } = await _supaHome.auth.getUser();
        let imageUrls = [], videoUrl = null;

        for (const file of _homePostFiles) {
            const isVideo = file.type.startsWith('video/');
            const path = `posts/${Date.now()}_${file.name}`;
            const { error } = await _supaHome.storage.from('images').upload(path, file, { upsert: true });
            if (error) throw error;
            const url = _supaHome.storage.from('images').getPublicUrl(path).data.publicUrl;
            if (isVideo) videoUrl = url;
            else imageUrls.push(url);
        }

        const postSubject = _postTypeConfig[_homePostType]?.subject || '';

        const { error: insertErr } = await _supaHome.from('forum_posts').insert({
            user_id:   authData?.user?.id,
            user_name: user.name,
            user_img:  user.image || '',
            subject:   postSubject,
            content:   text,
            media_url: videoUrl || imageUrls[0] || null,
            media_type: videoUrl ? 'video' : (imageUrls[0] ? 'image' : null),
            is_anonymous: false
        });
        if (insertErr) throw insertErr;

        collapseCreatePost();
        loadHomeFeed();
    } catch (err) {
        alert('Failed to post: ' + (err.message || 'Unknown error'));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
    }
}

// ══════════════════════════════════════════════════
//  HOME FEED (from forum_posts)
// ══════════════════════════════════════════════════

let _homePosts = [];

async function loadHomeFeed() {
    const feed = document.getElementById('homeFeed');
    if (!feed) return;
    feed.innerHTML = `<div class="hf-loading"><i class="fas fa-spinner fa-spin"></i> Loading feed…</div>`;

    try {
        const { data: posts, error } = await _supaHome
            .from('forum_posts')
            .select('id, user_id, user_name, user_img, subject, content, media_url, media_type, created_at, is_anonymous')
            .order('created_at', { ascending: false })
            .limit(40);

        if (error) throw error;

        _homePosts = posts || [];
        if (!_homePosts.length) {
            feed.innerHTML = `<div class="hf-empty">
                <i class="fas fa-newspaper"></i>
                <p>No posts yet. Be the first to share something!</p>
            </div>`;
            return;
        }

        // Load like counts & whether current user liked each post
        const user = getUser();
        const postIds = _homePosts.map(p => p.id);

        const { data: likes } = await _supaHome
            .from('forum_likes')
            .select('post_id, user_name')
            .in('post_id', postIds);

        const likeMap = {};
        const userLikedSet = new Set();
        (likes || []).forEach(l => {
            likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
            if (user && l.user_name === user.name) userLikedSet.add(l.post_id);
        });

        // Load comment counts
        const { data: comments } = await _supaHome
            .from('forum_comments')
            .select('post_id')
            .in('post_id', postIds);

        const commentMap = {};
        (comments || []).forEach(c => { commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1; });

        feed.innerHTML = '';
        _homePosts.forEach(post => {
            const card = buildHomePostCard(post, likeMap[post.id] || 0, userLikedSet.has(post.id), commentMap[post.id] || 0);
            feed.appendChild(card);
        });

    } catch (err) {
        console.error('Home feed error:', err);
        feed.innerHTML = `<div class="hf-empty">
            <i class="fas fa-circle-exclamation" style="color:#ef4444;"></i>
            <p>Could not load feed. Please refresh.</p>
        </div>`;
    }
}

function buildHomePostCard(post, likeCount, userLiked, commentCount) {
    const user    = getUser();
    const isAnon  = post.is_anonymous;
    const name    = isAnon ? 'Anonymous' : (post.user_name || 'Realmate Member');
    const img     = isAnon ? avatarUrl('Anon') : (post.user_img || avatarUrl(name));
    const isOwn   = user && (post.user_name === user.name || post.user_id === user.supabaseId);

    const mediaHtml = buildPostMedia(post);

    const card = document.createElement('div');
    card.className = 'hf-post-card';
    card.id = `hfpost-${post.id}`;
    card.innerHTML = `
        <div class="hf-post-header">
            <img class="hf-post-avatar" src="${img}" onerror="this.src='${avatarUrl(name)}'">
            <div class="hf-post-meta">
                <div class="hf-post-name">${safeText(name)}</div>
                <div class="hf-post-time">${timeAgo(post.created_at)}</div>
            </div>
            ${isOwn ? `<button class="hf-post-menu-btn" onclick="togglePostMenu('${post.id}')"><i class="fas fa-ellipsis-h"></i></button>
            <div class="hf-post-menu" id="hfmenu-${post.id}" style="display:none;">
                <div onclick="deleteHomePost('${post.id}')"><i class="fas fa-trash"></i> Delete</div>
            </div>` : ''}
        </div>
        ${post.subject === 'Achievement' ? `<div style="margin:6px 0 4px;"><span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:4px 10px;border-radius:50px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;"><i class="fas fa-trophy" style="color:#f59e0b;margin-right:5px;"></i>Achievement</span></div>`
            : post.subject === 'Thought' ? `<div style="margin:6px 0 4px;"><span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:4px 10px;border-radius:50px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;"><i class="fas fa-lightbulb" style="color:#6366f1;margin-right:5px;"></i>Thought</span></div>`
            : post.subject ? `<div class="hf-post-subject">${safeText(post.subject)}</div>` : ''}
        ${post.content ? `<div class="hf-post-text">${safeText(post.content)}</div>` : ''}
        ${mediaHtml}
        <div class="hf-post-stats">
            ${likeCount > 0 ? `<span><i class="fas fa-thumbs-up" style="color:var(--primary);"></i> ${likeCount}</span>` : ''}
            ${commentCount > 0 ? `<span style="margin-left:auto;">${commentCount} comment${commentCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="hf-post-actions">
            <button class="hf-action-btn${userLiked ? ' liked' : ''}" id="hflike-${post.id}" onclick="toggleHomelike('${post.id}', this)">
                <i class="${userLiked ? 'fas' : 'far'} fa-thumbs-up"></i> Like
            </button>
            <button class="hf-action-btn" onclick="toggleHomeComments('${post.id}')">
                <i class="far fa-comment"></i> Comment
            </button>
        </div>
        <div class="hf-comments-section" id="hfcomments-${post.id}" style="display:none;">
            <div class="hf-comment-input-wrap">
                <div class="hf-comment-avatar" id="hfcavatar-${post.id}"></div>
                <input type="text" class="hf-comment-input" id="hfcinput-${post.id}" placeholder="Write a comment…"
                    onkeydown="if(event.key==='Enter') submitHomeComment('${post.id}')">
                <button onclick="submitHomeComment('${post.id}')"><i class="fas fa-paper-plane"></i></button>
            </div>
            <div class="hf-comments-list" id="hfclist-${post.id}">
                <div class="hf-comments-loading"><i class="fas fa-spinner fa-spin"></i></div>
            </div>
        </div>
    `;
    return card;
}

function buildPostMedia(post) {
    if (!post.media_url) return '';

    if (post.media_type === 'video') {
        return `<div class="hf-post-media">
            <video controls src="${post.media_url}" style="width:100%;border-radius:12px;max-height:400px;"></video>
        </div>`;
    }
    const imgs = [post.media_url];
    if (imgs.length === 1) {
        return `<div class="hf-post-media">
            <img src="${imgs[0]}" style="width:100%;border-radius:12px;max-height:500px;object-fit:cover;cursor:pointer;"
                onclick="openHomeImgLightbox('${imgs[0]}')">
        </div>`;
    }
    return `<div class="hf-post-media hf-img-grid">
        ${imgs.map(u => `<img src="${u}" onclick="openHomeImgLightbox('${u}')">`).join('')}
    </div>`;
}

function togglePostMenu(postId) {
    const menu = document.getElementById(`hfmenu-${postId}`);
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    const close = e => { menu.style.display = 'none'; document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 10);
}

async function deleteHomePost(postId) {
    if (!confirm('Delete this post?')) return;
    await _supaHome.from('forum_posts').delete().eq('id', postId);
    document.getElementById(`hfpost-${postId}`)?.remove();
}

// ── Likes ─────────────────────────────────────────
async function toggleHomelike(postId, btn) {
    const user = getUser();
    if (!user) return;
    const liked = btn.classList.contains('liked');
    if (liked) {
        await _supaHome.from('forum_likes').delete().eq('post_id', postId).eq('user_name', user.name);
        btn.classList.remove('liked');
        btn.querySelector('i').className = 'far fa-thumbs-up';
    } else {
        await _supaHome.from('forum_likes').insert({ post_id: postId, user_name: user.name });
        btn.classList.add('liked');
        btn.querySelector('i').className = 'fas fa-thumbs-up';
    }
    // Refresh like count in stats
    const { data } = await _supaHome.from('forum_likes').select('id', { count: 'exact' }).eq('post_id', postId);
    const count = data?.length || 0;
    const stats = document.querySelector(`#hfpost-${postId} .hf-post-stats`);
    if (stats) {
        const likeSpan = stats.querySelector('span:first-child');
        if (count > 0) {
            if (likeSpan) likeSpan.innerHTML = `<i class="fas fa-thumbs-up" style="color:var(--primary);"></i> ${count}`;
            else stats.insertAdjacentHTML('afterbegin', `<span><i class="fas fa-thumbs-up" style="color:var(--primary);"></i> ${count}</span>`);
        } else if (likeSpan) likeSpan.remove();
    }
}

// ── Comments ──────────────────────────────────────
async function toggleHomeComments(postId) {
    const section = document.getElementById(`hfcomments-${postId}`);
    if (!section) return;
    const isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        initCommentAvatar(postId);
        await loadHomeComments(postId);
    }
}

function initCommentAvatar(postId) {
    const user = getUser();
    const el   = document.getElementById(`hfcavatar-${postId}`);
    if (!el || !user) return;
    if (user.image) {
        el.style.background = `url('${user.image}') center/cover no-repeat`;
    } else {
        el.style.background = '#0f172a';
        el.textContent = (user.name || 'U').charAt(0).toUpperCase();
        el.style.color = '#32cd32';
    }
}

async function loadHomeComments(postId) {
    const list = document.getElementById(`hfclist-${postId}`);
    if (!list) return;

    const { data: comments } = await _supaHome
        .from('forum_comments')
        .select('id, user_name, user_img, content, created_at, parent_id')
        .eq('post_id', postId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

    if (!comments?.length) {
        list.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:8px 0;">No comments yet.</div>';
        return;
    }
    list.innerHTML = comments.map(c => buildCommentHtml(c, postId)).join('');
}

function buildCommentHtml(c, postId) {
    const img = c.user_img || avatarUrl(c.user_name);
    return `
        <div class="hf-comment">
            <img class="hf-comment-avatar-img" src="${img}" onerror="this.src='${avatarUrl(c.user_name)}'">
            <div class="hf-comment-body">
                <div class="hf-comment-name">${safeText(c.user_name || 'Member')}</div>
                <div class="hf-comment-text">${safeText(c.content)}</div>
                <div class="hf-comment-time">${timeAgo(c.created_at)}</div>
            </div>
        </div>`;
}

async function submitHomeComment(postId) {
    const input = document.getElementById(`hfcinput-${postId}`);
    const user  = getUser();
    if (!input || !user) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const { data: authData } = await _supaHome.auth.getUser();
    await _supaHome.from('forum_comments').insert({
        post_id:   postId,
        user_id:   authData?.user?.id,
        user_name: user.name,
        user_img:  user.image || '',
        content:   text,
        parent_id: null
    });
    await loadHomeComments(postId);
    // Update comment count in stats
    const { data } = await _supaHome.from('forum_comments').select('id', { count: 'exact' }).eq('post_id', postId);
    const count = data?.length || 0;
    const stats = document.querySelector(`#hfpost-${postId} .hf-post-stats`);
    if (stats) {
        let countSpan = stats.querySelector('.hf-comment-count');
        if (!countSpan) {
            stats.insertAdjacentHTML('beforeend', `<span class="hf-comment-count" style="margin-left:auto;">${count} comment${count !== 1 ? 's' : ''}</span>`);
        } else {
            countSpan.textContent = `${count} comment${count !== 1 ? 's' : ''}`;
        }
    }
}

// ── Simple image lightbox for home feed ──────────
function openHomeImgLightbox(src) {
    const lb = document.createElement('div');
    lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    lb.innerHTML = `<img src="${src}" style="max-width:92vw;max-height:90vh;object-fit:contain;border-radius:10px;">`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
}

// ══════════════════════════════════════════════════
//  RIGHT SIDEBAR — ACTIVE MEMBERS
// ══════════════════════════════════════════════════

async function loadActiveMembers() {
    const list = document.getElementById('activeMembersList');
    if (!list) return;

    try {
        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // last 15 min
        const { data, error } = await _supaHome
            .from('profiles')
            .select('id, full_name, avatar_url, job_title, last_seen')
            .gte('last_seen', cutoff)
            .order('last_seen', { ascending: false })
            .limit(5);

        if (error || !data?.length) {
            // Fallback: show most recent profiles if last_seen column doesn't exist
            const { data: fallback } = await _supaHome
                .from('profiles')
                .select('id, full_name, avatar_url, job_title')
                .limit(5);

            if (!fallback?.length) {
                list.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:8px 0;">No active members.</div>';
                return;
            }
            renderActiveMembers(fallback, list, false);
            return;
        }
        renderActiveMembers(data, list, true);
    } catch (e) {
        list.innerHTML = '<div style="font-size:12px;color:#94a3b8;">Could not load members.</div>';
    }
}

function renderActiveMembers(members, list, showOnline) {
    list.innerHTML = members.map(m => {
        const name   = m.full_name || 'Member';
        const avatar = m.avatar_url || avatarUrl(name);
        const job    = m.job_title || '';
        return `
            <div class="active-member-row" onclick="location.href='dashboard.html?user_id=${m.id}'">
                <div class="active-member-avatar-wrap">
                    <img src="${avatar}" onerror="this.src='${avatarUrl(name)}'">
                    ${showOnline ? '<div class="online-dot"></div>' : ''}
                </div>
                <div class="active-member-info">
                    <div class="active-member-name">${safeText(name)}</div>
                    ${job ? `<div class="active-member-job">${safeText(job)}</div>` : ''}
                </div>
            </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════
//  RIGHT SIDEBAR — BIRTHDAYS
// ══════════════════════════════════════════════════

async function loadBirthdays() {
    const widget = document.getElementById('birthdaysWidget');
    const list   = document.getElementById('birthdaysList');
    if (!list || !widget) return;

    try {
        const today = new Date();
        const mm    = String(today.getMonth() + 1).padStart(2, '0');
        const dd    = String(today.getDate()).padStart(2, '0');

        // Query profiles where birthdate month+day matches today
        const { data, error } = await _supaHome
            .from('profiles')
            .select('id, full_name, avatar_url, birthdate')
            .not('birthdate', 'is', null);

        if (error || !data?.length) return;

        const bdays = data.filter(p => {
            if (!p.birthdate) return false;
            const d = new Date(p.birthdate);
            return String(d.getMonth() + 1).padStart(2, '0') === mm &&
                   String(d.getDate()).padStart(2, '0') === dd;
        });

        if (!bdays.length) return;

        widget.style.display = 'block';
        list.innerHTML = bdays.map(p => {
            const name   = p.full_name || 'Member';
            const avatar = p.avatar_url || avatarUrl(name);
            return `
                <div class="birthday-row">
                    <img src="${avatar}" onerror="this.src='${avatarUrl(name)}'">
                    <div class="birthday-info">
                        <div class="birthday-name">${safeText(name)}</div>
                        <div class="birthday-label">🎂 Birthday today!</div>
                    </div>
                    <button class="birthday-greet-btn" onclick="sendBirthdayGreeting('${safeText(name)}')">
                        Send Greeting
                    </button>
                </div>`;
        }).join('');
    } catch (e) {
        // silently skip if birthdate column doesn't exist
    }
}

async function sendBirthdayGreeting(name) {
    const user = getUser();
    if (!user) return;
    // Post a birthday greeting to forum_posts
    const { data: authData } = await _supaHome.auth.getUser();
    await _supaHome.from('forum_posts').insert({
        user_id:   authData?.user?.id,
        user_name: user.name,
        user_img:  user.image || '',
        subject:   '',
        content:   `🎂 Happy Birthday, ${name}! Wishing you an amazing day! 🎉`,
        is_anonymous: false
    });
    alert(`Birthday greeting sent to ${name}! 🎂`);
    loadHomeFeed();
}

// ══════════════════════════════════════════════════
//  HOME INLINE SEARCH (preserved)
// ══════════════════════════════════════════════════

let _homeSearchTimer = null;

function onHomeSearch(q) {
    document.getElementById('homeSearchClear').style.display = q ? 'flex' : 'none';
    clearTimeout(_homeSearchTimer);
    const resultsEl = document.getElementById('homeSearchResults');
    if (!q.trim()) { resultsEl.classList.remove('visible'); resultsEl.innerHTML = ''; return; }
    resultsEl.classList.add('visible');
    resultsEl.innerHTML = '<div class="hs-loading"><i class="fas fa-spinner fa-spin"></i> Searching…</div>';
    _homeSearchTimer = setTimeout(() => runHomeSearch(q.trim()), 300);
}

function clearHomeSearch() {
    document.getElementById('homeSearchInput').value = '';
    document.getElementById('homeSearchClear').style.display = 'none';
    const resultsEl = document.getElementById('homeSearchResults');
    resultsEl.classList.remove('visible');
    resultsEl.innerHTML = '';
}

async function runHomeSearch(q) {
    const pattern = `%${q}%`;
    const [peopleRes, postsRes] = await Promise.all([
        _supaHome.from('profiles')
            .select('id, full_name, avatar_url, job_title, division')
            .or(`full_name.ilike.${pattern},job_title.ilike.${pattern},division.ilike.${pattern}`)
            .limit(6),
        _supaHome.from('forum_posts')
            .select('id, content, user_name, user_id, created_at')
            .or(`content.ilike.${pattern},user_name.ilike.${pattern}`)
            .order('created_at', { ascending: false })
            .limit(8)
    ]);

    const people = peopleRes.data || [];
    const posts  = postsRes.data  || [];
    const resultsEl = document.getElementById('homeSearchResults');

    if (!people.length && !posts.length) {
        resultsEl.innerHTML = '<div class="hs-empty">No results found.</div>';
        return;
    }

    let html = '';

    if (people.length) {
        html += `<div class="hs-section-label">People</div>`;
        people.forEach(p => {
            const name   = safeText(p.full_name || 'Realmate Member');
            const job    = safeText(p.job_title || '');
            const avatar = p.avatar_url || avatarUrl(p.full_name || '?');
            html += `<a href="dashboard.html?user_id=${p.id}" class="hs-people-row">
                <img src="${avatar}" class="hs-avatar" onerror="this.src='${avatarUrl('?')}'">
                <div><div class="hs-name">${name}</div>${job ? `<div class="hs-job">${job}</div>` : ''}</div>
            </a>`;
        });
    }

    if (posts.length) {
        html += `<div class="hs-section-label" style="margin-top:${people.length ? '12px' : '0'}">Posts</div>`;
        posts.forEach(p => {
            const content = safeText((p.content || '').slice(0, 100));
            const poster  = safeText(p.user_name || '');
            html += `<a href="#" class="hs-listing-row" onclick="event.preventDefault(); scrollToPost('${p.id}')">
                <div class="hs-listing-content">${content}${(p.content||'').length > 100 ? '…' : ''}</div>
                ${poster ? `<div class="hs-poster">${poster}</div>` : ''}
            </a>`;
        });
    }

    resultsEl.innerHTML = html;
}

function scrollToPost(id) {
    clearHomeSearch();
    const el = document.getElementById(`hfpost-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ══════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initGuestUI();
    initCreatePost();
    loadHomeFeed();
    loadActiveMembers();
    loadBirthdays();
});
