class CommunityPost {
  final String id;
  final String authorName;
  final String authorRole;
  final String location;
  final String cropTag;
  final String title;
  final String content;
  final int likesCount;
  final int commentsCount;
  final bool isLiked;
  final bool isFollowed;
  final DateTime createdAt;

  const CommunityPost({
    required this.id,
    required this.authorName,
    this.authorRole = 'Farmer',
    required this.location,
    required this.cropTag,
    required this.title,
    required this.content,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.isLiked = false,
    this.isFollowed = false,
    required this.createdAt,
  });

  CommunityPost copyWith({
    int? likesCount,
    bool? isLiked,
    bool? isFollowed,
  }) {
    return CommunityPost(
      id: id,
      authorName: authorName,
      authorRole: authorRole,
      location: location,
      cropTag: cropTag,
      title: title,
      content: content,
      likesCount: likesCount ?? this.likesCount,
      commentsCount: commentsCount,
      isLiked: isLiked ?? this.isLiked,
      isFollowed: isFollowed ?? this.isFollowed,
      createdAt: createdAt,
    );
  }
}

