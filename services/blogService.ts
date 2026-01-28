import { db } from '@/firebase';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
} from 'firebase/firestore';
import { BlogPost } from '@/types';

const postsCol = collection(db, 'posts');

export const getAllBlogPosts = async (publishedOnly = true): Promise<BlogPost[]> => {
    let q = query(postsCol, orderBy('published_at', 'desc'));

    if (publishedOnly) {
        q = query(postsCol, where('is_published', '==', true), orderBy('published_at', 'desc'));
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BlogPost);
};

export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | undefined> => {
    const q = query(postsCol, where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    return snap.docs[0].data() as BlogPost;
};

export const createBlogPost = async (post: Omit<BlogPost, 'id' | 'published_at'>): Promise<BlogPost> => {
    const postId = `post-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const newPost: BlogPost = {
        ...post,
        id: postId,
        published_at: serverTimestamp() as any,
    };
    const ref = doc(postsCol, postId);
    await setDoc(ref, newPost);
    return newPost;
};
