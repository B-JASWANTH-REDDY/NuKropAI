import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/community_post.dart';
import '../../shared/widgets/luxury_toast.dart';

class CommunityScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const CommunityScreen({super.key, this.onBack});

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  final List<CommunityPost> _posts = [
    CommunityPost(
      id: 'p1',
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
      id: 'p2',
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
      id: 'p3',
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

  void _toggleLike(int index) {
    final post = _posts[index];
    final newIsLiked = !post.isLiked;
    final newCount = post.likesCount + (newIsLiked ? 1 : -1);
    setState(() {
      _posts[index] = post.copyWith(
        isLiked: newIsLiked,
        likesCount: newCount,
      );
    });
  }

  void _toggleFollow(int index) {
    final post = _posts[index];
    final newFollowed = !post.isFollowed;
    setState(() {
      _posts[index] = post.copyWith(isFollowed: newFollowed);
    });

    LuxuryToast.show(
      context,
      message: newFollowed
          ? 'Now following ${post.authorName}'
          : 'Unfollowed ${post.authorName}',
      undoLabel: 'Undo',
      onUndo: () {
        setState(() {
          _posts[index] = post.copyWith(isFollowed: !newFollowed);
        });
      },
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
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  if (titleController.text.trim().isEmpty) return;
                  final newPost = CommunityPost(
                    id: 'p_${DateTime.now().millisecondsSinceEpoch}',
                    authorName: 'Jaswanth Reddy',
                    authorRole: 'Verified Farmer',
                    location: 'Warangal Rural, Telangana',
                    cropTag: crop,
                    title: titleController.text.trim(),
                    content: contentController.text.trim(),
                    createdAt: DateTime.now(),
                  );
                  setState(() {
                    _posts.insert(0, newPost);
                  });
                  Navigator.pop(ctx);
                  LuxuryToast.show(
                    context,
                    message: 'Your query has been posted to Kisan Community!',
                    icon: Icons.check_circle_rounded,
                  );
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
    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      appBar: AppBar(
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: widget.onBack,
              )
            : null,
        title: const Text('Kisan Community'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton.icon(
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text('Ask Query', style: TextStyle(fontSize: 12)),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              onPressed: _showCreatePostDialog,
            ),
          ),
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _posts.length,
        itemBuilder: (context, index) {
          final post = _posts[index];
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: AppConstants.primaryLight,
                        child: Text(
                          post.authorName[0],
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
                              ],
                            ),
                            Text(
                              post.location,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppConstants.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () => _toggleFollow(index),
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
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppConstants.primaryLight,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '🌾 ${post.cropTag}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppConstants.primaryDark,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
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
                        onTap: () => _toggleLike(index),
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
                          Icons.share_outlined,
                          size: 16,
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
      ),
    );
  }
}
