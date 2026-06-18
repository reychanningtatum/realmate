// 🔐 AUTH GUARD — runs on every protected page
(async function () {
    const SUPABASE_URL = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';
    const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const isGuest = localStorage.getItem("isGuest") === "true";
    const { data: { session } } = await _sb.auth.getSession();

    // No session and not a guest → back to login
    if (!session && !isGuest) {
        localStorage.clear();
        location.href = "index.html";
        return;
    }

    if (!session) return; // guest, allow through

    // Session exists — sync user profile into localStorage
    try {
        const storedUser = JSON.parse(localStorage.getItem("user")) || {};

        // Only refetch if the stored user doesn't match the session user
        if (storedUser.id !== session.user.id) {
            const { data: profile } = await _sb
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            const meta = session.user.user_metadata || {};
            const fullName = (profile && profile.full_name)
                || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
                || session.user.email;

            const userObj = {
                id: session.user.id,
                email: session.user.email,
                name: fullName,
                image: (profile && profile.avatar_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`,
                job: (profile && profile.job_title) || '',
                division: (profile && profile.division) || 'Alveo Land',
                group: (profile && profile.business_group) || '',
                team: (profile && profile.team_name) || '',
                bio: (profile && profile.bio) || ''
            };
            localStorage.setItem("user", JSON.stringify(userObj));

            // If profile doesn't exist in DB, create it
            if (!profile) {
                await _sb.from('profiles').insert({
                    id: session.user.id,
                    full_name: fullName,
                    avatar_url: userObj.image
                });
            }
        }
    } catch (e) {
        console.warn("[AuthGuard] Profile sync error:", e.message);
    }
})();
