async function syncCommunityLikeToSupabase(postId, willBeLiked, delta, newLikesCount) {
  if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.url) return;
  const currentUserId = getCurrentUserId();
  const p = COMMUNITY_POSTS_CATALOG.find(x => x.id === postId);

  try {
    let res;
    if (willBeLiked) {
      res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/post_likes`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates'
        },
        body: JSON.stringify({
          post_id: postId,
          user_id: currentUserId,
          created_at: new Date().toISOString()
        })
      });
    } else {
      res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/post_likes?post_id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(currentUserId)}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      });
    }

    if (res && res.status >= 400) {
      throw new Error('HTTP ' + res.status);
    }
  } catch(err) {
    console.warn('Like sync failed, executing rollback:', err && err.message);
    if (p) {
      p.isLiked = !willBeLiked;
      p.likes = Math.max(0, (p.likes || 0) - delta);
      let rollbackLiked = getCommunityLikedIds();
      if (!willBeLiked) {
        if (!rollbackLiked.includes(postId)) rollbackLiked.push(postId);
      } else {
        rollbackLiked = rollbackLiked.filter(id => id !== postId);
      }
      saveCommunityLikedIds(rollbackLiked);
      try {
        localStorage.setItem('nukrop_community_posts', JSON.stringify(COMMUNITY_POSTS_CATALOG));
      } catch(e) {}
      renderCommunityFeedDom();
      if (typeof showLuxuryToast === 'function') {
        showLuxuryToast('Network sync failed. Like state reverted.', 'error');
      }
    }
  }
}

async function deleteCommunityPost(postId) {
  const p = COMMUNITY_POSTS_CATALOG.find(x => x.id === postId);
  if (!p) return;

  if (typeof confirm === 'function' && !confirm(TL('Are you sure you want to delete this post?', 'మీరు ఖచ్చితంగా ఈ పోస్ట్‌ను తొలగించాలనుకుంటున్నారా?', 'क्या आप वाकई यह पोस्ट हटाना चाहते हैं?'))) {
    return;
  }

  const postIndex = COMMUNITY_POSTS_CATALOG.findIndex(x => x.id === postId);
  COMMUNITY_POSTS_CATALOG = COMMUNITY_POSTS_CATALOG.filter(x => x.id !== postId);
  try {
    localStorage.setItem('nukrop_community_posts', JSON.stringify(COMMUNITY_POSTS_CATALOG));
  } catch(e) {}

  renderCommunityFeedDom();
  updateProfileCommunityStats();

  if (typeof showLuxuryToastWithUndo === 'function') {
    showLuxuryToastWithUndo(
      TL('Post deleted from Community Feed', 'కమ్యూనిటీ నుండి పోస్ట్ తొలగించబడింది', 'पोस्ट हटा दी गई'),
      function() {
        COMMUNITY_POSTS_CATALOG.splice(postIndex, 0, p);
        try {
          localStorage.setItem('nukrop_community_posts', JSON.stringify(COMMUNITY_POSTS_CATALOG));
        } catch(e) {}
        renderCommunityFeedDom();
        updateProfileCommunityStats();
        if (typeof showLuxuryToast === 'function') {
          showLuxuryToast(TL('Post restored', 'పోస్ట్ పునరుద్ధరించబడింది', 'पोस्ट पुनर्स्थापित की गई'), 'success');
        }
      },
      'warning',
      6000
    );
  }

  // Cloud DELETE with rollback on failure
  if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) {
    try {
      const currentUserId = getCurrentUserId();
      const targetUserId = p.user_id || currentUserId;
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/community_posts?id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(targetUserId)}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      });
      if (res && res.status >= 400) {
        throw new Error('Cloud delete HTTP ' + res.status);
      }
    } catch(err) {
      console.warn('Post delete cloud sync failure, rolling back:', err && err.message);
      if (!COMMUNITY_POSTS_CATALOG.some(x => x.id === postId)) {
        COMMUNITY_POSTS_CATALOG.splice(postIndex, 0, p);
        try {
          localStorage.setItem('nukrop_community_posts', JSON.stringify(COMMUNITY_POSTS_CATALOG));
        } catch(e) {}
        renderCommunityFeedDom();
        updateProfileCommunityStats();
        if (typeof showLuxuryToast === 'function') {
          showLuxuryToast('Cloud sync failed. Restored post.', 'error');
        }
      }
    }
  }
}

