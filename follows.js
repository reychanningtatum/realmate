// follows.js — one-way follow system (like Instagram/Twitter)
// Run this SQL in Supabase once:
//
// create table follows (
//   id uuid default gen_random_uuid() primary key,
//   follower_id   uuid,
//   follower_name text,
//   following_id  uuid,
//   following_name text,
//   created_at timestamptz default now(),
//   unique (follower_id, following_id)
// );
// create index on follows(follower_id);
// create index on follows(following_id);

const _followsDb = (typeof _supabase !== 'undefined') ? _supabase
                 : supabase.createClient(
                     'https://wmegpgrfrtprhuzmgjma.supabase.co',
                     'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4'
                   );

function _followLocalUser() {
    return JSON.parse(localStorage.getItem('user')) || null;
}

// Returns { followers: N, following: N }
async function getFollowCounts(userId) {
    try {
        const [{ count: followers }, { count: following }] = await Promise.all([
            _followsDb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
            _followsDb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
        ]);
        return { followers: followers || 0, following: following || 0 };
    } catch { return { followers: 0, following: 0 }; }
}

// Returns true if the current auth user follows targetUserId
async function isFollowing(targetUserId) {
    try {
        const { data: auth } = await _followsDb.auth.getUser();
        const myId = auth?.user?.id;
        if (!myId) return false;
        const { count } = await _followsDb
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', myId)
            .eq('following_id', targetUserId);
        return (count || 0) > 0;
    } catch { return false; }
}

async function followUser(targetUserId, targetName) {
    try {
        const me = _followLocalUser();
        const { data: auth } = await _followsDb.auth.getUser();
        const myId = auth?.user?.id;
        if (!myId) return { error: 'Not authenticated' };

        const { error } = await _followsDb.from('follows').insert({
            follower_id:   myId,
            follower_name: me?.name || '',
            following_id:  targetUserId,
            following_name: targetName
        });
        if (error) throw error;

        // Notify the followed user
        await _followsDb.from('notifications').insert({
            type:                   'follow',
            sender_user_name:       me?.name || '',
            sender_profile_picture: me?.image || '',
            recipient_user_name:    targetName,
            message:                'started following you.',
            is_read:                false,
            created_at:             new Date().toISOString()
        });

        return { success: true };
    } catch (e) {
        console.error('followUser:', e);
        return { error: e.message };
    }
}

async function unfollowUser(targetUserId) {
    try {
        const { data: auth } = await _followsDb.auth.getUser();
        const myId = auth?.user?.id;
        if (!myId) return { error: 'Not authenticated' };
        const { error } = await _followsDb.from('follows')
            .delete()
            .eq('follower_id', myId)
            .eq('following_id', targetUserId);
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('unfollowUser:', e);
        return { error: e.message };
    }
}

// Renders a follow button for a given targetUserId + targetName
// Checks DB for current follow state
async function renderFollowButton(containerId, targetUserId, targetName) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const { data: auth } = await _followsDb.auth.getUser();
    const myId = auth?.user?.id;
    if (!myId || myId === targetUserId) { el.innerHTML = ''; return; }

    const already = await isFollowing(targetUserId);
    el.innerHTML = already
        ? `<button class="btn-follow btn-follow-ing" onclick="handleUnfollow(this,'${targetUserId}')">
               <i class="fas fa-user-check"></i> Following
           </button>`
        : `<button class="btn-follow" onclick="handleFollow(this,'${targetUserId}','${targetName.replace(/'/g,"\\'")}')">
               <i class="fas fa-user-plus"></i> Follow
           </button>`;
}

async function handleFollow(btn, targetUserId, targetName) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const result = await followUser(targetUserId, targetName);
    if (result.success) {
        btn.className = 'btn-follow btn-follow-ing';
        btn.innerHTML = '<i class="fas fa-user-check"></i> Following';
        btn.onclick = () => handleUnfollow(btn, targetUserId);
        btn.disabled = false;
        // Bump follower count display
        ['followersCount', 'followersCountHero'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = (parseInt(el.innerText) || 0) + 1;
        });
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
        alert('Could not follow: ' + (result.error || 'Unknown error'));
    }
}

async function handleUnfollow(btn, targetUserId) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const result = await unfollowUser(targetUserId);
    if (result.success) {
        btn.className = 'btn-follow';
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
        btn.onclick = null; // re-set inline via renderFollowButton approach is simpler
        btn.disabled = false;
        ['followersCount', 'followersCountHero'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = Math.max(0, (parseInt(el.innerText) || 0) - 1);
        });
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-check"></i> Following';
    }
}
