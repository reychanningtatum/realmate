function toggleProfileMenu(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('profileMenuDropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
}
document.addEventListener('click', (e) => {
    const btn = document.getElementById('profileMenuBtn');
    const dropdown = document.getElementById('profileMenuDropdown');
    if (dropdown && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// 🔥 SUPABASE SETUP
const supabaseUrl = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
const supabaseKey = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';
let _supabase = null;

try {
    _supabase = supabase.createClient(supabaseUrl, supabaseKey);
} catch(e) { console.log("Init Supabase Error", e); }

// 🔥 GLOBAL DATA
let user = JSON.parse(localStorage.getItem("user")) || {
    name: "Reychan Bernaldez",
    image: "https://via.placeholder.com/150",
    job: "Real Estate Manager",
    division: "Alveo Land",
    group: "Echelon",
    team: "Sales Force",
    bio: "Full-stack developer and business entrepreneur."
};


// 🔥 DYNAMIC GROUP DATA
const groupData = {
    "Apex": ["Acme Supreme", "Avantis", "Imperium", "Infinitues", "Paramount", "Spire Dynasty", "Summit", "Vertex", "Zion"],
    "Champions": ["Aureus", "Bravens", "Champions", "Conquistadors", "Excaliburs", "Jaegers", "Kings", "Maximus", "Primos"]
};

// Function to update Group field based on Division selection
function updateGroupOptions() {
    const division = document.getElementById("editDivision")?.value;
    const container = document.getElementById("groupContainer");
    
    if (division && container && groupData[division]) {
        let selectHTML = `<select id="editGroup">`;
        groupData[division].forEach(group => {
            selectHTML += `<option value="${group}">${group}</option>`;
        });
        selectHTML += `</select>`;
        container.innerHTML = selectHTML;
    } else if (container) {
        container.innerHTML = `<input type="text" id="editGroup" placeholder="Enter Group Name">`;
    }
}

function applyPrestigeUI() {
    const jobDisp = document.getElementById('jobDisplay');
    if (jobDisp) {
        jobDisp.innerText = user.job || '';
    }
}

// UI ENGINE
function updateUI() {
    // Guard Clause: Stops the script if on a page without nameDisplay (like forum.html)
    if(!document.getElementById("nameDisplay")) return;
    
    document.getElementById("profileImage").src = user.image;
    document.getElementById("nameDisplay").innerText = user.name;

    // Update menu avatar with profile photo or initial
    const menuAvatar = document.getElementById('profileMenuAvatar');
    if (menuAvatar) {
        if (user.image) {
            menuAvatar.innerHTML = '';
            menuAvatar.style.backgroundImage = `url('${user.image}')`;
            menuAvatar.style.backgroundSize = 'cover';
            menuAvatar.style.backgroundPosition = 'center';
            menuAvatar.style.background = `url('${user.image}') center/cover no-repeat`;
        } else {
            menuAvatar.style.background = '#32cd32';
            menuAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
        }
    }
    document.getElementById("divisionDisplay").innerText = user.division;
    document.getElementById("groupDisplay").innerText = user.group;
    document.getElementById("bioDisplay").innerText = user.bio;

    // Team badge only visible for Sales Manager and Property Specialist tiers
    const job = user.job || "";
    const showTeam = job.includes("Sales Manager") || job.includes("Property Specialist") || job === "Executive Property Specialist - OIC";
    const teamBadge = document.getElementById("teamBadgeWrapper");
    if (teamBadge) teamBadge.style.display = showTeam ? "flex" : "none";
    if (showTeam) document.getElementById("teamDisplay").innerText = user.team || "Not Specified";
    
    applyPrestigeUI();

    // Relationship status
    const relIcons = {
        'Single':            'fa-user',
        'In a Relationship': 'fa-heart',
        'Engaged':           'fa-ring',
        'Married':           'fa-people-arrows',
        "It's Complicated":  'fa-shuffle'
    };
    const relBadge = document.getElementById('relationshipBadgeWrapper');
    const relDisplay = document.getElementById('relationshipDisplay');
    const relIcon = document.getElementById('relationshipIcon');
    if (relBadge && relDisplay) {
        if (user.relationship) {
            relBadge.style.display = 'flex';
            relDisplay.innerText = user.relationship;
            if (relIcon) relIcon.innerHTML = `<i class="fas ${relIcons[user.relationship] || 'fa-heart'}" style="color:var(--primary); font-size:11px;"></i>`;
        } else {
            relBadge.style.display = 'none';
        }
    }
}

// Check if viewing another user's profile via ?user_id=
const _viewUserId = new URLSearchParams(window.location.search).get('user_id');
const _isViewingOther = !!_viewUserId;

async function loadProfile() {
    if (_supabase) {
        try {
            const myAuthId = (await _supabase.auth.getUser()).data.user?.id;

            // If the URL param is the current user's own ID, strip it and load normally
            if (_isViewingOther && _viewUserId === myAuthId) {
                history.replaceState(null, '', 'dashboard.html');
                window._isViewingOther_override = false;
            }

            const effectivelyViewingOther = _isViewingOther && _viewUserId !== myAuthId;
            const targetId = effectivelyViewingOther ? _viewUserId : myAuthId;

            if (targetId) {
                const { data: profiles, error: profErr } = await _supabase.from('profiles').select('*').eq('id', targetId);
                if (profErr) console.error('[loadProfile] profiles query error:', profErr.message);

                if (profiles && profiles.length > 0) {
                    const profile = profiles[0];
                    if (effectivelyViewingOther) {
                        // When viewing another user: use ONLY their data, no fallback to current user
                        user = {
                            id: targetId,
                            name: profile.full_name || 'Realmate Member',
                            image: profile.avatar_url || `https://ui-avatars.com/api/?name=R&background=0f172a&color=32cd32`,
                            imageOriginal: profile.avatar_original_url || profile.avatar_url || '',
                            job: profile.job_title || '',
                            division: profile.division || '',
                            group: profile.business_group || '',
                            team: profile.team_name || '',
                            bio: profile.bio || '',
                            relationship: profile.relationship_status || ''
                        };
                    } else {
                        user = {
                            id: targetId,
                            name: profile.full_name || user.name,
                            image: profile.avatar_url || user.image,
                            imageOriginal: profile.avatar_original_url || profile.avatar_url || user.image,
                            job: profile.job_title || user.job,
                            division: profile.division || user.division,
                            group: profile.business_group || user.group,
                            team: profile.team_name || user.team,
                            bio: profile.bio || user.bio,
                            relationship: profile.relationship_status || ''
                        };
                        localStorage.setItem("user", JSON.stringify(user));
                    }
                } else if (effectivelyViewingOther) {
                    // Profile row missing — show blank rather than current user's data
                    user = {
                        id: targetId,
                        name: 'Realmate Member',
                        image: `https://ui-avatars.com/api/?name=R&background=0f172a&color=32cd32`,
                        job: '', division: '', group: '', team: '', bio: '', relationship: ''
                    };
                    console.warn('[loadProfile] No profile row found for user_id:', targetId);
                }
            }
        } catch (e) { console.log("Cloud sync error", e); }
    }

    const effectivelyViewingOther = _isViewingOther && window._isViewingOther_override !== false;

    // Hide edit/post controls when viewing someone else's profile
    if (effectivelyViewingOther) {
        document.querySelectorAll('.edit-only, .post-controls, #postForm, #editProfileBtn, .menu-dots')
            .forEach(el => el && (el.style.display = 'none'));
        const backBtn = document.getElementById('viewingOtherBanner');
        if (backBtn) backBtn.style.display = 'flex';
    }

    updateUI();

    // Render Add as Mate button after updateUI() so nameDisplay is populated
    if (effectivelyViewingOther) {
        const mateBtnEl = document.getElementById('profileMateBtn');
        if (mateBtnEl && typeof mateButtonHtml === 'function') {
            await loadMatesCache();
            const viewedName = document.getElementById('nameDisplay')?.textContent?.trim() || user.name;
            if (viewedName) mateBtnEl.innerHTML = mateButtonHtml(viewedName, 'btn-mate-profile');
        }
        // Follow button
        if (typeof renderFollowButton === 'function') {
            await renderFollowButton('profileFollowBtn', _viewUserId, user.name);
        }
    }

    // Follower / following counts for the profile being viewed
    const targetId = effectivelyViewingOther ? _viewUserId : (await _supabase.auth.getUser()).data?.user?.id;
    if (targetId && typeof getFollowCounts === 'function') {
        const { followers, following } = await getFollowCounts(targetId);
        const fc = document.getElementById('followersCount');
        const fg = document.getElementById('followingCount');
        if (fc) fc.innerText = followers;
        if (fg) fg.innerText = following;
    }
    if (targetId && typeof getMatesCount === 'function') {
        const count = await getMatesCount(targetId);
        const el = document.getElementById('matesCountProfile');
        if (el) el.innerText = count;
    }

    await renderRealMatesCard();
}

async function renderRealMatesCard() {
    try {
        const { accepted, pendingReceived, pendingSent } = await getMatesList();

        // Update count stat
        const countEl = document.getElementById('matesCount');
        if (countEl) countEl.innerText = accepted.length;
        const countBig = document.getElementById('matesCountBig');
        if (countBig) countBig.innerText = accepted.length;
        const countHero = document.getElementById('matesCountHero');
        if (countHero) countHero.innerText = accepted.length;

        // Pending requests section
        const pendingSection = document.getElementById('pendingMatesSection');
        const pendingList   = document.getElementById('pendingMatesList');
        if (pendingSection && pendingList) {
            if (pendingReceived.length > 0) {
                pendingSection.style.display = 'block';
                pendingList.innerHTML = pendingReceived.map(m => `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${m.img || 'images/realmate2.png'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; flex-shrink:0; border:2px solid var(--border);">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.name}</div>
                            <div style="font-size:11px; color:var(--text-sub);">wants to be your Realmate</div>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button onclick="dashAcceptMate(this,'${m.name.replace(/'/g,"\\'")}');" style="background:var(--primary); color:#fff; border:none; border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;"><i class="fas fa-check"></i></button>
                            <button onclick="dashDeclineMate(this,'${m.name.replace(/'/g,"\\'")}');" style="background:#f1f5f9; color:#64748b; border:none; border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;"><i class="fas fa-times"></i></button>
                        </div>
                    </div>`).join('');
            } else {
                pendingSection.style.display = 'none';
            }
        }

        // Pending sent requests
        const sentSection = document.getElementById('pendingSentSection');
        const sentList    = document.getElementById('pendingSentList');
        if (sentSection && sentList) {
            if (pendingSent.length > 0) {
                sentSection.style.display = 'block';
                sentList.innerHTML = pendingSent.map(m => `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <div style="width:36px; height:36px; border-radius:50%; background:var(--primary-soft); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class="fas fa-user" style="color:var(--primary); font-size:14px;"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.name}</div>
                            <div style="font-size:11px; color:#94a3b8;">Request sent · Pending</div>
                        </div>
                        <span style="background:#f1f5f9; color:#94a3b8; font-size:10px; font-weight:700; padding:3px 8px; border-radius:50px; white-space:nowrap;">
                            <i class="fas fa-clock"></i> Pending
                        </span>
                    </div>`).join('');
            } else {
                sentSection.style.display = 'none';
            }
        }

        // Accepted mates avatars
        const avatarHtml = accepted.length === 0 ? '' : accepted.map(m => `
            <div onclick="location.href='dashboard.html?user_id=${m.id}'" title="${m.name}"
                 style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; width:52px;">
                <img src="${m.img || 'images/realmate2.png'}"
                     style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid var(--border);"
                     onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform=''">
                <span style="font-size:10px; color:var(--text-sub); font-weight:600; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${m.name.split(' ')[0]}</span>
            </div>`).join('');

        // Right-column avatar list (desktop)
        const avatarList = document.getElementById('matesAvatarList');
        const emptyMsg   = document.getElementById('matesEmptyMsg');
        if (avatarList && emptyMsg) {
            if (accepted.length === 0) {
                avatarList.style.display = 'none';
                emptyMsg.style.display = 'block';
            } else {
                emptyMsg.style.display = 'none';
                avatarList.style.display = 'flex';
                avatarList.innerHTML = avatarHtml;
            }
        }

        // Middle-column avatar strip (always visible, incl. mobile)
        const avatarStrip = document.getElementById('matesAvatarStrip');
        const avatarEmpty = document.getElementById('matesAvatarEmpty');
        if (avatarStrip) {
            if (accepted.length > 0) {
                avatarStrip.style.display = 'flex';
                avatarStrip.innerHTML = avatarHtml;
                if (avatarEmpty) avatarEmpty.style.display = 'none';
            } else {
                avatarStrip.style.display = 'none';
                if (avatarEmpty) avatarEmpty.style.display = 'inline';
            }
        }
    } catch (e) { console.warn('renderRealMatesCard:', e); }
}

async function dashAcceptMate(btn, name) {
    btn.disabled = true;
    await acceptMateRequest(name);
    await renderRealMatesCard();
}

async function dashDeclineMate(btn, name) {
    btn.disabled = true;
    await declineMateRequest(name);
    await renderRealMatesCard();
}

async function uploadImage(file, path) {
    if(!_supabase) return null;
    try {
        const fileName = `${path}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const { data, error } = await _supabase.storage.from('images').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = _supabase.storage.from('images').getPublicUrl(fileName);
        return publicUrl;
    } catch (err) { alert("Upload Error: " + err.message); return null; }
}


function _editAlert(msg, type = 'success') {
    const isSuccess = type === 'success';
    const toast = document.getElementById('profileToast');
    if (toast) {
        toast.style.background = isSuccess ? '#0f172a' : '#ef4444';
        toast.querySelector('i').className = `fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
        toast.querySelector('i').style.color = isSuccess ? '#32cd32' : '#fff';
        toast.childNodes[toast.childNodes.length - 1].textContent = ' ' + msg;
        toast.style.display = 'flex';
        toast.style.opacity = '1';
        clearTimeout(window._editToastTimer);
        window._editToastTimer = setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, 3000);
    }
}

async function saveProfile() {
    const btn = document.getElementById('saveProfileBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving...'; }

    user.name = document.getElementById("editName").value;
    user.job = document.getElementById("editJob").value;
    user.division = document.getElementById("editDivision").value;
    user.group = document.getElementById("editGroup").value;
    user.team = document.getElementById("editTeam").value;
    user.bio = document.getElementById("editBio").value;
    user.relationship = document.getElementById("editRelationship").value;

    if (_supabase) {
        try {
            const { data: { user: authUser } } = await _supabase.auth.getUser();
            if (authUser) {
                const { error } = await _supabase.from('profiles').upsert({
                    id: authUser.id,
                    full_name: user.name,
                    job_title: user.job,
                    division: user.division,
                    business_group: user.group,
                    team_name: user.team,
                    bio: user.bio,
                    avatar_url: user.image,
                    relationship_status: user.relationship || null,
                    updated_at: new Date()
                });
                if (error) throw error;
            }
        } catch(e) {
            if (btn) { btn.disabled = false; btn.innerHTML = 'Save Changes'; }
            closeEditModal();
            _editAlert('Failed to save: ' + e.message, 'error');
            return;
        }
    }

    localStorage.setItem("user", JSON.stringify(user));
    updateUI();
    if (btn) { btn.disabled = false; btn.innerHTML = 'Save Changes'; }
    closeEditModal();
    _editAlert('Profile saved successfully!');
}

function openEditModal() {
    document.getElementById("editName").value = user.name;
    document.getElementById("editJob").value = user.job;
    document.getElementById("editDivision").value = user.division;
    document.getElementById("editRelationship").value = user.relationship || '';
    
    updateGroupOptions();
    
    document.getElementById("editGroup").value = user.group;
    document.getElementById("editTeam").value = user.team || "";
    document.getElementById("editBio").value = user.bio;
    document.getElementById("editModal").style.display = "flex";
}
function closeEditModal() { document.getElementById("editModal").style.display = "none"; }

function logout() { 
    if (_supabase) _supabase.auth.signOut();
    localStorage.removeItem("user");
    localStorage.removeItem("posts");
    location.href = "index.html"; 
}

// ── Photo Action Sheet ──
function openPhotoActionSheet() {
    const sheet = document.getElementById("photoActionSheet");
    const preview = document.getElementById("actionSheetPreview");
    const nameEl = document.getElementById("actionSheetName");
    preview.src = document.getElementById("profileImage").src;
    nameEl.textContent = user.name || "";
    sheet.style.display = "flex";
    document.body.style.overflow = "hidden";
}
function closePhotoActionSheet() {
    document.getElementById("photoActionSheet").style.display = "none";
    document.body.style.overflow = "";
}

function changeImage() {
    closePhotoActionSheet();
    document.getElementById("fileInput").click();
}

// ── Lightbox ──
function viewFullPhoto() {
    closePhotoActionSheet();
    const src = document.getElementById("profileImage").src;
    document.getElementById("lightboxImg").src = src;
    document.getElementById("profileLightbox").style.display = "flex";
    document.body.style.overflow = "hidden";
}
function closeProfileLightbox() {
    document.getElementById("profileLightbox").style.display = "none";
    document.body.style.overflow = "";
}

// ── Toast ──
function showPhotoToast() {
    const toast = document.getElementById("profileToast");
    toast.style.display = "flex";
    toast.style.opacity = "1";
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => { toast.style.display = "none"; }, 300);
    }, 3000);
}

// ── Cropper ──
let cropperInstance = null;

function openCropModal(src) {
    closePhotoActionSheet();
    closeProfileLightbox();

    const cropImg = document.getElementById("cropperImage");
    cropImg.crossOrigin = "anonymous";
    cropImg.src = src;

    document.getElementById("cropModal").style.display = "flex";
    document.body.style.overflow = "hidden";

    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }

    cropImg.onload = () => {
        cropperInstance = new Cropper(cropImg, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            cropBoxMovable: false,
            cropBoxResizable: false,
            toggleDragModeOnDblclick: false,
            background: false,
            ready() {
                // Calculate the fitted zoom ratio and set slider around it
                const imageData = cropperInstance.getImageData();
                const canvasData = cropperInstance.getCanvasData();
                const fitRatio = canvasData.width / imageData.naturalWidth;
                const slider = document.getElementById("zoomSlider");
                slider.min = fitRatio;
                slider.max = fitRatio * 4;
                slider.step = fitRatio * 0.02;
                slider.value = fitRatio;
            },
            zoom(event) {
                // Keep slider in sync when zooming via scroll/pinch
                const slider = document.getElementById("zoomSlider");
                const ratio = event.detail.ratio;
                if (ratio < parseFloat(slider.min) || ratio > parseFloat(slider.max)) {
                    event.preventDefault();
                    return;
                }
                slider.value = ratio;
            }
        });
    };
}

async function repositionPhoto() {
    closePhotoActionSheet();
    const originalSrc = user.imageOriginal || document.getElementById("profileImage").src;

    // Fetch as blob → convert to data URL to avoid tainted canvas CORS error
    try {
        const res = await fetch(originalSrc);
        const blob = await res.blob();
        const dataUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(blob);
        });
        openCropModal(dataUrl);
    } catch (e) {
        openCropModal(originalSrc); // fallback
    }
}

function closeCropModal() {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    document.getElementById("cropModal").style.display = "none";
    document.getElementById("fileInput").value = "";
    document.body.style.overflow = "";
}

async function applyCrop() {
    if (!cropperInstance) return;
    const btn = document.getElementById("applyCropBtn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    try {
        const ts = Date.now();

        // Upload original (full image) if this is a new upload — preserves it for future repositioning
        if (window._pendingOriginalFile) {
            const origUrl = await uploadImage(window._pendingOriginalFile, 'avatars');
            if (origUrl) {
                user.imageOriginal = origUrl;
            }
            window._pendingOriginalFile = null;
        }

        // Upload the cropped result as the display avatar
        const canvas = cropperInstance.getCroppedCanvas({ width: 400, height: 400 });
        if (!canvas) throw new Error("Could not read image. Please try uploading again.");
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (!blob) throw new Error("Failed to process image.");
        const croppedFile = new File([blob], `avatar_${ts}.jpg`, { type: 'image/jpeg' });
        const publicUrl = await uploadImage(croppedFile, 'avatars');

        if (publicUrl) {
            user.image = publicUrl;
            localStorage.setItem("user", JSON.stringify(user));
            if (_supabase) {
                const { data: { user: authUser } } = await _supabase.auth.getUser();
                if (authUser) {
                    await _supabase.from('profiles').update({
                        avatar_url: publicUrl,
                        avatar_original_url: user.imageOriginal || publicUrl
                    }).eq('id', authUser.id);
                }
            }
            updateUI();
            showPhotoToast();
        }
    } catch(e) {
        alert("Upload failed: " + e.message);
    } finally {
        closeCropModal();
    }
}

document.getElementById("fileInput").addEventListener("change", function () {
    if (!this.files[0]) return;
    // Store original file so applyCrop can upload it separately
    window._pendingOriginalFile = new File(
        [this.files[0]],
        `original_${Date.now()}_${this.files[0].name}`,
        { type: this.files[0].type }
    );
    const reader = new FileReader();
    reader.onload = (e) => openCropModal(e.target.result);
    reader.readAsDataURL(this.files[0]);
});


// Modified initialization:
window.onload = async () => {
    if (_supabase) {
        await loadProfile();
        _supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') loadProfile();
        });
    }
};