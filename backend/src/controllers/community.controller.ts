import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import { pool } from '../config/db';

export const getCommunityPosts = async (request: FastifyRequest, reply: FastifyReply) => {
  const { topic, cursor, limit = 20 } = request.query as any;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

  try {
    let queryText = 'SELECT * FROM public.community_posts';
    const params: any[] = [];
    const conditions: string[] = [];

    if (topic && topic !== 'All Topics' && topic.trim().length > 0) {
      params.push(topic.trim().toLowerCase());
      conditions.push(`LOWER(COALESCE(crop_id, '')) = $${params.length}`);
    }

    if (cursor) {
      params.push(new Date(cursor));
      conditions.push(`created_at < $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    params.push(parsedLimit + 1);
    queryText += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(queryText, params);
    const hasMore = result.rows.length > parsedLimit;
    const posts = hasMore ? result.rows.slice(0, parsedLimit) : result.rows;
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].created_at : null;

    return reply.status(200).send({
      posts: posts.map(p => ({
        id: p.id,
        authorName: p.author_name,
        authorRole: p.author_role || 'Farmer',
        location: p.author_village || p.location || 'Warangal, Telangana',
        cropTag: p.crop_id || p.crop_tag || 'Cotton',
        title: p.title,
        content: p.content || p.body || '',
        likesCount: parseInt(p.likes_count, 10) || 0,
        commentsCount: parseInt(p.comments_count, 10) || 0,
        mediaUrl: p.media_url,
        mediaType: p.media_type || 'NONE',
        isLiked: false,
        isFollowed: false,
        createdAt: p.created_at
      })),
      nextCursor,
      hasMore
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to retrieve community posts' });
  }
};

export const createCommunityPost = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.user;
  if (!user || !user.id) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required to create community posts' });
  }

  const { title, content, cropTag, location, mediaUrl, mediaType } = request.body as any;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return reply.status(400).send({ error: 'Post title is required' });
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return reply.status(400).send({ error: 'Post content is required' });
  }

  const crop = (cropTag || 'General').trim();
  const authorLocation = (location || 'Telangana, India').trim();
  const authorName = user.email ? user.email.split('@')[0] : 'Farmer';
  const roleName = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Farmer';

  try {
    const result = await pool.query(
      `INSERT INTO public.community_posts (
        id, user_id, author_name, author_village, crop_id, title, content, body, 
        media_url, media_type, likes_count, comments_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, NOW(), NOW())
      RETURNING *`,
      [
        crypto.randomUUID(),
        user.id,
        authorName,
        authorLocation,
        crop,
        title.trim(),
        content.trim(),
        content.trim(),
        mediaUrl || null,
        mediaType || 'NONE'
      ]
    );

    const post = result.rows[0];
    return reply.status(201).send({
      post: {
        id: post.id,
        authorName: post.author_name,
        authorRole: roleName,
        location: post.author_village,
        cropTag: post.crop_id,
        title: post.title,
        content: post.content,
        likesCount: 0,
        commentsCount: 0,
        mediaUrl: post.media_url,
        mediaType: post.media_type,
        isLiked: false,
        isFollowed: false,
        createdAt: post.created_at
      }
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to publish community post' });
  }
};

export const togglePostLike = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.user;
  if (!user || !user.id) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required to like posts' });
  }

  const { id: postId } = request.params as any;
  if (!postId) {
    return reply.status(400).send({ error: 'Post ID is required' });
  }

  try {
    // Check if like exists
    const existing = await pool.query(
      'SELECT id FROM public.post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, user.id]
    );

    let isLiked = false;
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM public.post_likes WHERE post_id = $1 AND user_id = $2', [postId, user.id]);
      await pool.query('UPDATE public.community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [postId]);
      isLiked = false;
    } else {
      await pool.query(
        'INSERT INTO public.post_likes (id, post_id, user_id, created_at) VALUES ($1, $2, $3, NOW())',
        [crypto.randomUUID(), postId, user.id]
      );
      await pool.query('UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);
      isLiked = true;
    }

    const updated = await pool.query('SELECT likes_count FROM public.community_posts WHERE id = $1', [postId]);
    const count = updated.rows.length > 0 ? (updated.rows[0].likes_count || 0) : 0;

    return reply.status(200).send({
      postId,
      isLiked,
      likesCount: count
    });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Failed to toggle post like' });
  }
};
