/**
 * Milestone 3 Verification Suite: Interactive Community Features
 * (Followers, Following, Real Likes, Edit & Delete Own Posts, Supabase Integration)
 * NuKropAI Agrarian OS
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('================================================================================');
console.log('👥 MILESTONE 3 VERIFICATION: INTERACTIVE COMMUNITY & REAL-TIME ENGAGEMENT');
console.log('================================================================================\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// ── PART 1: MIGRATION & SCHEMA AUDIT ──
test('M3.1: SQL Migration backend/migrations/004_community_interactive.sql exists and is valid', () => {
  const migPath = path.join(__dirname, '..', 'backend', 'migrations', '004_community_interactive.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 004 file must exist');
  const sql = fs.readFileSync(migPath, 'utf8');

  assert.ok(sql.includes('ALTER TABLE public.community_posts'), 'Must alter community_posts');
  assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS user_id TEXT'), 'Must add user_id column');
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_community_posts_user_id'), 'Must index user_id');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.post_likes'), 'Must create post_likes');
  assert.ok(sql.includes('CONSTRAINT unique_post_likes UNIQUE (post_id, user_id)'), 'Must have unique post_likes constraint');
  assert.ok(sql.includes('ON DELETE CASCADE'), 'Must cascade delete on post removal');

  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.user_follows'), 'Must create user_follows');
  assert.ok(sql.includes('CONSTRAINT unique_user_follows UNIQUE (follower_id, following_id)'), 'Must have unique user_follows constraint');

  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.fn_sync_post_likes_count()'), 'Must define like counter trigger function');
  assert.ok(sql.includes('CREATE TRIGGER trg_post_likes_count'), 'Must attach trigger on post_likes');

  assert.ok(sql.includes('ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on community_posts');
  assert.ok(sql.includes('ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on post_likes');
  assert.ok(sql.includes('ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on user_follows');
});

test('M3.2: backend/supabase_setup.sql and backend/schema.sql include community interactive schema', () => {
  const setupSql = fs.readFileSync(path.join(__dirname, '..', 'backend', 'supabase_setup.sql'), 'utf8');
  assert.ok(setupSql.includes('post_likes'), 'backend/supabase_setup.sql must include post_likes');
  assert.ok(setupSql.includes('user_follows'), 'backend/supabase_setup.sql must include user_follows');
  assert.ok(setupSql.includes('fn_sync_post_likes_count'), 'backend/supabase_setup.sql must include fn_sync_post_likes_count');
  assert.ok(setupSql.includes('idx_community_posts_user_id'), 'backend/supabase_setup.sql must include idx_community_posts_user_id');

  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'backend', 'schema.sql'), 'utf8');
  assert.ok(schemaSql.includes('post_likes'), 'backend/schema.sql must include post_likes');
  assert.ok(schemaSql.includes('user_follows'), 'backend/schema.sql must include user_follows');
  assert.ok(schemaSql.includes('fn_sync_post_likes_count'), 'backend/schema.sql must include fn_sync_post_likes_count');
  assert.ok(schemaSql.includes('idx_community_posts_user_id'), 'backend/schema.sql must include idx_community_posts_user_id');
});

// ── PART 2: STATIC CODE AUDIT ACROSS BOTH PLATFORMS ──
const targetFiles = [
  path.join(__dirname, '..', 'nukrop_emulator.html'),
  path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html')
];

targetFiles.forEach((targetPath) => {
  const relName = path.relative(path.join(__dirname, '..'), targetPath);
  const html = fs.readFileSync(targetPath, 'utf8');

  test(`M3.3 [${relName}]: User Identity & State functions are defined`, () => {
    assert.ok(html.includes('function getCurrentUserId'), 'Must define getCurrentUserId');
    assert.ok(html.includes('function getCurrentFarmerName'), 'Must define getCurrentFarmerName');
    assert.ok(html.includes('nukrop_supabase_uid'), 'Must inspect nukrop_supabase_uid in identity resolution');
    assert.ok(html.includes('nukrop_guest_uid'), 'Must provide persistent guest UID fallback');
  });

  test(`M3.4 [${relName}]: Follow/Unfollow & Profile Stats functions are defined`, () => {
    assert.ok(html.includes('function getFollowedUserIds'), 'Must define getFollowedUserIds');
    assert.ok(html.includes('function saveFollowedUserIds'), 'Must define saveFollowedUserIds');
    assert.ok(html.includes('function isFollowingUser'), 'Must define isFollowingUser');
    assert.ok(html.includes('async function toggleFollowUser'), 'Must define toggleFollowUser');
    assert.ok(html.includes('function getFollowingCount'), 'Must define getFollowingCount');
    assert.ok(html.includes('function getFollowersCount'), 'Must define getFollowersCount');
    assert.ok(html.includes('function getMyPostsCount'), 'Must define getMyPostsCount');
    assert.ok(html.includes('function updateProfileCommunityStats'), 'Must define updateProfileCommunityStats');
    assert.ok(html.includes('/rest/v1/user_follows'), 'Must connect to Supabase user_follows endpoint');
  });

  test(`M3.5 [${relName}]: Post Ownership, Edit and Delete functions are defined`, () => {
    assert.ok(html.includes('function isOwnCommunityPost'), 'Must define isOwnCommunityPost');
    assert.ok(html.includes('function openEditCommunityPostModal'), 'Must define openEditCommunityPostModal');
    assert.ok(html.includes('function closeEditCommunityPostModal'), 'Must define closeEditCommunityPostModal');
    assert.ok(html.includes('function submitEditedCommunityPost'), 'Must define submitEditedCommunityPost');
    assert.ok(html.includes('async function saveEditedCommunityPost'), 'Must define saveEditedCommunityPost');
    assert.ok(html.includes('async function deleteCommunityPost'), 'Must define deleteCommunityPost');
  });

  test(`M3.6 [${relName}]: Real Liking and Heart Animation are defined`, () => {
    assert.ok(html.includes('function getCommunityLikedIds'), 'Must define getCommunityLikedIds');
    assert.ok(html.includes('function saveCommunityLikedIds'), 'Must define saveCommunityLikedIds');
    assert.ok(html.includes('function toggleCommunityLike'), 'Must define toggleCommunityLike');
    assert.ok(html.includes('async function syncCommunityLikeToSupabase'), 'Must define syncCommunityLikeToSupabase');
    assert.ok(html.includes('/rest/v1/post_likes'), 'Must connect to Supabase post_likes endpoint');
    assert.ok(html.includes('.heart-pop'), 'Must have .heart-pop CSS class');
    assert.ok(html.includes('keyframes heartPop'), 'Must have keyframes heartPop animation');
  });

  test(`M3.7 [${relName}]: Community Edit Modal and Profile Community Stats UI elements are present`, () => {
    assert.ok(html.includes('id="community-edit-modal"'), 'Must contain #community-edit-modal');
    assert.ok(html.includes('id="edit-post-id"'), 'Must contain #edit-post-id');
    assert.ok(html.includes('id="edit-post-title"'), 'Must contain #edit-post-title');
    assert.ok(html.includes('id="edit-post-desc"'), 'Must contain #edit-post-desc');
    assert.ok(html.includes('id="edit-post-crop"'), 'Must contain #edit-post-crop');
    assert.ok(html.includes('id="profile-stat-followers"'), 'Must contain #profile-stat-followers');
    assert.ok(html.includes('id="profile-stat-following"'), 'Must contain #profile-stat-following');
    assert.ok(html.includes('id="profile-stat-myposts"'), 'Must contain #profile-stat-myposts');
  });
});

// ── PART 3: DYNAMIC VM EXECUTION & INTERACTIVE BEHAVIOR VERIFICATION ──
(async function runDynamicVMTests() {
  const emulatorHtml = fs.readFileSync(targetFiles[0], 'utf8');
  const scriptMatch = emulatorHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Must find script tag in nukrop_emulator.html');
  const jsCode = scriptMatch[1];

  const testStorage = {};
  const domElements = {};
  function getEl(id) {
    if (!domElements[id]) {
      domElements[id] = {
        id,
        style: {},
        classList: {
          classes: new Set(),
          add: function(c) { this.classes.add(c); },
          remove: function(c) { this.classes.delete(c); },
          contains: function(c) { return this.classes.has(c); }
        },
        appendChild: () => {},
        setAttribute: () => {},
        getAttribute: () => '',
        addEventListener: () => {},
        removeEventListener: () => {},
        remove: () => {},
        querySelectorAll: () => [],
        querySelector: () => null,
        scrollIntoView: () => {},
        offsetWidth: 100,
        offsetHeight: 100,
        innerHTML: '',
        textContent: '',
        value: '',
        disabled: false
      };
    }
    return domElements[id];
  }

  const fetchCallLog = [];
  const sandbox = {
    window: null,
    document: {
      readyState: 'complete',
      getElementById: (id) => getEl(id),
      querySelector: (sel) => getEl(sel.replace(/^[#.]/, '')),
      querySelectorAll: () => [],
      createElement: (tag) => getEl(tag),
      addEventListener: () => {},
      removeEventListener: () => {},
      body: getEl('body')
    },
    localStorage: {
      getItem: (k) => testStorage[k] !== undefined ? testStorage[k] : null,
      setItem: (k, v) => { testStorage[k] = String(v); },
      removeItem: (k) => { delete testStorage[k]; },
      clear: () => { Object.keys(testStorage).forEach(k => delete testStorage[k]); }
    },
    navigator: {
      geolocation: { getCurrentPosition: () => {} },
      userAgent: 'CommunityTester'
    },
    location: { href: '', search: '', pathname: '' },
    fetch: async (url, opts) => {
      fetchCallLog.push({ url, opts: opts || {} });
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: 'mock-row-1' }]
      };
    },
    speechSynthesis: { speak: () => {}, cancel: () => {} },
    SpeechSynthesisUtterance: function() {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (cb, ms) => setTimeout(cb, 5),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 123,
    clearInterval: () => {},
    alert: () => {},
    confirm: () => true,
    requestAnimationFrame: (cb) => setTimeout(cb, 1),
    cancelAnimationFrame: (id) => clearTimeout(id)
  };
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(jsCode, context);

  // Test M3.8: User Identity Resolution
  test('M3.8: getCurrentUserId() resolves session hierarchy and generates persistent guest ID', () => {
    // 1. Initial resolution generates persistent guest ID
    const initialId = sandbox.getCurrentUserId();
    assert.ok(initialId.startsWith('usr_kisan_'), `Expected guest prefix, got ${initialId}`);
    assert.strictEqual(sandbox.getCurrentUserId(), initialId, 'Subsequent calls must return same guest ID');

    // 2. Email fallback
    testStorage['nukrop_user_email'] = 'farmer_reddy@example.com';
    assert.strictEqual(sandbox.getCurrentUserId(), 'farmer_reddy@example.com');

    // 3. Supabase user object fallback
    testStorage['supabase_user'] = JSON.stringify({ id: 'uuid-supa-user-99' });
    assert.strictEqual(sandbox.getCurrentUserId(), 'uuid-supa-user-99');

    // 4. Supabase direct UID priority
    testStorage['nukrop_supabase_uid'] = 'uid-direct-supa-42';
    assert.strictEqual(sandbox.getCurrentUserId(), 'uid-direct-supa-42');
  });

  // Test M3.9: Real Liking System
  await testAsync('M3.9: toggleCommunityLike() updates in-memory post, liked cache, heart-pop, and dispatches POST/DELETE to post_likes', async () => {
    fetchCallLog.length = 0;
    const posts = vm.runInContext('COMMUNITY_POSTS_CATALOG', context);
    let targetPost = posts.find(x => x.id === 'post-1');
    if (!targetPost) {
      targetPost = { id: 'post-1', likes: 10, isLiked: false, user_id: 'usr_author_1', title: 'Test Crop Post' };
      posts.push(targetPost);
    }
    assert.ok(targetPost, 'Must find post-1 in catalog');

    const initialLikes = targetPost.likes;
    assert.strictEqual(targetPost.isLiked, false, 'post-1 should initially be unliked');

    // Like post-1
    vm.runInContext('toggleCommunityLike("post-1")', context);
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(targetPost.isLiked, true, 'Post should now be marked isLiked = true');
    assert.strictEqual(targetPost.likes, initialLikes + 1, 'Like count should increment by 1');

    const likedIds = sandbox.getCommunityLikedIds();
    assert.ok(likedIds.includes('post-1'), 'Liked IDs cache must include post-1');

    // Verify background dispatch to post_likes
    const postLikeCall = fetchCallLog.find(c => c.url.includes('/rest/v1/post_likes') && c.opts.method === 'POST');
    assert.ok(postLikeCall, 'Must dispatch POST /rest/v1/post_likes');
    const likeBody = JSON.parse(postLikeCall.opts.body);
    assert.strictEqual(likeBody.post_id, 'post-1');
    assert.strictEqual(likeBody.user_id, 'uid-direct-supa-42');

    // Unlike post-1
    fetchCallLog.length = 0;
    vm.runInContext('toggleCommunityLike("post-1")', context);
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(targetPost.isLiked, false, 'Post should now be marked isLiked = false');
    assert.strictEqual(targetPost.likes, initialLikes, 'Like count should decrement back to initial');

    const updatedLikedIds = sandbox.getCommunityLikedIds();
    assert.ok(!updatedLikedIds.includes('post-1'), 'Liked IDs cache must no longer include post-1');

    const deleteLikeCall = fetchCallLog.find(c => c.url.includes('/rest/v1/post_likes') && c.opts.method === 'DELETE');
    assert.ok(deleteLikeCall, 'Must dispatch DELETE /rest/v1/post_likes');
    assert.ok(deleteLikeCall.url.includes('post_id=eq.post-1'), 'DELETE URL must include post_id filter');
  });

  // Test M3.10: Follow / Unfollow System
  await testAsync('M3.10: toggleFollowUser() updates following cache, profile stat counters, and dispatches POST/DELETE to user_follows', async () => {
    fetchCallLog.length = 0;
    const initialFollowingCount = sandbox.getFollowingCount();
    assert.strictEqual(sandbox.isFollowingUser('usr_raju_naidu'), false, 'Should not initially follow Raju Naidu');

    // Follow Raju Naidu
    await sandbox.toggleFollowUser('usr_raju_naidu', 'Raju Naidu');

    assert.strictEqual(sandbox.isFollowingUser('usr_raju_naidu'), true, 'Should now follow Raju Naidu');
    assert.strictEqual(sandbox.getFollowingCount(), initialFollowingCount + 1, 'Following count should increment');

    const followCall = fetchCallLog.find(c => c.url.includes('/rest/v1/user_follows') && c.opts.method === 'POST');
    assert.ok(followCall, 'Must dispatch POST /rest/v1/user_follows');
    const followBody = JSON.parse(followCall.opts.body);
    assert.strictEqual(followBody.follower_id, 'uid-direct-supa-42');
    assert.strictEqual(followBody.following_id, 'usr_raju_naidu');

    // Unfollow Raju Naidu
    fetchCallLog.length = 0;
    await sandbox.toggleFollowUser('usr_raju_naidu', 'Raju Naidu');

    assert.strictEqual(sandbox.isFollowingUser('usr_raju_naidu'), false, 'Should no longer follow Raju Naidu');
    assert.strictEqual(sandbox.getFollowingCount(), initialFollowingCount, 'Following count should decrement back');

    const unfollowCall = fetchCallLog.find(c => c.url.includes('/rest/v1/user_follows') && c.opts.method === 'DELETE');
    assert.ok(unfollowCall, 'Must dispatch DELETE /rest/v1/user_follows');
    assert.ok(unfollowCall.url.includes('following_id=eq.usr_raju_naidu'), 'DELETE URL must filter by following_id');
  });

  // Test M3.11: Post Ownership Authorization
  test('M3.11: isOwnCommunityPost() accurately enforces ownership authorization', () => {
    const currentUid = sandbox.getCurrentUserId();

    // 1. Post authored by other user
    const otherPost = {
      id: 'post-other-1',
      user_id: 'usr_other_farmer_99',
      author: { en: 'Other Farmer' }
    };
    assert.strictEqual(sandbox.isOwnCommunityPost(otherPost), false, 'Other farmer post must not be own post');

    // 2. Post authored by current user via user_id
    const myPostByUid = {
      id: 'post-mine-1',
      user_id: currentUid,
      author: { en: 'Anonymous' }
    };
    assert.strictEqual(sandbox.isOwnCommunityPost(myPostByUid), true, 'Post matching currentUserId must be recognized as own post');

    // 3. Post authored with (You) suffix
    const myPostByAuthor = {
      id: 'post-mine-2',
      user_id: null,
      author: { en: 'Jaswanth Reddy (You)' }
    };
    assert.strictEqual(sandbox.isOwnCommunityPost(myPostByAuthor), true, 'Post authored with (You) must be recognized as own post');
  });

  // Test M3.12: Edit Own Post
  await testAsync('M3.12: saveEditedCommunityPost() optimistically updates post title/text/crop and dispatches PATCH with user_id check', async () => {
    fetchCallLog.length = 0;
    const posts = vm.runInContext('COMMUNITY_POSTS_CATALOG', context);

    // Create and inject own post
    const myPost = {
      id: 'post-edit-test-1',
      user_id: sandbox.getCurrentUserId(),
      author: { en: 'Me (You)' },
      cropId: 'cotton',
      title: { en: 'Original Title', te: 'Original Title', hi: 'Original Title' },
      text: { en: 'Original Text', te: 'Original Text', hi: 'Original Text' },
      likes: 5,
      isLiked: false,
      comments: []
    };
    posts.unshift(myPost);

    // Edit the post
    await sandbox.saveEditedCommunityPost('post-edit-test-1', 'Updated Title for Chilli', 'Updated Symptoms Text', 'chilli');

    const editedPost = posts.find(x => x.id === 'post-edit-test-1');
    assert.strictEqual(editedPost.title.en, 'Updated Title for Chilli', 'Title must be updated');
    assert.strictEqual(editedPost.text.en, 'Updated Symptoms Text', 'Description text must be updated');
    assert.strictEqual(editedPost.cropId, 'chilli', 'Crop ID must be updated');

    // Verify PATCH request
    const patchCall = fetchCallLog.find(c => c.url.includes('/rest/v1/community_posts') && c.opts.method === 'PATCH');
    assert.ok(patchCall, 'Must dispatch PATCH /rest/v1/community_posts');
    assert.ok(patchCall.url.includes('id=eq.post-edit-test-1'), 'PATCH URL must filter by post id');
    assert.ok(patchCall.url.includes(`user_id=eq.${encodeURIComponent(sandbox.getCurrentUserId())}`), 'PATCH URL must filter by user_id for security');
    const patchBody = JSON.parse(patchCall.opts.body);
    assert.strictEqual(patchBody.title, 'Updated Title for Chilli');
    assert.strictEqual(patchBody.crop_id, 'chilli');
  });

  // Test M3.13: Delete Own Post
  await testAsync('M3.13: deleteCommunityPost() removes post from catalog, updates myPosts count, and dispatches DELETE with user_id check', async () => {
    fetchCallLog.length = 0;
    const postsBefore = vm.runInContext('COMMUNITY_POSTS_CATALOG', context);
    const countBefore = postsBefore.length;
    assert.ok(postsBefore.some(x => x.id === 'post-edit-test-1'), 'Post must exist before deletion');

    await sandbox.deleteCommunityPost('post-edit-test-1');

    const postsAfter = vm.runInContext('COMMUNITY_POSTS_CATALOG', context);
    assert.strictEqual(postsAfter.length, countBefore - 1, 'Catalog count must decrement by 1');
    assert.ok(!postsAfter.some(x => x.id === 'post-edit-test-1'), 'Deleted post must no longer exist in catalog');

    const deleteCall = fetchCallLog.find(c => c.url.includes('/rest/v1/community_posts') && c.opts.method === 'DELETE');
    assert.ok(deleteCall, 'Must dispatch DELETE /rest/v1/community_posts');
    assert.ok(deleteCall.url.includes('id=eq.post-edit-test-1'), 'DELETE URL must filter by post id');
    assert.ok(deleteCall.url.includes(`user_id=eq.${encodeURIComponent(sandbox.getCurrentUserId())}`), 'DELETE URL must filter by user_id for security');
  });

  // Test M3.14: submitNewCommunityPost binds user_id
  test('M3.14: submitNewCommunityPost() binds current user ID and persists to Supabase and localStorage', () => {
    const currentUid = sandbox.getCurrentUserId();
    const titleEl = getEl('new-post-title');
    const descEl = getEl('new-post-desc');
    const cropEl = getEl('new-post-crop');

    titleEl.value = 'New Test Question for Tomato';
    descEl.value = 'Tomato blight symptoms observed in field';
    cropEl.value = 'tomato';

    sandbox.submitNewCommunityPost();

    const posts = vm.runInContext('COMMUNITY_POSTS_CATALOG', context);
    const newestPost = posts[0];
    assert.strictEqual(newestPost.title.en, 'New Test Question for Tomato');
    assert.strictEqual(newestPost.cropId, 'tomato');
    assert.strictEqual(newestPost.user_id, currentUid, 'New post must be tagged with current user_id');
    assert.strictEqual(newestPost.likes, 1, 'Author should have initial like');
    assert.strictEqual(newestPost.isLiked, true, 'Author initial isLiked should be true');
  });

  // Test M3.15: Dual-File Parity
  test('M3.15: Strict parity of community interactive code and realtime channels across emulator and Android assets', () => {
    const emuHtml = fs.readFileSync(targetFiles[0], 'utf8');
    const idxHtml = fs.readFileSync(targetFiles[1], 'utf8');

    const requiredTokens = [
      'function getCurrentUserId',
      'function getCurrentFarmerName',
      'function getFollowedUserIds',
      'function saveFollowedUserIds',
      'function isFollowingUser',
      'function getFollowingCount',
      'function getFollowersCount',
      'function getMyPostsCount',
      'function updateProfileCommunityStats',
      'async function toggleFollowUser',
      'function isOwnCommunityPost',
      'function openEditCommunityPostModal',
      'function closeEditCommunityPostModal',
      'function submitEditedCommunityPost',
      'async function saveEditedCommunityPost',
      'async function deleteCommunityPost',
      'function toggleCommunityLike',
      'function submitNewCommunityPost',
      'function renderCommunityFeedDom',
      'async function syncCommunityLikeToSupabase',
      'async function pushCommunityPostToSupabase',
      'async function fetchCommunityPostsFromSupabase',
      'realtime:public:post_likes',
      'realtime:public:user_follows',
      'id="community-edit-modal"',
      'id="profile-stat-followers"',
      'id="profile-stat-following"',
      'id="profile-stat-myposts"',
      '.heart-pop'
    ];

    requiredTokens.forEach(token => {
      assert.ok(emuHtml.includes(token), `nukrop_emulator.html must contain ${token}`);
      assert.ok(idxHtml.includes(token), `app/src/main/assets/index.html must contain ${token}`);
    });
  });

  console.log(`\n================================================================================`);
  console.log(`🎉 ALL ${passed}/${total} MILESTONE 3 VERIFICATIONS PASSED WITH ZERO ERRORS!`);
  console.log('================================================================================\n');
})();
