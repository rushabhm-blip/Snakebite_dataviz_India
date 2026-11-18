/* ==========================================================================
   COMMUNITY SIGHTINGS — "Share a sighting" form + approved-sighting markers
   Backend: Supabase (free tier). Only the PUBLIC publishable key lives here;
   Row Level Security allows: anyone can INSERT a 'pending' row, anyone can
   SELECT only 'approved' rows. Approve / reject rows in the Supabase dashboard.
   ========================================================================== */
(function () {
    'use strict';

    const SUPABASE_URL = 'https://kmxeuajcwufnfmwdrwzu.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_tmzVPSj4DPoqwsgxtiBKRg_i6yJlmbS';
    const BUCKET = 'snake-photos';
    const COOLDOWN_MS = 60 * 1000;
    const MAX_DIM = 1280;

    const root = document.getElementById('snakes-neighbourhood-component');
    if (!root || !window.SNC || typeof window.SNC.getMap !== 'function' || typeof L === 'undefined') return;
    const map = window.SNC.getMap();

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const headers = (extra) => Object.assign({ apikey: SUPABASE_KEY }, extra || {});
    const photoUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;

    /* ---------- 1. Show approved community sightings on the map ---------- */
    const communityLayer = L.layerGroup().addTo(map);

    function popupHtml(r) {
        const name = r.species_label || 'Snake sighting';
        return `<div>
            <img class="snc-popup-img" src="${esc(photoUrl(r.photo_path))}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'"/>
            <div class="snc-popup-body">
                <div class="snc-popup-com">${esc(name)}</div>
                ${r.species_sci ? `<div class="snc-popup-sci">${esc(r.species_sci)}</div>` : ''}
                <div class="snc-popup-meta">
                    ${r.observed_on ? `<div><span>Observed:</span> ${esc(r.observed_on)}</div>` : ''}
                    ${r.place ? `<div><span>Location:</span> ${esc(r.place)}</div>` : ''}
                    <div><span>Source:</span> Community-reported, not expert verified</div>
                </div>
            </div></div>`;
    }

    function loadApproved() {
        const q = `${SUPABASE_URL}/rest/v1/submissions?status=eq.approved&select=species_sci,species_label,lat,lon,place,observed_on,photo_path&order=created_at.desc&limit=1000`;
        fetch(q, { headers: headers() })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('status ' + r.status)))
            .then(rows => {
                communityLayer.clearLayers();
                rows.forEach(r => {
                    L.circleMarker([r.lat, r.lon], {
                        radius: 7, fillColor: '#F59E0B', color: '#071F18', weight: 1.5, opacity: 1, fillOpacity: 0.95
                    }).bindPopup(() => popupHtml(r), { maxWidth: 245 }).addTo(communityLayer);
                });
            })
            .catch(() => { /* fail quietly: the original dataset still works */ });
    }
    loadApproved();

    /* ---------- 2. Share-a-sighting UI ---------- */
    const css = document.createElement('style');
    css.textContent = `
    .csub-cta{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:28px 0 8px;padding:18px 20px;border:1px solid rgba(168,185,163,.28);border-radius:14px;background:rgba(7,31,24,.55);font-family:'Google Sans Flex','Inter',sans-serif}
    .csub-cta p{margin:0;color:#C8D6CA;font-size:.95rem;line-height:1.5;max-width:46ch}
    .csub-cta strong{color:#EAE3D3;display:block;font-size:1.05rem;margin-bottom:2px}
    .csub-btn{appearance:none;border:0;cursor:pointer;border-radius:999px;padding:11px 20px;font:600 .92rem 'Google Sans Flex','Inter',sans-serif;background:#F59E0B;color:#1a1204}
    .csub-btn:hover{filter:brightness(1.08)}.csub-btn[disabled]{opacity:.55;cursor:default}
    .csub-btn.ghost{background:transparent;color:#C8D6CA;border:1px solid rgba(168,185,163,.4)}
    .csub-overlay{position:fixed;inset:0;z-index:10000;background:rgba(2,10,6,.78);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;-webkit-overflow-scrolling:touch}
    .csub-overlay[hidden]{display:none}
    .csub-modal{width:min(480px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;background:#0B2A20;border:1px solid rgba(168,185,163,.3);border-radius:16px;padding:22px;color:#C8D6CA;font-family:'Google Sans Flex','Inter',sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}
    .csub-modal h3{margin:0 0 4px;color:#EAE3D3;font-size:1.2rem}
    .csub-modal .csub-sub{margin:0 0 16px;font-size:.85rem;color:#94A3B8}
    .csub-modal label{display:block;margin:12px 0 5px;font-size:.82rem;color:#A8B9A3}
    .csub-modal input,.csub-modal textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(168,185,163,.35);background:#071F18;color:#EAE3D3;font:inherit;font-size:16px}
    .csub-modal input[type=file]{padding:8px}
    .csub-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
    .csub-loc{font-size:.82rem;color:#A8B9A3;margin-top:6px}
    .csub-preview{display:none;margin-top:8px;max-width:100%;max-height:180px;border-radius:10px}
    .csub-msg{margin-top:14px;font-size:.88rem;min-height:1.2em}.csub-msg.err{color:#FCA5A5}.csub-msg.ok{color:#86EFAC}
    .csub-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
    .csub-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}
    .csub-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10001;background:#F59E0B;color:#1a1204;padding:10px 16px;border-radius:999px;font:600 .9rem 'Google Sans Flex','Inter',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5)}
    `;
    document.head.appendChild(css);

    // Call-to-action block, placed above the footer notes of the map component
    const cta = document.createElement('div');
    cta.className = 'csub-cta';
    cta.innerHTML = `<p><strong>Spotted a snake? Add it to the map.</strong>Share a photo, the species (if you know it) and roughly where you saw it. Sightings appear after a quick review.</p>
        <button type="button" class="csub-btn" id="csub-open">Share a sighting</button>`;
    const anchor = root.querySelector('.snc-footer-notes');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(cta, anchor); else root.appendChild(cta);

    const overlay = document.createElement('div');
    overlay.className = 'csub-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
    <form class="csub-modal" id="csub-form" role="dialog" aria-modal="true" aria-labelledby="csub-title" novalidate>
        <h3 id="csub-title">Share a snake sighting</h3>
        <p class="csub-sub">Photos are reviewed before they appear. Please don't include people's faces or home addresses.</p>

        <label for="csub-species">Snake name (pick from the list or type your own)</label>
        <input id="csub-species" list="csub-species-list" maxlength="120" placeholder="e.g. Indian Cobra, or &quot;not sure&quot;" autocomplete="off" required>
        <datalist id="csub-species-list"></datalist>

        <label for="csub-photo">Photo (JPG, PNG or WebP)</label>
        <input id="csub-photo" type="file" accept="image/jpeg,image/png,image/webp" required>
        <img class="csub-preview" id="csub-preview" alt="Selected photo preview">

        <label for="csub-place">Place (village / town / district)</label>
        <input id="csub-place" maxlength="120" placeholder="e.g. Ratnagiri, Maharashtra">

        <label for="csub-date">Date seen</label>
        <input id="csub-date" type="date">

        <label>Location on the map</label>
        <div class="csub-row">
            <button type="button" class="csub-btn ghost" id="csub-geo">Use my location</button>
            <button type="button" class="csub-btn ghost" id="csub-pick">Pick on map</button>
        </div>
        <div class="csub-loc" id="csub-loc">No location chosen yet. Saved only to about 1 km accuracy.</div>

        <input class="csub-hp" id="csub-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="csub-msg" id="csub-msg" role="status"></div>
        <div class="csub-actions">
            <button type="button" class="csub-btn ghost" id="csub-cancel">Cancel</button>
            <button type="submit" class="csub-btn" id="csub-submit">Submit</button>
        </div>
    </form>`;
    document.body.appendChild(overlay);

    const $ = (id) => overlay.querySelector('#' + id);
    const speciesIn = $('csub-species'), photoIn = $('csub-photo'), placeIn = $('csub-place'), dateIn = $('csub-date');
    const locEl = $('csub-loc'), msgEl = $('csub-msg'), submitBtn = $('csub-submit'), preview = $('csub-preview');
    let chosen = null; // {lat, lon}
    let speciesList = [];

    if (typeof DB !== 'undefined' && DB.species) {
        speciesList = DB.species;
        const frag = document.createDocumentFragment();
        DB.species.forEach(sp => {
            const o = document.createElement('option');
            o.value = (sp.com && sp.com !== 'Unknown') ? `${sp.com} (${sp.sci})` : sp.sci;
            frag.appendChild(o);
        });
        $('csub-species-list').appendChild(frag);
    }

    function say(text, kind) { msgEl.textContent = text || ''; msgEl.className = 'csub-msg' + (kind ? ' ' + kind : ''); }
    function toast(text) {
        const t = document.createElement('div'); t.className = 'csub-toast'; t.textContent = text;
        document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
    }
    function setLoc(lat, lon) {
        chosen = { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 }; // ~1 km privacy rounding
        locEl.textContent = `Location set: ${chosen.lat.toFixed(2)}°N, ${chosen.lon.toFixed(2)}°E (rounded to ~1 km)`;
    }
    const open = () => { overlay.hidden = false; document.body.style.overflow = 'hidden'; };
    const close = () => { overlay.hidden = true; document.body.style.overflow = ''; };

    cta.querySelector('#csub-open').addEventListener('click', () => { say(''); open(); });
    // Any element with data-csub-open (e.g. the hero button) opens the form; shown only once the form is ready
    document.querySelectorAll('[data-csub-open]').forEach(el => {
        el.hidden = false;
        el.addEventListener('click', () => { say(''); open(); });
    });
    $('csub-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });

    $('csub-geo').addEventListener('click', () => {
        if (!navigator.geolocation) { say('Location is not available on this device. Use "Pick on map".', 'err'); return; }
        say('Finding your location…');
        navigator.geolocation.getCurrentPosition(
            p => { setLoc(p.coords.latitude, p.coords.longitude); say(''); },
            () => say('Could not get your location. Use "Pick on map" instead.', 'err'),
            { enableHighAccuracy: false, timeout: 10000 });
    });

    $('csub-pick').addEventListener('click', () => {
        close();
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast('Tap the map where you saw the snake');
        map.once('click', (e) => { setLoc(e.latlng.lat, e.latlng.lng); open(); });
    });

    photoIn.addEventListener('change', () => {
        const f = photoIn.files && photoIn.files[0];
        if (!f) { preview.style.display = 'none'; return; }
        preview.src = URL.createObjectURL(f); preview.style.display = 'block';
    });

    // Resize in the browser: keeps uploads small (free storage lasts far longer)
    function resizeToJpeg(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url);
                c.toBlob(b => b ? resolve(b) : reject(new Error('resize failed')), 'image/jpeg', 0.82);
            };
            img.onerror = () => reject(new Error('Could not read that image.'));
            img.src = url;
        });
    }

    function parseSpecies(text) {
        const t = text.trim();
        const m = t.match(/^(.*)\(([^()]+)\)\s*$/);
        const known = speciesList.find(sp => sp.sci === (m ? m[2].trim() : t));
        return { label: m ? m[1].trim() || t : t, sci: known ? known.sci : null };
    }

    overlay.querySelector('#csub-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if ($('csub-hp').value) return; // honeypot: bots fill hidden fields
        const last = Number(localStorage.getItem('csub_last') || 0);
        if (Date.now() - last < COOLDOWN_MS) { say('Please wait a minute before submitting another sighting.', 'err'); return; }

        const sp = parseSpecies(speciesIn.value);
        const file = photoIn.files && photoIn.files[0];
        if (sp.label.length < 2) { say('Please enter the snake name (or "not sure").', 'err'); return; }
        if (!file) { say('Please choose a photo.', 'err'); return; }
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { say('Photo must be JPG, PNG or WebP.', 'err'); return; }
        if (!chosen) { say('Please set the location (use my location, or pick on the map).', 'err'); return; }
        if (chosen.lat < 6 || chosen.lat > 38 || chosen.lon < 68 || chosen.lon > 98) { say('That location is outside India.', 'err'); return; }

        submitBtn.disabled = true; say('Uploading…');
        try {
            const blob = await resizeToJpeg(file);
            const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
            const path = `${id}.jpg`;

            const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
                method: 'POST', headers: headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }), body: blob
            });
            if (!up.ok) throw new Error('Photo upload failed (' + up.status + ').');

            const ins = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
                method: 'POST',
                headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
                body: JSON.stringify({
                    species_label: sp.label.slice(0, 120), species_sci: sp.sci,
                    lat: chosen.lat, lon: chosen.lon,
                    place: placeIn.value.trim().slice(0, 120) || null,
                    observed_on: dateIn.value || null, photo_path: path, status: 'pending'
                })
            });
            if (!ins.ok) throw new Error('Could not save the sighting (' + ins.status + ').');

            localStorage.setItem('csub_last', String(Date.now()));
            overlay.querySelector('#csub-form').reset(); preview.style.display = 'none'; chosen = null;
            locEl.textContent = 'No location chosen yet. Saved only to about 1 km accuracy.';
            close(); toast('Thank you! Your sighting will appear after review.');
        } catch (err) {
            say(err.message || 'Something went wrong. Please try again.', 'err');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
