/**
 * NuKropAI — Supabase Integration Layer V6 (Schema-Exact Production)
 *
 * Schema-aligned to every public.* table in the Supabase project.
 * All column names, types, NOT-NULL constraints, CHECK constraints
 * and FK references verified against the provided DDL schema.
 */

const SUPABASE_URL = localStorage.getItem('nukrop_supabase_url') ||
  'https://yxjqseiegwjdfnccdchk.supabase.co';
const SUPABASE_ANON_KEY = localStorage.getItem('nukrop_supabase_key') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4anFzZWllZ3dqZGZuY2NkY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDU2NTMsImV4cCI6MjEwMTUyMTY1M30.J4swglpV5qu3hRZFll3aqhG1Y2G9mUllvXMjKq6Ikmo';

var sbClient = null;
if (typeof window.supabase !== 'undefined') {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  window.sbClient = sbClient;
  console.log('🟢 NuKropAI: Supabase V6 Schema-Exact Architecture Connected.');
  sbClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN')     console.log('✅ Session Restored / Signed In');
    if (event === 'SIGNED_OUT')    console.log('❌ Signed Out');
    if (event === 'TOKEN_REFRESHED') console.log('🔄 Token Auto-Refreshed');
  });
} else {
  console.warn('🟡 Supabase JS lib not loaded — running offline mode.');
}

// ─────────────────────────────────────────────────────────────────
// 1. AUTH — SIGNUP & LOGIN
// Canonical: Unifies user identity around auth.users UUID & public.profiles
// Schema: profiles(id text PK, user_id text, email, full_name NOT NULL,
//         farmer_id UNIQUE, role, preferred_language, ...)
// ─────────────────────────────────────────────────────────────────
async function nk_signUp(email, password, fullName, role = 'farmer') {
  if (!sbClient) return { data: null, error: { message: 'Cloud service offline' } };
  try {
    const { data: authData, error: authError } = await sbClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: role } }
    });
    if (authError) throw authError;

    const userUuid = authData?.user?.id || null;
    const farmerId = (role === 'driver') ? null : ('NK-' + Math.floor(10000 + Math.random() * 89999));
    const driverId = (role === 'driver') ? ('DRV-' + Math.floor(10000 + Math.random() * 89999)) : null;

    if (userUuid) {
      await sbClient.from('profiles').upsert([{
        id:         userUuid,
        user_id:    userUuid,
        email,
        full_name:  fullName,
        farmer_id:  farmerId,
        driver_id:  driverId,
        role:       role,
        preferred_language: localStorage.getItem('nukrop_lang') || 'en'
      }], { onConflict: 'id' });
      localStorage.setItem('nukrop_user_uuid', userUuid);
      localStorage.setItem('nukrop_supabase_uid', userUuid);
    }
    if (farmerId) localStorage.setItem('nukrop_farmer_id', farmerId);
    if (driverId) localStorage.setItem('nukrop_driver_id', driverId);
    localStorage.setItem('nukrop_user_email', email);
    localStorage.setItem('nukrop_user_name', fullName);
    localStorage.setItem('nukrop_user_role', role);
    return { data: authData, error: null };
  } catch (err) {
    console.error('SignUp Error:', err.message);
    return { data: null, error: err };
  }
}

const nk_signUpUser = nk_signUp;
window.nk_signUp = nk_signUp;
window.nk_signUpUser = nk_signUp;

async function nk_loginUser(email, password) {
  if (!sbClient) return { data: null, error: 'Offline' };
  try {
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data?.user?.id) {
      localStorage.setItem('nukrop_user_uuid', data.user.id);
    }

    const profile = await nk_fetchUserProfile(email);
    if (profile) {
      localStorage.setItem('nukrop_active_user', JSON.stringify(profile));
      localStorage.setItem('nukrop_farmer_id', profile.farmer_id || '');
      localStorage.setItem('nukrop_user_name', profile.full_name || '');
      // Persist the role so the app boots into the correct dashboard
      if (profile.role) localStorage.setItem('nukrop_user_role', profile.role);
      if (profile.id)   localStorage.setItem('nukrop_user_uuid', profile.id);
    }
    return { data, error: null };
  } catch (err) {
    console.error('Login Error:', err.message);
    return { data: null, error: err };
  }
}

async function nk_logout() {
  if (!sbClient) return;
  await sbClient.auth.signOut();
  localStorage.removeItem('nukrop_active_user');
  localStorage.removeItem('nukrop_farmer_id');
  localStorage.removeItem('nukrop_user_uuid');
  localStorage.removeItem('nukrop_user_role');
}

async function nk_fetchUserProfile(email) {
  if (!sbClient) return null;
  const { data, error } = await sbClient
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) console.warn('Profile fetch:', error.message);
  return data;
}

// ─────────────────────────────────────────────────────────────────
// 2. COMMUNITY POSTS
// Schema: community_posts(id, author_id, user_id, farmer_id,
//   author_name NOT NULL, title NOT NULL, content NOT NULL,
//   crop_id NOT NULL, crop_tag, media_url, media_type, likes_count,
//   comments_count, is_verified, created_at, updated_at)
// NOTE: No video_url column — use media_url + media_type='video'
// ─────────────────────────────────────────────────────────────────
async function nk_fetchCommunityHistory(cropId = 'all', limit = 50) {
  if (!sbClient) return [];
  let query = sbClient
    .from('community_posts')
    .select('*, community_comments(count), community_likes(count)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cropId && cropId !== 'all') query = query.eq('crop_id', cropId);
  const { data, error } = await query;
  if (error) console.warn('Community fetch:', error.message);
  return data || [];
}

function nk_subscribeToCommunityPosts(onNewPostCallback) {
  if (!sbClient) return;
  sbClient.channel('realtime:community_posts')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'community_posts'
    }, payload => {
      console.log('🌱 New Community Post:', payload.new.title);
      onNewPostCallback(payload.new);
    })
    .subscribe();
}

/**
 * Create a community post.
 * SCHEMA FIX: No video_url column — if a video URL is supplied it goes
 * into media_url with media_type='video'; photos go with media_type='image'.
 */
async function nk_createCommunityPost(authorName, title, content, cropId, mediaUrl = null, videoUrl = null) {
  if (!sbClient) return { data: null, error: 'Offline' };
  const userUuid  = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId  = localStorage.getItem('nukrop_farmer_id') || null;

  // Resolve media — video takes precedence
  const finalMedia = videoUrl || mediaUrl || null;
  const finalType  = videoUrl ? 'video' : (mediaUrl ? 'image' : 'none');

  const payload = {
    author_name: authorName || 'Farmer',
    farmer_id:   farmerId,
    title:       title || 'Untitled',
    content:     content || '',
    crop_id:     cropId  || 'general',
    crop_tag:    cropId  || 'general',
    media_url:   finalMedia,
    media_type:  finalType
  };
  if (userUuid) {
    payload.user_id   = userUuid;
    payload.author_id = userUuid;
  }

  const { data, error } = await sbClient.from('community_posts').insert([payload]).select();
  if (error) console.error('Create post error:', error.message);
  return { data, error };
}

/**
 * Toggle like on a post.
 * SCHEMA FIX: likes_count is updated by counting community_likes rows,
 * not by calling a non-existent increment/decrement RPC.
 * Schema: community_likes(id, post_id FK→community_posts, user_id FK→profiles)
 */
async function nk_togglePostLike(postId, userId) {
  if (!sbClient) return;
  const userUuid = (userId && userId.length === 36 && userId.includes('-'))
    ? userId
    : (localStorage.getItem('nukrop_user_uuid') || null);
  if (!userUuid) {
    console.warn('Like requires authenticated user UUID');
    return;
  }

  // Check existing like
  const { data: existing } = await sbClient
    .from('community_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userUuid)
    .maybeSingle();

  if (existing) {
    await sbClient.from('community_likes').delete().eq('id', existing.id);
  } else {
    await sbClient.from('community_likes').insert([{ post_id: postId, user_id: userUuid }]);
  }

  // Recount and update likes_count
  const { count } = await sbClient
    .from('community_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  await sbClient.from('community_posts')
    .update({ likes_count: count || 0 })
    .eq('id', postId);
}

/**
 * Add comment.
 * Schema: community_comments(id, post_id FK NOT NULL, author_id,
 *   user_id, farmer_id, author_name NOT NULL, content NOT NULL, ...)
 */
async function nk_addComment(postId, authorName, content) {
  if (!sbClient) return;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;
  const payload  = {
    post_id:     postId,
    author_name: authorName || 'Farmer',
    farmer_id:   farmerId,
    content:     content || ''
  };
  if (userUuid) {
    payload.user_id   = userUuid;
    payload.author_id = userUuid;
  }
  const { error } = await sbClient.from('community_comments').insert([payload]);
  if (error) console.error('Comment insert error:', error.message);
}

// ─────────────────────────────────────────────────────────────────
// 3. GRAMHAUL — HAUL REQUESTS + HAUL_BOOKINGS PERSISTENCE
// Schema: haul_bookings(id, farmer_id, user_id, truck_id,
//   pickup_village NOT NULL, destination_mandi NOT NULL,
//   crop_name NOT NULL, load_quintals NOT NULL, agreed_fare NOT NULL,
//   status NOT NULL DEFAULT 'PENDING', vehicle_type, vehicle_plate,
//   driver_name, driver_phone, pickup_lat, pickup_lng,
//   dropoff_lat, dropoff_lng, drop_lat, drop_lng, ...)
// SCHEMA FIX: removed truck_type (doesn't exist) → use vehicle_type
// ─────────────────────────────────────────────────────────────────
function nk_subscribeToHaulRequests(driverId, onRequestCallback) {
  if (!sbClient) return;
  sbClient.channel(`haul:${driverId}`)
    .on('broadcast', { event: 'new_haul' }, payload => {
      console.log('🚚 Incoming Haul Request:', payload.payload);
      onRequestCallback(payload.payload);
    }).subscribe();
}

async function nk_sendHaulRequest(driverId, haulData) {
  if (!sbClient) {
    localStorage.setItem('gh_haul_request', JSON.stringify(haulData));
    return;
  }
  const channel = sbClient.channel(`haul:${driverId}`);
  await channel.send({ type: 'broadcast', event: 'new_haul', payload: haulData });
  console.log('📤 Haul request broadcast to driver:', driverId);
}

async function nk_acceptHaul(haulData) {
  if (!sbClient) return;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;

  // SCHEMA-ALIGNED: only columns that exist in haul_bookings
  const payload = {
    farmer_id:         farmerId,
    pickup_village:    haulData.pickup        || 'Farm Location',
    destination_mandi: haulData.mandi         || 'APMC Yard',
    crop_name:         haulData.crop          || 'Cotton',
    load_quintals:     haulData.weight        || 40,
    agreed_fare:       haulData.fare          || 1850,
    vehicle_type:      haulData.vehicleType   || haulData.truckType || 'Commercial Freight 2.5T',
    vehicle_plate:     haulData.vehiclePlate  || '',
    driver_name:       haulData.driverName    || '',
    driver_phone:      haulData.driverPhone   || '',
    pickup_lat:        haulData.pickup_lat    || null,
    pickup_lng:        haulData.pickup_lng    || null,
    drop_lat:          haulData.drop_lat      || null,
    drop_lng:          haulData.drop_lng      || null,
    status:            'PENDING'
  };
  if (userUuid) {
    payload.user_id        = userUuid;
    payload.farmer_user_id = userUuid;
  }

  const { data, error } = await sbClient.from('haul_bookings').insert([payload]).select();
  if (error) console.error('Haul booking save error:', error.message);
  return data;
}

async function nk_fetchHaulHistory() {
  if (!sbClient) return [];
  const userUuid = localStorage.getItem('nukrop_user_uuid');
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;
  let query = sbClient.from('haul_bookings').select('*');
  if (userUuid && farmerId) {
    query = query.or(`user_id.eq.${userUuid},farmer_user_id.eq.${userUuid},farmer_id.eq.${farmerId}`);
  } else if (userUuid) {
    query = query.or(`user_id.eq.${userUuid},farmer_user_id.eq.${userUuid}`);
  } else if (farmerId) {
    query = query.eq('farmer_id', farmerId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) console.warn('Haul history fetch error:', error.message);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────
// 4. DRIVER GPS TELEMETRY
// Schema: driver_telemetry(id, user_id, driver_id, driver_name,
//   vehicle_type, vehicle_plate, current_lat, current_lng,
//   heading, speed_kmh, is_online, battery_level, last_ping, ...)
// ─────────────────────────────────────────────────────────────────
let _gpsInterval  = null;
let _nkGpsWatchId = null;

async function nk_updateDriverTelemetry(driverId, lat, lng, speed = 0, heading = 0) {
  if (!sbClient || !driverId) return;
  const userUuid   = localStorage.getItem('nukrop_user_uuid') || null;
  const driverName = localStorage.getItem('nukrop_user_name')     || 'Registered Driver';
  const payload = {
    driver_id:     driverId,
    driver_name:   driverName,
    vehicle_plate: localStorage.getItem('nukrop_driver_plate')   || '',
    vehicle_type:  localStorage.getItem('nukrop_driver_vehicle') || 'Commercial Freight 2.5T',
    current_lat:   lat,
    current_lng:   lng,
    speed_kmh:     speed,
    heading:       heading,
    is_online:     true,
    last_ping:     new Date().toISOString(),
    updated_at:    new Date().toISOString()
  };
  if (userUuid) payload.user_id = userUuid;

  try {
    const { data, error } = await sbClient
      .from('driver_telemetry')
      .update(payload)
      .eq('driver_id', driverId)
      .select('driver_id');

    // Insert only if no row exists AND the user is authenticated
    if (!error && (!data || data.length === 0)) {
      const { data: sessionData } = await sbClient.auth.getSession();
      if (sessionData && sessionData.session) {
        await sbClient.from('driver_telemetry').insert([payload]);
      }
    }
  } catch (_) {}
}

function nk_startDriverLocationBroadcast(driverId, lat, lng) {
  if (!sbClient) return;
  if (_gpsInterval)    { clearInterval(_gpsInterval); _gpsInterval = null; }
  if (_nkGpsWatchId && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(_nkGpsWatchId);
    _nkGpsWatchId = null;
  }

  if (lat && lng) nk_updateDriverTelemetry(driverId, lat, lng);

  const topic = `gps:${driverId}`;
  if (sbClient.getChannels) {
    const existing = sbClient.getChannels().find(
      c => c.topic === `realtime:${topic}` || c.topic === topic
    );
    if (existing) { try { sbClient.removeChannel(existing); } catch (_) {} }
  }

  const channel = sbClient.channel(topic, {
    config: { presence: { key: driverId } }
  });

  channel
    .on('presence', { event: 'sync' }, () => console.log('Driver Presence Synced'))
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ driver: driverId, status: 'ONLINE', at: new Date().toISOString() });

        if (lat && lng) {
          channel.send({ type: 'broadcast', event: 'gps', payload: { lat, lng, ts: Date.now() } });
          sbClient.channel('driver-tracking').send({
            type: 'broadcast',
            event: 'driver_location_update',
            payload: { driverId, lat, lng, heading: 0, speedKmh: 0, timestamp: Date.now() }
          });
        }

        // Pure hardware GPS watchPosition — zero simulated setInterval
        if (typeof navigator !== 'undefined' && navigator.geolocation && navigator.geolocation.watchPosition) {
          _nkGpsWatchId = navigator.geolocation.watchPosition(
            async (pos) => {
              const liveLat  = pos.coords.latitude;
              const liveLng  = pos.coords.longitude;
              const hdg      = pos.coords.heading  || 0;
              const spd      = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

              await channel.send({
                type: 'broadcast', event: 'gps',
                payload: { lat: liveLat, lng: liveLng, heading: hdg, speedKmh: spd, ts: Date.now() }
              });
              sbClient.channel('driver-tracking').send({
                type: 'broadcast',
                event: 'driver_location_update',
                payload: { driverId, lat: liveLat, lng: liveLng, heading: hdg, speedKmh: spd, timestamp: Date.now() }
              });
              nk_updateDriverTelemetry(driverId, liveLat, liveLng, spd, hdg);
            },
            (err) => console.warn('[GPS Broadcast]', err.message),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
          );
        }
      }
    });
}

async function nk_stopDriverBroadcast(driverId) {
  if (_gpsInterval)    { clearInterval(_gpsInterval); _gpsInterval = null; }
  if (_nkGpsWatchId && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(_nkGpsWatchId);
    _nkGpsWatchId = null;
  }
  if (sbClient && driverId) {
    await sbClient.from('driver_telemetry')
      .update({ is_online: false, updated_at: new Date().toISOString() })
      .eq('driver_id', driverId);
    sbClient.channel('driver-tracking').send({
      type: 'broadcast',
      event: 'driver_duty_update',
      payload: { driverId, is_online: false, timestamp: Date.now() }
    });
  }
  console.log('📍 GPS Broadcast stopped.');
}

function nk_trackDriverLocation(driverId, onGPS, onStatus) {
  if (!sbClient || !driverId) return;
  const topic = `gps:${driverId}`;
  if (sbClient.getChannels) {
    const existing = sbClient.getChannels().find(
      c => c.topic === `realtime:${topic}` || c.topic === topic
    );
    if (existing) { try { sbClient.removeChannel(existing); } catch (_) {} }
  }
  const channel = sbClient.channel(topic);
  channel
    .on('broadcast', { event: 'gps' }, ({ payload }) => onGPS(payload))
    .on('presence',  { event: 'join'  }, () => onStatus && onStatus('ONLINE'))
    .on('presence',  { event: 'leave' }, () => onStatus && onStatus('OFFLINE'))
    .subscribe();
  return channel;
}

async function nk_fetchOnlineDrivers(limit = 15) {
  if (!sbClient) return [];
  try {
    const { data, error } = await sbClient.rpc('get_active_driver_telemetry');
    if (!error && Array.isArray(data) && data.length > 0) return data;
  } catch (_) {}

  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await sbClient
    .from('driver_telemetry')
    .select('driver_id, driver_name, vehicle_type, vehicle_plate, current_lat, current_lng, heading, speed_kmh, is_online, last_ping')
    .eq('is_online', true)
    .gt('last_ping', fiveMinsAgo)
    .limit(limit);
  if (error) { console.warn('Driver telemetry fetch:', error.message); return []; }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────
// 5. P2P CHAT / PEER MESSAGES
// Schema: peer_messages(id, sender_email NOT NULL, receiver_email NOT NULL,
//   receiver_name NOT NULL, message_text NOT NULL, is_read, created_at)
// ─────────────────────────────────────────────────────────────────
async function nk_fetchChatHistory(senderEmail, receiverEmail) {
  if (!sbClient) return [];
  const { data, error } = await sbClient
    .from('peer_messages')
    .select('*')
    .or(`and(sender_email.eq.${senderEmail},receiver_email.eq.${receiverEmail}),and(sender_email.eq.${receiverEmail},receiver_email.eq.${senderEmail})`)
    .order('created_at', { ascending: true });
  if (error) console.warn('Chat history:', error.message);
  return data || [];
}

function nk_subscribeToMessages(myEmail, onMessage) {
  if (!sbClient) return;
  sbClient.channel(`chat:${myEmail}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'peer_messages',
      filter: `receiver_email=eq.${myEmail}`
    }, payload => onMessage(payload.new))
    .subscribe();
}

async function nk_sendMessage(senderEmail, receiverEmail, receiverName, text) {
  if (!sbClient) return;
  const { error } = await sbClient.from('peer_messages').insert([{
    sender_email:   senderEmail,
    receiver_email: receiverEmail,
    receiver_name:  receiverName || 'Farmer',   // NOT NULL in schema
    message_text:   text
  }]);
  if (error) console.error('Send message error:', error.message);
}

// ─────────────────────────────────────────────────────────────────
// 6. DISEASE SCANS
// Schema: disease_scans(id, scan_id, farmer_id, user_id,
//   crop_name NOT NULL, scan_type, disease_name NOT NULL,
//   disease_detected, confidence TEXT, confidence_score NUMERIC,
//   severity, pathogen, treatment_chemical, treatment_organic,
//   chemical_solution, organic_solution, recommended_treatment,
//   image_storage_path, location, latitude, longitude,
//   gps_latitude, gps_longitude, notes, scanned_at NOT NULL,
//   created_at NOT NULL, crop_type, state, district)
// SCHEMA FIX: removed non-existent 'diagnosis' column,
//   confidence stored as text (e.g. '94%') AND confidence_score numeric
// ─────────────────────────────────────────────────────────────────
async function nk_saveDiseaScan(scanRecord) {
  if (!sbClient) return;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;

  // Use real GPS from liveWeather/localStorage when available
  const realLat = parseFloat(localStorage.getItem('user_live_lat')) || 17.9689;
  const realLng = parseFloat(localStorage.getItem('user_live_lon')) || 79.5941;
  const realLoc = localStorage.getItem('user_live_address') || 'Warangal Rural, Telangana';

  const confStr = String(scanRecord.confidence || '90').replace(/[^0-9.]/g, '');
  const confNum = parseFloat(confStr) || 90.0;

  const payload = {
    farmer_id:            farmerId,
    crop_name:            scanRecord.cropName       || 'Unknown',
    scan_type:            scanRecord.scanType       || 'leaf',
    disease_name:         scanRecord.diseaseName    || 'Healthy',
    disease_detected:     scanRecord.diseaseName    || 'Healthy',
    confidence:           confStr + '%',            // TEXT column
    confidence_score:     confNum,                  // NUMERIC column
    severity:             scanRecord.severity       || 'LOW',
    pathogen:             scanRecord.pathogen       || 'Unknown',
    pathogen_type:        scanRecord.pathogen       || 'Unknown',
    treatment_chemical:   scanRecord.chemical       || scanRecord.chemicalSolution || '',
    treatment_organic:    scanRecord.organic        || scanRecord.organicSolution  || '',
    chemical_solution:    scanRecord.chemical       || scanRecord.chemicalSolution || '',
    organic_solution:     scanRecord.organic        || scanRecord.organicSolution  || '',
    recommended_treatment: scanRecord.treatment     || scanRecord.organic || '',
    location:             realLoc,
    latitude:             realLat,
    longitude:            realLng,
    gps_latitude:         realLat,
    gps_longitude:        realLng,
    state:                'Telangana',
    district:             localStorage.getItem('user_live_district') || 'Warangal',
    notes:                scanRecord.notes          || null,
    image_storage_path:   scanRecord.imagePath      || null
  };
  if (userUuid) payload.user_id = userUuid;

  const { error } = await sbClient.from('disease_scans').insert([payload]);
  if (error) console.error('Scan save error:', error.message);
  else console.log('✅ Disease scan saved to Supabase.');
}

// ─────────────────────────────────────────────────────────────────
// 7. KHATA TRANSACTIONS (Farm Ledger)
// Schema: khata_transactions(id, user_id,
//   type VARCHAR NOT NULL CHECK (type IN ('income','expense')),
//   category VARCHAR NOT NULL,
//   description TEXT NOT NULL,
//   amount NUMERIC NOT NULL CHECK (amount > 0),
//   transaction_date DATE DEFAULT CURRENT_DATE,
//   payment_mode VARCHAR DEFAULT 'Cash',
//   created_at TIMESTAMPTZ)
// SCHEMA FIX: was sending 'transaction_type' and 'crop_cycle' — both wrong
// ─────────────────────────────────────────────────────────────────
async function nk_saveKhataTransaction(entry) {
  if (!sbClient) return null;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;

  // Normalise type to lowercase 'income' | 'expense' per CHECK constraint
  const txType = ((entry.type || 'expense') === 'income') ? 'income' : 'expense';

  // description must be text (not object)
  const descText = (typeof entry.desc === 'object')
    ? (entry.desc.en || JSON.stringify(entry.desc))
    : (entry.desc || entry.description || 'Farm transaction');

  const payload = {
    type:             txType,
    category:         entry.category || 'General Agriculture',
    description:      descText,
    amount:           Math.abs(parseFloat(entry.amount) || 0),
    transaction_date: entry.date || new Date().toISOString().split('T')[0],
    payment_mode:     entry.paymentMode || 'Cash'
  };

  if (!payload.amount || payload.amount <= 0) {
    console.warn('Khata: amount must be > 0, skipping insert.');
    return null;
  }

  if (userUuid) payload.user_id = userUuid;

  const { data, error } = await sbClient.from('khata_transactions').insert([payload]).select();
  if (error) console.warn('Khata transaction save error:', error.message);
  else console.log('✅ Khata transaction synced to Supabase.');
  return data;
}

async function nk_fetchKhataTransactions() {
  if (!sbClient) return [];
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  let query = sbClient.from('khata_transactions').select('*');
  if (userUuid) query = query.eq('user_id', userUuid);
  const { data, error } = await query.order('transaction_date', { ascending: false });
  if (error) console.warn('Khata fetch error:', error.message);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────
// 8. MACHINERY LISTINGS
// Schema: machinery_listings(id, owner_id FK→profiles,
//   category VARCHAR NOT NULL CHECK (category IN ('tractor','drone','harvester','sprayer')),
//   model_name VARCHAR NOT NULL,
//   hourly_rate NUMERIC NOT NULL,
//   acre_rate NUMERIC,
//   hub_name VARCHAR NOT NULL,        ← was missing entirely
//   phone VARCHAR NOT NULL,           ← was 'contact_phone'
//   specifications TEXT,              ← was 'specs'
//   is_available BOOL DEFAULT true,
//   created_at TIMESTAMPTZ)
// SCHEMA FIX: machinery_type → category, contact_phone → phone,
//   specs → specifications, owner_user_id → owner_id,
//   daily_rate/district/state/photo_url DO NOT EXIST — removed
// ─────────────────────────────────────────────────────────────────

// Valid category values per CHECK constraint
const VALID_MACHINERY_CATEGORIES = ['tractor', 'drone', 'harvester', 'sprayer'];

async function nk_fetchMachineryListings(categoryFilter = null) {
  if (!sbClient) return [];
  let query = sbClient
    .from('machinery_listings')
    .select('*')
    .eq('is_available', true);
  // SCHEMA FIX: filter on 'category' not 'machinery_type'
  if (categoryFilter && categoryFilter !== 'all' && VALID_MACHINERY_CATEGORIES.includes(categoryFilter)) {
    query = query.eq('category', categoryFilter);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) console.warn('Machinery fetch error:', error.message);
  return data || [];
}

async function nk_createMachineryListing(listing) {
  if (!sbClient) return null;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;

  // Normalize category to one of the 4 valid CHECK values
  const rawCat = (listing.category || 'tractor').toLowerCase();
  const category = VALID_MACHINERY_CATEGORIES.includes(rawCat) ? rawCat : 'tractor';

  const modelName = (typeof listing.name === 'object' ? listing.name.en : listing.name) || 'Farm Equipment';

  const payload = {
    category:        category,
    model_name:      modelName,
    hourly_rate:     parseFloat(listing.hourlyRate || listing.hourly_rate) || 700,
    acre_rate:       parseFloat(listing.acreRate   || listing.acre_rate)   || null,
    hub_name:        (typeof listing.hub === 'object' ? listing.hub.en : listing.hub) || 'Local Hub',
    phone:           listing.phone || '+91 98490 22338',
    specifications:  (typeof listing.specs === 'object' ? listing.specs.en : listing.specs) || null,
    is_available:    true
  };

  // owner_id FK references profiles(id) — only set if we have the UUID
  if (userUuid) payload.owner_id = userUuid;

  const { data, error } = await sbClient.from('machinery_listings').insert([payload]).select();
  if (error) console.warn('Machinery listing save error:', error.message);
  else console.log('✅ Machinery listing synced to Supabase.');
  return data;
}

// ─────────────────────────────────────────────────────────────────
// 9. MANDI RATES (Agmarknet / OGD Integration)
// Schema: mandi_live_rates(state, district, market, commodity,
//   min_price, max_price, modal_price, trend, trade_date,
//   market_name, source_name, market_center_lat, market_center_lng,
//   freshness_status, updated_at, created_at, ...)
// ─────────────────────────────────────────────────────────────────
async function nk_fetchMandiRates(state = 'Telangana', limit = 40) {
  if (!sbClient) return [];
  const { data, error } = await sbClient
    .from('mandi_live_rates')
    .select('id, state, district, market, market_name, commodity, commodity_te, commodity_hi, variety, min_price, max_price, modal_price, msp_price, trend, trend_pct, trade_date, freshness_status, source_name, market_center_lat, market_center_lng, updated_at')
    .eq('state', state)
    .order('trade_date', { ascending: false })
    .limit(limit);
  if (error) console.warn('Mandi rates fetch:', error.message);
  return data || [];
}

async function nk_fetchNearbyMandis(lat, lng, radiusKm = 100, commodity = null) {
  if (!sbClient) return [];
  const validLat = parseFloat(lat);
  const validLng = parseFloat(lng);
  if (isNaN(validLat) || isNaN(validLng) || validLat < -90 || validLat > 90 || validLng < -180 || validLng > 180) {
    console.warn('Invalid GPS for mandi resolution:', lat, lng);
    return nk_fetchMandiRates();
  }
  try {
    let query = sbClient.from('mandi_live_rates').select('*');
    if (commodity) query = query.ilike('commodity', `%${commodity}%`);
    const { data, error } = await query.order('trade_date', { ascending: false }).limit(60);
    if (!error && Array.isArray(data) && data.length > 0) {
      const withDist = data.map(m => {
        const mLat = parseFloat(m.market_center_lat) || validLat;
        const mLng = parseFloat(m.market_center_lng) || validLng;
        const dLat = (mLat - validLat) * Math.PI / 180;
        const dLng = (mLng - validLng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
          Math.cos(validLat * Math.PI / 180) * Math.cos(mLat * Math.PI / 180) * Math.sin(dLng/2)**2;
        const dist_km = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 10) / 10;
        return { ...m, distance_km: dist_km };
      });
      withDist.sort((a, b) => a.distance_km - b.distance_km);
      return withDist;
    }
  } catch (err) {
    console.warn('Mandi distance fallback:', err.message);
  }
  return nk_fetchMandiRates();
}

function nk_subscribeToMandiRates(onUpdate) {
  if (!sbClient) return;
  sbClient.channel('realtime:mandi_live_rates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mandi_live_rates' },
      payload => onUpdate(payload.new))
    .subscribe();
}

// ─────────────────────────────────────────────────────────────────
// 10. REALTIME RESILIENCE MANAGER
// ─────────────────────────────────────────────────────────────────
const NuKropRealtimeManager = {
  activeChannels:   new Map(),
  processedEventIds: new Set(),

  registerChannel(channelName, channelObj) {
    if (this.activeChannels.has(channelName)) {
      try { this.activeChannels.get(channelName).unsubscribe(); } catch (_) {}
    }
    this.activeChannels.set(channelName, channelObj);
    return channelObj;
  },

  cleanupChannel(channelName) {
    if (this.activeChannels.has(channelName)) {
      try {
        this.activeChannels.get(channelName).unsubscribe();
        this.activeChannels.delete(channelName);
      } catch (_) {}
    }
  },

  isDuplicateEvent(eventId) {
    if (!eventId) return false;
    if (this.processedEventIds.has(eventId)) return true;
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > 500) {
      const first = this.processedEventIds.values().next().value;
      this.processedEventIds.delete(first);
    }
    return false;
  }
};
window.NuKropRealtimeManager = NuKropRealtimeManager;

// ─────────────────────────────────────────────────────────────────
// 11. MACHINERY BOOKINGS (CHC Dispatch & Reservation)
// Schema: machinery_bookings(id, booking_ref UNIQUE, machine_id,
//   machine_name, farmer_name, farmer_phone, farmer_village,
//   acreage, total_amount, booking_date, status, user_id, farmer_id,
//   machinery_id, booking_unit, quantity, service_date, time_slot)
// ─────────────────────────────────────────────────────────────────
async function nk_createMachineryBooking(b) {
  if (!sbClient) return { data: null, error: 'Offline' };
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;

  const payload = {
    booking_ref:    b.booking_ref || ('CHC-ORD-' + Math.floor(100000 + Math.random() * 900000)),
    machine_id:     String(b.machine_id || 'CHC-MACH'),
    machine_name:   b.machine_name || 'Farm Machinery',
    farmer_name:    b.farmer_name  || localStorage.getItem('nukrop_user_name') || 'Farmer',
    farmer_phone:   b.farmer_phone || localStorage.getItem('nukrop_user_phone') || '+91 98492 11048',
    farmer_village: b.farmer_village || localStorage.getItem('user_live_address') || 'Warangal Rural',
    acreage:        b.booking_unit === 'acre' ? (parseFloat(b.quantity) || 2.0) : null,
    total_amount:   parseFloat(b.total_amount) || 0,
    booking_date:   b.booking_date || new Date().toISOString().split('T')[0],
    status:         b.status || 'DISPATCHED',
    farmer_id:      farmerId,
    booking_unit:   b.booking_unit || 'acre',
    quantity:       parseFloat(b.quantity) || 1.0,
    service_date:   b.service_date || new Date().toISOString().split('T')[0],
    time_slot:      b.time_slot || 'Morning (06:00 - 10:00 AM)'
  };

  // Only assign FK if UUID exists in profiles
  if (userUuid && userUuid.length === 36 && userUuid.includes('-')) {
    payload.user_id = userUuid;
  }
  // If machinery_id matches a UUID listing in machinery_listings
  if (b.machinery_id && typeof b.machinery_id === 'string' && b.machinery_id.length === 36 && b.machinery_id.includes('-')) {
    payload.machinery_id = b.machinery_id;
  }

  const { data, error } = await sbClient.from('machinery_bookings').insert([payload]).select();
  if (error) console.error('Machinery booking error:', error.message);
  else console.log('✅ Machinery booking saved to Supabase:', payload.booking_ref);
  return { data, error };
}

async function nk_fetchUserMachineryBookings() {
  if (!sbClient) return [];
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;

  let query = sbClient.from('machinery_bookings').select('*');
  if (userUuid && farmerId) {
    query = query.or(`user_id.eq.${userUuid},farmer_id.eq.${farmerId}`);
  } else if (userUuid) {
    query = query.eq('user_id', userUuid);
  } else if (farmerId) {
    query = query.eq('farmer_id', farmerId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) { console.warn('Fetch machinery bookings:', error.message); return []; }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────
// 12. OUTBREAK ALERTS (Regional Pest & Micro-Climate Vectors)
// Schema: outbreak_alerts(id, target_state, crop_name, disease_name,
//   severity, scan_count, is_active, alert_message, pest_name, state,
//   district, market_price_impact, broadcast_message, created_at)
// ─────────────────────────────────────────────────────────────────
async function nk_fetchOutbreakAlerts(state = 'Telangana', district = null) {
  if (!sbClient) return [];
  let query = sbClient.from('outbreak_alerts').select('*').eq('is_active', true);
  if (state) query = query.or(`target_state.eq.${state},state.eq.${state}`);
  if (district) query = query.eq('district', district);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
  if (error) { console.warn('Outbreak alerts fetch:', error.message); return []; }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────
// 13. MANDI & PRICE ALERTS
// Schema: price_alerts(id, user_id, crop_slug, mandi_id,
//   target_price_per_qtl, alert_condition, notification_channel, is_active)
// Schema: mandi_alerts(id, farmer_id, user_id, commodity,
//   target_price, condition, is_active)
// ─────────────────────────────────────────────────────────────────
async function nk_savePriceAlert(alertData) {
  if (!sbClient) return;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;

  // 1. Save to price_alerts if valid UUID user_id
  if (userUuid) {
    try {
      await sbClient.from('price_alerts').insert([{
        user_id:              userUuid,
        crop_slug:            String(alertData.cropSlug || alertData.cropKey || 'cotton').toLowerCase(),
        mandi_id:             String(alertData.mandi || 'Warangal APMC Yard'),
        target_price_per_qtl: parseFloat(alertData.targetPrice) || 7500,
        alert_condition:      'ABOVE',
        notification_channel: 'ALL',
        is_active:            true
      }]);
    } catch (_) {}
  }

  // 2. Save to mandi_alerts
  try {
    const payload = {
      farmer_id:    farmerId,
      commodity:    alertData.cropName || 'Cotton',
      target_price: parseFloat(alertData.targetPrice) || 7500,
      condition:    'GTE',
      is_active:    true
    };
    if (userUuid) payload.user_id = userUuid;
    await sbClient.from('mandi_alerts').insert([payload]);
    console.log('✅ Mandi alert saved to Supabase');
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────
// 14. AI AGRONOMIST CHAT MESSAGES
// Schema: chat_messages(id, farmer_id, user_id, session_id,
//   role, message_text, tokens_consumed, language, created_at)
// ─────────────────────────────────────────────────────────────────
async function nk_saveChatMessage(sessionId, role, text, lang = 'en') {
  if (!sbClient || !text) return;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;

  const payload = {
    farmer_id:       farmerId,
    session_id:      String(sessionId || 'sess_default'),
    role:            role || 'user',
    message_text:    text,
    tokens_consumed: Math.max(5, Math.ceil(text.length / 4)),
    language:        lang || 'en'
  };
  if (userUuid) payload.user_id = userUuid;

  try {
    await sbClient.from('chat_messages').insert([payload]);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────
// 15. SOIL HEALTH CARDS
// Schema: soil_health_cards(id, farmer_id, user_id, sample_code,
//   ph_level, organic_carbon_pct, nitrogen_kg_ha, phosphorus_kg_ha,
//   potassium_kg_ha, zinc_ppm, iron_ppm, micronutrient_status, recommendations)
// ─────────────────────────────────────────────────────────────────
async function nk_fetchSoilHealthCard() {
  if (!sbClient) return null;
  const userUuid = localStorage.getItem('nukrop_user_uuid') || null;
  const farmerId = localStorage.getItem('nukrop_farmer_id') || null;

  let query = sbClient.from('soil_health_cards').select('*');
  if (userUuid && farmerId) {
    query = query.or(`user_id.eq.${userUuid},farmer_id.eq.${farmerId}`);
  } else if (userUuid) {
    query = query.eq('user_id', userUuid);
  } else if (farmerId) {
    query = query.eq('farmer_id', farmerId);
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) { console.warn('Soil card fetch:', error.message); return null; }
  return data;
}

// ─────────────────────────────────────────────────────────────────
// 16. TRIP WAYPOINTS (In-Transit High-Resolution Telemetry)
// Schema: trip_waypoints(id, booking_id FK, driver_id FK,
//   lat, lng, speed_kmh, heading, recorded_at)
// ─────────────────────────────────────────────────────────────────
async function nk_saveTripWaypoint(bookingId, driverUuid, lat, lng, speed = 0, heading = 0) {
  if (!sbClient || !bookingId || !driverUuid || isNaN(lat) || isNaN(lng)) return;
  try {
    await sbClient.from('trip_waypoints').insert([{
      booking_id: bookingId,
      driver_id:  driverUuid,
      lat:        parseFloat(lat),
      lng:        parseFloat(lng),
      speed_kmh:  parseFloat(speed) || 0,
      heading:    parseFloat(heading) || 0
    }]);
  } catch (_) {}
}

// ─── WINDOW EXPORTS FOR GLOBAL RUNTIME INTEROP ───
if (typeof nk_signUp !== 'undefined') window.nk_signUp = nk_signUp;
if (typeof nk_loginUser !== 'undefined') window.nk_loginUser = nk_loginUser;
if (typeof nk_logout !== 'undefined') window.nk_logout = nk_logout;
if (typeof nk_fetchUserProfile !== 'undefined') window.nk_fetchUserProfile = nk_fetchUserProfile;
if (typeof nk_fetchCommunityHistory !== 'undefined') window.nk_fetchCommunityHistory = nk_fetchCommunityHistory;
if (typeof nk_subscribeToCommunityPosts !== 'undefined') window.nk_subscribeToCommunityPosts = nk_subscribeToCommunityPosts;
if (typeof nk_createCommunityPost !== 'undefined') window.nk_createCommunityPost = nk_createCommunityPost;
if (typeof nk_togglePostLike !== 'undefined') window.nk_togglePostLike = nk_togglePostLike;
if (typeof nk_addComment !== 'undefined') window.nk_addComment = nk_addComment;
if (typeof nk_subscribeToHaulRequests !== 'undefined') window.nk_subscribeToHaulRequests = nk_subscribeToHaulRequests;
if (typeof nk_sendHaulRequest !== 'undefined') window.nk_sendHaulRequest = nk_sendHaulRequest;
if (typeof nk_acceptHaul !== 'undefined') window.nk_acceptHaul = nk_acceptHaul;
if (typeof nk_fetchHaulHistory !== 'undefined') window.nk_fetchHaulHistory = nk_fetchHaulHistory;
if (typeof nk_updateDriverTelemetry !== 'undefined') window.nk_updateDriverTelemetry = nk_updateDriverTelemetry;
if (typeof nk_startDriverLocationBroadcast !== 'undefined') window.nk_startDriverLocationBroadcast = nk_startDriverLocationBroadcast;
if (typeof nk_stopDriverBroadcast !== 'undefined') window.nk_stopDriverBroadcast = nk_stopDriverBroadcast;
if (typeof nk_trackDriverLocation !== 'undefined') window.nk_trackDriverLocation = nk_trackDriverLocation;
if (typeof nk_fetchOnlineDrivers !== 'undefined') window.nk_fetchOnlineDrivers = nk_fetchOnlineDrivers;
if (typeof nk_fetchChatHistory !== 'undefined') window.nk_fetchChatHistory = nk_fetchChatHistory;
if (typeof nk_subscribeToMessages !== 'undefined') window.nk_subscribeToMessages = nk_subscribeToMessages;
if (typeof nk_sendMessage !== 'undefined') window.nk_sendMessage = nk_sendMessage;
if (typeof nk_saveDiseaScan !== 'undefined') window.nk_saveDiseaScan = nk_saveDiseaScan;
if (typeof nk_saveKhataTransaction !== 'undefined') window.nk_saveKhataTransaction = nk_saveKhataTransaction;
if (typeof nk_fetchKhataTransactions !== 'undefined') window.nk_fetchKhataTransactions = nk_fetchKhataTransactions;
if (typeof nk_fetchMachineryListings !== 'undefined') window.nk_fetchMachineryListings = nk_fetchMachineryListings;
if (typeof nk_createMachineryListing !== 'undefined') window.nk_createMachineryListing = nk_createMachineryListing;
if (typeof nk_fetchMandiRates !== 'undefined') window.nk_fetchMandiRates = nk_fetchMandiRates;
if (typeof nk_fetchNearbyMandis !== 'undefined') window.nk_fetchNearbyMandis = nk_fetchNearbyMandis;
if (typeof nk_subscribeToMandiRates !== 'undefined') window.nk_subscribeToMandiRates = nk_subscribeToMandiRates;
if (typeof nk_createMachineryBooking !== 'undefined') window.nk_createMachineryBooking = nk_createMachineryBooking;
if (typeof nk_fetchUserMachineryBookings !== 'undefined') window.nk_fetchUserMachineryBookings = nk_fetchUserMachineryBookings;
if (typeof nk_fetchOutbreakAlerts !== 'undefined') window.nk_fetchOutbreakAlerts = nk_fetchOutbreakAlerts;
if (typeof nk_savePriceAlert !== 'undefined') window.nk_savePriceAlert = nk_savePriceAlert;
if (typeof nk_saveChatMessage !== 'undefined') window.nk_saveChatMessage = nk_saveChatMessage;
if (typeof nk_fetchSoilHealthCard !== 'undefined') window.nk_fetchSoilHealthCard = nk_fetchSoilHealthCard;
if (typeof nk_saveTripWaypoint !== 'undefined') window.nk_saveTripWaypoint = nk_saveTripWaypoint;
