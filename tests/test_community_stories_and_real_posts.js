/**
 * NuKropAI Agrarian OS - Community Stories, Real Post Creation & User Identity Test Suite
 * 
 * Verifies:
 * 1. Community Stories Catalog & Rehydration from localStorage (nukrop_community_stories)
 * 2. Real Story Upload Flow (publishUserStory, validation, real user binding)
 * 3. Instagram Story Fullscreen Viewer Stability (openInstagramStoryModal, bounds check, zero crash)
 * 4. Real User Details in Post Modal (openAskQuestionModal, getCurrentFarmerName, getCurrentFarmerVillage)
 * 5. Real Post Submission & Persistence (submitNewCommunityPost, localStorage nukrop_community_posts)
 * 6. Real Comments & Real Farmer Attribution (submitCommunityComment)
 * 7. 100% Dual-File Parity between app/src/main/assets/index.html and nukrop_emulator.html
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function createMockStorage(initial = {}) {
  let store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
}

function buildTestContext(initialStorage = {}) {
  const mockStorage = createMockStorage(initialStorage);
  const domElements = {};

  const ctx = {
    window: {},
    document: {
      getElementById: (id) => {
        if (!domElements[id]) {
          domElements[id] = {
            id,
            value: '',
            innerHTML: '',
            textContent: '',
            style: {},
            classList: {
              classes: new Set(),
              add: function(c) { this.classes.add(c); },
              remove: function(c) { this.classes.delete(c); },
              contains: function(c) { return this.classes.has(c); }
            },
            setAttribute: () => {},
            appendChild: () => {},
            click: () => {},
            remove: () => {}
          };
        }
        return domElements[id];
      },
      querySelectorAll: (sel) => [],
      querySelector: (sel) => null,
      createElement: (tag) => ({
        tag,
        style: {},
        appendChild: () => {},
        setAttribute: () => {},
        remove: () => {}
      })
    },
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    navigator: { userAgent: 'NodeTest', geolocation: null },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn, ms) => {
      if ((ms || 0) <= 200) fn();
      return 1;
    },
    clearTimeout: () => {},
    alert: () => {},
    TL: (en, te, hi) => en,
    currentLang: 'en',
    getCropIconImg: () => '<img>',
    fetchMandiRatesFromSupabase: async () => [],
    fetchGramhaulTrucks: async () => []
  };

  ctx.window = ctx;

  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html'), 'utf8');
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const scripts = [];
  while ((match = re.exec(indexHtml)) !== null) {
    scripts.push(match[1]);
  }

  const scriptCode = scripts.join('\n;\n');
  vm.createContext(ctx);
  vm.runInContext(scriptCode, ctx);

  return ctx;
}

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passed++;
  } catch(e) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     ${e.message}`);
    throw e;
  }
}

async function itAsync(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passed++;
  } catch(e) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     ${e.message}`);
    throw e;
  }
}

console.log('================================================================================');
console.log('🌾 NUKROPAI COMMUNITY STORIES, REAL POSTS & USER DETAILS AUDIT');
console.log('================================================================================\n');

// 1. Stories Catalog
it('CS.1: COMMUNITY_STORIES_CATALOG initializes cleanly as array and rehydrates authentic stories', () => {
  const emptyCtx = buildTestContext();
  assert.ok(Array.isArray(emptyCtx.COMMUNITY_STORIES_CATALOG), 'Must be an array');

  const curatedStories = [
    {
      id: 'story-kvk-1',
      author: { en: 'Dr. Srinivas Rao (KVK)' },
      role: 'Verified ICAR Agronomist',
      mediaUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800'
    }
  ];
  const populatedCtx = buildTestContext({
    'nukrop_community_stories': JSON.stringify(curatedStories)
  });
  assert.ok(Array.isArray(populatedCtx.COMMUNITY_STORIES_CATALOG), 'Must be an array');
  const kvkStory = populatedCtx.COMMUNITY_STORIES_CATALOG.find(s => s.id === 'story-kvk-1');
  assert.ok(kvkStory, 'Must contain KVK Warangal Advisory story');
  assert.strictEqual(kvkStory.role, 'Verified ICAR Agronomist');
  assert.ok(kvkStory.mediaUrl && kvkStory.mediaUrl.startsWith('http'), 'Story must have genuine media URL');
});

// 2. Real User Details
it('CS.2: getCurrentFarmerName and getCurrentFarmerVillage reflect real logged-in farmer details', () => {
  const ctx = buildTestContext({
    'nukrop_farmer_name': 'B. Jaswanth Reddy',
    'nukrop_farmer_village': 'Warangal Rural, Telangana'
  });

  assert.strictEqual(ctx.getCurrentFarmerName(), 'B. Jaswanth Reddy');
  assert.strictEqual(ctx.getCurrentFarmerVillage(), 'Warangal Rural, Telangana');
});

// 3. Post Modal Dynamic User Binding
it('CS.3: openAskQuestionModal dynamically renders real farmer name and village without crashing', () => {
  const ctx = buildTestContext({
    'nukrop_farmer_name': 'Ramesh Kumar Patel',
    'nukrop_farmer_village': 'Khammam Farm, Telangana'
  });

  ctx.openAskQuestionModal();

  const authorNameEl = ctx.document.getElementById('comm-new-post-author-name');
  const authorLocEl = ctx.document.getElementById('comm-new-post-author-loc');

  assert.strictEqual(authorNameEl.textContent, 'Ramesh Kumar Patel');
  assert.ok(authorLocEl.innerHTML.includes('Khammam Farm, Telangana'));
});

// 4. Real Story Upload Flow
it('CS.4: publishUserStory blocks upload when no media is chosen and succeeds with valid photo', () => {
  const ctx = buildTestContext({
    'nukrop_farmer_name': 'Suresh Reddy',
    'nukrop_farmer_village': 'Narsampet, Telangana'
  });

  // Attempt without media
  const prevCount = ctx.COMMUNITY_STORIES_CATALOG.length;
  ctx.currentStorySelectedMediaUrl = null;
  ctx.publishUserStory();
  assert.strictEqual(ctx.COMMUNITY_STORIES_CATALOG.length, prevCount, 'Must block without photo');

  // Provide photo and caption
  ctx.currentStorySelectedMediaUrl = 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae';
  const captionEl = ctx.document.getElementById('story-caption-inp');
  captionEl.value = 'Excellent first picking yield in cotton crop! 🌸';
  
  ctx.publishUserStory();

  assert.strictEqual(ctx.COMMUNITY_STORIES_CATALOG.length, prevCount + 1, 'Story must be prepended');
  const newestStory = ctx.COMMUNITY_STORIES_CATALOG[0];
  assert.strictEqual(newestStory.isUserStory, true);
  assert.strictEqual(newestStory.author.en, 'Suresh Reddy (You)');
  assert.strictEqual(newestStory.title.en, 'Excellent first picking yield in cotton crop! 🌸');

  // Verify localStorage persistence
  const savedStories = JSON.parse(ctx.localStorage.getItem('nukrop_community_stories') || '[]');
  assert.ok(savedStories.some(s => s.id === newestStory.id), 'Must persist to localStorage');
});

// 5. Story Rehydration
it('CS.5: rehydrateCommunityStories loads previously published stories from localStorage', () => {
  const customUserStory = {
    id: 'story-persisted-123',
    user_id: 'usr_custom_1',
    author: { en: 'Venkat Rao (You)' },
    role: 'You • Progressive Farmer',
    mediaUrl: 'https://images.unsplash.com/sample.jpg',
    tag: '🌱 Crop Progress',
    title: { en: 'Organic trial update' },
    isUserStory: true
  };

  const ctx = buildTestContext({
    'nukrop_community_stories': JSON.stringify([customUserStory])
  });

  const found = ctx.COMMUNITY_STORIES_CATALOG.find(s => s.id === 'story-persisted-123');
  assert.ok(found, 'Must rehydrate user story into active catalog');
  assert.strictEqual(found.author.en, 'Venkat Rao (You)');
});

// 6. Story Viewer Stability
it('CS.6: openInstagramStoryModal runs without crashing on invalid index or empty catalog', () => {
  const story = {
    id: 'story-test-1',
    author: { en: 'Srinivas Rao' },
    role: 'Progressive Farmer',
    mediaUrl: 'https://images.unsplash.com/sample.jpg',
    title: { en: 'Organic cotton update' }
  };
  const ctx = buildTestContext({
    'nukrop_community_stories': JSON.stringify([story])
  });
  
  // Normal open
  ctx.openInstagramStoryModal(0);
  const nameEl = ctx.document.getElementById('isv-author-name');
  assert.ok(nameEl.textContent.length > 0, 'Author name must be rendered');

  // Out-of-bounds open
  ctx.openInstagramStoryModal(999);
  assert.strictEqual(ctx.activeInstagramStoryIdx, 0, 'Must safely default to 0 on out-of-bounds index');

  // Empty catalog open gracefully opens upload modal
  ctx.localStorage.removeItem('nukrop_community_stories');
  ctx.COMMUNITY_STORIES_CATALOG.length = 0;
  ctx.openInstagramStoryModal(0);
  const uploadModal = ctx.document.getElementById('story-upload-modal');
  assert.strictEqual(uploadModal.style.display, 'flex', 'Must open story upload modal when catalog is empty');
});

// 7. Real Post Creation
it('CS.7: submitNewCommunityPost creates post with real author details and persists', () => {
  const ctx = buildTestContext({
    'nukrop_farmer_name': 'Jaswanth Reddy',
    'nukrop_farmer_village': 'Warangal Rural, Telangana'
  });

  const textEl = ctx.document.getElementById('new-post-desc');
  const cropEl = ctx.document.getElementById('new-post-crop');
  textEl.value = 'Whitefly observed on underside of leaves in 35-day Cotton crop. Recommendation needed.';
  cropEl.value = 'cotton';

  ctx.submitNewCommunityPost();

  const newestPost = ctx.COMMUNITY_POSTS_CATALOG[0];
  assert.ok(newestPost, 'New post must exist at index 0');
  assert.strictEqual(newestPost.author.en, 'Jaswanth Reddy (You)');
  assert.strictEqual(newestPost.cropId, 'cotton');
  assert.strictEqual(newestPost.isLiked, true, 'Author automatically likes their own new post');

  // Verify persistence
  const savedPosts = JSON.parse(ctx.localStorage.getItem('nukrop_community_posts') || '[]');
  assert.ok(savedPosts.some(p => p.id === newestPost.id), 'Must persist to localStorage');
});

// 8. Real Comments
it('CS.8: submitCommunityComment adds comment attributed to current farmer', () => {
  const testPost = {
    id: 'post-test-1',
    title: { en: 'Pest attack on chilli' },
    comments: [],
    author: { en: 'Farmer Ramesh' }
  };
  const ctx = buildTestContext({
    'nukrop_farmer_name': 'Jaswanth Reddy',
    'nukrop_community_posts': JSON.stringify([testPost])
  });

  const post = ctx.COMMUNITY_POSTS_CATALOG[0];
  assert.ok(post, 'Must have active post');
  const inp = ctx.document.getElementById('comm-reply-inp-' + post.id);
  inp.value = 'Install yellow sticky traps immediately and spray 5ml/L Neem oil.';

  ctx.submitCommunityComment(post.id);

  assert.ok(post.comments.length > 0, 'Comment must be added to post');
  const newestComment = post.comments[post.comments.length - 1];
  assert.strictEqual(newestComment.author.en, 'Jaswanth Reddy (You)');
  assert.ok(newestComment.text.en.includes('Neem oil'));
});

// 9. Stories Bar Inner HTML
it('CS.9: renderCommunityStoriesBarInnerHtml renders stories bar with zero errors', () => {
  const customStory = {
    id: 'story-kvk-1',
    author: { en: 'Dr. Srinivas Rao' },
    role: 'Verified ICAR Agronomist'
  };
  const ctx = buildTestContext({
    'nukrop_community_stories': JSON.stringify([customStory])
  });
  const html = ctx.renderCommunityStoriesBarInnerHtml();
  assert.ok(html.includes('Your Story'), 'Must contain Your Story circle');
  assert.ok(html.includes('Dr. Srinivas Rao'), 'Must contain KVK story avatar');
});

// 10. 100% Dual-File Parity
it('CS.10: 100% Byte-for-byte identical parity between index.html and nukrop_emulator.html', () => {
  const idx = fs.readFileSync(path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html'));
  const emu = fs.readFileSync(path.join(__dirname, '..', 'nukrop_emulator.html'));
  assert.strictEqual(idx.equals(emu), true, 'Files must be 100% byte-for-byte identical');
});

console.log(`\n================================================================================`);
console.log(`🎉 ALL ${passed}/${total} COMMUNITY TESTS PASSED WITH ZERO ERRORS!`);
console.log('================================================================================\n');
