import Link from "next/link";
import type { Post } from "@/lib/content";

type PostCardListProps = {
  posts: Post[];
};

export function PostCardList({ posts }: PostCardListProps) {
  return (
    <ul className="post-list">
      {posts.map((post) => (
        <li className="post-card" key={`${post.section}-${post.slug}`}>
          <Link className="post-card-link" href={`/${post.section}/${post.slug}`}>
            <p className="post-date">{new Date(post.publishedAt).toLocaleDateString("ja-JP")}</p>
            <h2>{post.title}</h2>
            {post.excerpt ? <p>{post.excerpt}</p> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
