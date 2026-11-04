async function toggleFollowUser(authorId, authorName) {
  if (!authorId) return;
  const currentUserId = getCurrentUserId();
  let followedIds = getFollowedUserIds();
  const targetIdStr = String(authorId);
  const isCurrentlyFollowing = followedIds.includes(targetIdStr);
  const willFollow = !isCurrentlyFollowing;

  if (willFollow) {
    if (!followedIds.includes(targetIdStr)) followedIds.push(targetIdStr);
  } else {
    followedIds = followedIds.filter(id => id !== targetIdStr);
  }
  saveFollowedUserIds(followedIds);

  renderCommunityFeedDom();
  updateProfileCommunityStats();

  const nameStr = authorName || TL('Farmer', 'రైతు', 'किसान');
  if (willFollow) {
    if (typeof showLuxuryToast === 'function') {
      showLuxuryToast(TL(`Now following ${nameStr}`, `ఇప్పుడు ${nameStr}ని అనుసరిస్తున్నారు`, `अब ${nameStr} को फ़ॉलो कर रहे हैं`), 'success');
    }
  } else {
    if (typeof showLuxuryToastWithUndo === 'function') {
      showLuxuryToastWithUndo(
        TL(`Unfollowed ${nameStr}`, `${nameStr} అనుసరణ నిలిపివేయబడింది`, `${nameStr} को अनफ़ॉलो किया`),
        function() {
          let reFollow = getFollowedUserIds();
          if (!reFollow.includes(targetIdStr)) reFollow.push(targetIdStr);
          saveFollowedUserIds(reFollow);
          renderCommunityFeedDom();
          updateProfileCommunityStats();
          if (typeof showLuxuryToast === 'function') {
            showLuxuryToast(TL(`Re-followed ${nameStr}`, `మళ్లీ ${nameStr}ని అనుసరిస్తున్నారు`, `पुनः फ़ॉलो किया`), 'success');
          }
        },
        'info',
        5000
      );
    } else if (typeof showLuxuryToast === 'function') {
      showLuxuryToast(TL(`Unfollowed ${nameStr}`, `${nameStr} అనుసరణ నిలిపివేయబడింది`, `${nameStr} को अनफ़ॉलो किया`), 'info');
    }
  }

  // Cloud Sync to Supabase user_follows
  if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) {
    try {
      let res;
      if (willFollow) {
        res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/user_follows`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates'
          },
          body: JSON.stringify({
            follower_id: currentUserId,
            following_id: targetIdStr,
            created_at: new Date().toISOString()
          })
        });
      } else {
        res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/user_follows?follower_id=eq.${encodeURIComponent(currentUserId)}&following_id=eq.${encodeURIComponent(targetIdStr)}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          }
        });
      }
      if (res && res.status >= 400) throw new Error('HTTP ' + res.status);
    } catch(err) {
      console.warn('Follow sync error, rolling back:', err && err.message);
      let rollbackIds = getFollowedUserIds();
      if (willFollow) {
        rollbackIds = rollbackIds.filter(id => id !== targetIdStr);
      } else {
        if (!rollbackIds.includes(targetIdStr)) rollbackIds.push(targetIdStr);
      }
      saveFollowedUserIds(rollbackIds);
      renderCommunityFeedDom();
      updateProfileCommunityStats();
      if (typeof showLuxuryToast === 'function') {
        showLuxuryToast('Follow update failed to sync with cloud.', 'error');
      }
    }
  }
}

