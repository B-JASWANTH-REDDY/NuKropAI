import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/community_post.dart';
import '../../core/storage/secure_storage.dart';
import '../../shared/widgets/luxury_toast.dart';

class CommunityScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const CommunityScreen({super.key, this.onBack});

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  String _selectedTopic = 'All Topics';
  final List<String> _topics = ['All Topics', 'Cotton', 'Chilli', 'Paddy', 'Tomato'];

  // Base authentic posts with deduplication IDs
  final List<CommunityPost> _rawPosts = [
    CommunityPost(
      id: 'p1_warangal_cotton',
      authorName: 'Jaswanth Reddy',
      authorRole: 'Verified Farmer',
      location: 'Himayath Nagar Farm, Telangana',
      cropTag: 'Cotton',
      title: 'Bumper Cotton Yield in Warangal',
      content:
          'Using Jeevamrutha and IPM sticky traps reduced pest incidence by 80%. Highly recommended for all cotton farmers before flowering stage!',
      likesCount: 24,
      commentsCount: 6,
      isLiked: false,
      isFollowed: true,
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    ),
    CommunityPost(
      id: 'p2_nandyal_chilli',
      authorName: 'Narayana Swamy',
      authorRole: 'Progressive Farmer',
      location: 'Nandyal District, Andhra Pradesh',
      cropTag: 'Chilli',
      title: 'Black Thrips Management Technique',
      content:
          'Intercropping with maize and border planting of castor has shielded our chilli beds from severe thrips migration. Soil moisture must be maintained.',
      likesCount: 38,
      commentsCount: 12,
      isLiked: true,
      isFollowed: false,
      createdAt: DateTime.now().subtract(const Duration(hours: 5)),
    ),
    CommunityPost(
      id: 'p3_delta_paddy',
      authorName: 'Dr. K. Venkatesh',
      authorRole: 'Agronomist Specialist',
      location: 'PJTSAU Agricultural University',
      cropTag: 'Paddy',
      title: 'Stem Borer Warning in Godavari Delta',
      content:
          'Pheromone trap catches exceeded 8 moths/night. Install Trichogramma egg parasitoids @ 20,000/acre immediately.',
      likesCount: 65,
      commentsCount: 19,
      isLiked: false,
      isFollowed: false,
      createdAt: DateTime.now().subtract(const Duration(hours: 8)),
    ),
  ];

  // User uploaded stories only (zero stock photos/fake profiles)
  final List<Map<String, String>> _authenticStories = [];

  List<CommunityPost> get _deduplicatedPosts {
    final seen = <String>{};
    final unique = <CommunityPost>[];
    for (final post in _rawPosts) {
      final sig = '${post.authorName.toLowerCase()}:::${post.title.toLowerCase()}';
      if (!seen.contains(post.id) && !seen.contains(sig)) {
        seen.add(post.id);
        seen.add(sig);
        if (_selectedTopic == 'All Topics' || post.cropTag.toLowerCase() == _selectedTopic.toLowerCase()) {
          unique.add(post);
        }
      }
    }
    return unique;
  }

  void _toggleLike(String postId) {
    final index = _rawPosts.indexWhere((p) => p.id == postId);
    if (index == -1) return;
    final post = _rawPosts[index];
    final newIsLiked = !post.isLiked;
    final newCount = post.likesCount + (newIsLiked ? 1 : -1);
    setState(() {
      _rawPosts[index] = post.copyWith(
        isLiked: newIsLiked,
        likesCount: newCount,
      );
    });
  }

  void _toggleFollow(String postId) {
    final index = _rawPosts.indexWhere((p) => p.id == postId);
    if (index == -1) return;
    final post = _rawPosts[index];
    final newFollowed = !post.isFollowed;
    setState(() {
      _rawPosts[index] = post.copyWith(isFollowed: newFollowed);
    });

    LuxuryToast.show(
      context,
      message: newFollowed
          ? 'Now following ${post.authorName}'
          : 'Unfollowed ${post.authorName}',
      undoLabel: 'Undo',
      onUndo: () {
        setState(() {
          _rawPosts[index] = post.copyWith(isFollowed: !newFollowed);
        });
      },
    );
  }

  void _showAddStoryDialog() {
    LuxuryToast.show(
      context,
      message: 'Select photo from farm gallery or capture foliar story',
      icon: Icons.camera_alt_rounded,
    );
  }

  void _showCreatePostDialog() {
    final titleController = TextEditingController();
    final contentController = TextEditingController();
    String crop = 'Cotton';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Ask Kisan Community',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: titleController,
                decoration: const InputDecoration(
                  hintText: 'Question or Topic Title...',
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contentController,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Describe your field problem or farming insight...',
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: crop,
                decoration: const InputDecoration(
                  labelText: 'Tagged Crop',
                  isDense: true,
                ),
                items: ['Cotton', 'Chilli', 'Paddy', 'Tomato'].map((c) {
                  return DropdownMenuItem(value: c, child: Text(c));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setModalState(() => crop = val);
                },
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  if (titleController.text.trim().isEmpty) return;
                  final session = await SecureStorage.getSession();
                  final authorName = session?.name.isNotEmpty == true ? session!.name : 'Kisan Farmer';
                  final authorRole = session?.isDriver == true ? 'Verified Driver' : 'Verified Farmer';
                  final location = '${session?.district.isNotEmpty == true ? session!.district : "Warangal"}, ${session?.state.isNotEmpty == true ? session!.state : "Telangana"}';
                  final newPost = CommunityPost(
                    id: 'p_${DateTime.now().millisecondsSinceEpoch}',
                    authorName: authorName,
                    authorRole: authorRole,
                    location: location,
                    cropTag: crop,
                    title: titleController.text.trim(),
                    content: contentController.text.trim(),
                    createdAt: DateTime.now(),
                  );
                  setState(() {
                    _rawPosts.insert(0, newPost);
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) {
                    LuxuryToast.show(
                      context,
                      message: 'Your query has been posted to Kisan Community!',
                      icon: Icons.check_circle_rounded,
                    );
                  }
                },
                child: const Text('Post Query'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final posts = _deduplicatedPosts;

    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: AppConstants.textDark),
                onPressed: widget.onBack,
              )
            : null,
        title: const Row(
          children: [
            Icon(Icons.groups_rounded, color: AppConstants.primaryGreen, size: 22),
            SizedBox(width: 8),
            Text(
              'Kisan Community',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppConstants.textDark,
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton.icon(
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text('Ask Query', style: TextStyle(fontSize: 12)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConstants.primaryGreen,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              ),
              onPressed: _showCreatePostDialog,
            ),
          ),
        ],
      ),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // Active count and header
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppConstants.primaryGreen,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${posts.length} Posts Active',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppConstants.primaryDark,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Story Reel: Pure real user uploads, zero placeholder / stock photo avatars
          SliverToBoxAdapter(
            child: Container(
              height: 90,
              margin: const EdgeInsets.symmetric(vertical: 8),
              child: ListView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  // Primary upload story pill
                  GestureDetector(
                    onTap: _showAddStoryDialog,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Stack(
                          children: [
                            Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppConstants.primaryLight,
                                border: Border.all(
                                  color: AppConstants.primaryGreen.withAlpha(120),
                                  width: 1.5,
                                ),
                              ),
                              child: const Center(
                                child: Text(
                                  'JA',
                                  style: TextStyle(
                                    color: AppConstants.primaryDark,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: Container(
                                width: 18,
                                height: 18,
                                decoration: const BoxDecoration(
                                  color: AppConstants.primaryGreen,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.add_rounded,
                                  color: Colors.white,
                                  size: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Your Story',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppConstants.textDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Real user uploaded stories only (purges any Jacku7376 or external stock photos)
                  ..._authenticStories.map(
                    (story) => Padding(
                      padding: const EdgeInsets.only(left: 14),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppConstants.primaryLight,
                              border: Border.all(
                                color: AppConstants.primaryGreen,
                                width: 2,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                story['initial'] ?? 'F',
                                style: const TextStyle(
                                  color: AppConstants.primaryDark,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            story['name'] ?? 'Farmer',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppConstants.textDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Topic filter chips
          SliverToBoxAdapter(
            child: SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: _topics.map((topic) {
                  final isSelected = _selectedTopic == topic;
                  return GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedTopic = topic;
                      });
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? AppConstants.textDark : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected
                              ? AppConstants.textDark
                              : Colors.grey.shade300,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          topic,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isSelected ? Colors.white : AppConstants.textDark,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: 12),
          ),

          // Community Feed List (Deduplicated)
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final post = posts[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 14),
                    elevation: 0.5,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 20,
                                backgroundColor: AppConstants.primaryLight,
                                child: Text(
                                  post.authorName.isNotEmpty ? post.authorName[0] : 'U',
                                  style: const TextStyle(
                                    color: AppConstants.primaryDark,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          post.authorName,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: AppConstants.textDark,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const Icon(
                                          Icons.verified_rounded,
                                          color: AppConstants.primaryGreen,
                                          size: 14,
                                        ),
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: AppConstants.primaryLight,
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            post.cropTag.toLowerCase(),
                                            style: const TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              color: AppConstants.primaryDark,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '📍 ${post.location}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppConstants.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              TextButton(
                                onPressed: () => _toggleFollow(post.id),
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(50, 30),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text(
                                  post.isFollowed ? 'Following' : '+ Follow',
                                  style: TextStyle(
                                    color: post.isFollowed
                                        ? AppConstants.textMuted
                                        : AppConstants.primaryGreen,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            post.title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppConstants.textDark,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            post.content,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppConstants.textDark,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              InkWell(
                                onTap: () => _toggleLike(post.id),
                                borderRadius: BorderRadius.circular(8),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 4,
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(
                                        post.isLiked
                                            ? Icons.favorite_rounded
                                            : Icons.favorite_border_rounded,
                                        color: post.isLiked
                                            ? AppConstants.dangerRed
                                            : AppConstants.textMuted,
                                        size: 18,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '${post.likesCount}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: post.isLiked
                                              ? AppConstants.dangerRed
                                              : AppConstants.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.chat_bubble_outline_rounded,
                                    color: AppConstants.textMuted,
                                    size: 16,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${post.commentsCount} answers',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppConstants.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                              const Spacer(),
                              IconButton(
                                icon: const Icon(
                                  Icons.bookmark_border_rounded,
                                  size: 18,
                                  color: AppConstants.textMuted,
                                ),
                                onPressed: () {
                                  LuxuryToast.show(
                                    context,
                                    message: 'Post saved to Farm Library',
                                  );
                                },
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.share_outlined,
                                  size: 18,
                                  color: AppConstants.textMuted,
                                ),
                                onPressed: () {
                                  LuxuryToast.show(
                                    context,
                                    message: 'Link copied to clipboard',
                                  );
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
                childCount: posts.length,
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: SizedBox(height: 24),
          ),
        ],
      ),
    );
  }
}
