import Link from "next/link";
import { getPostsBySection } from "@/lib/content";

export default function BlogListPage() {
  const posts = getPostsBySection("blog");

  return (
    <section className="page-wrap">
      <h1 className="page-title">blog</h1>
      <ul className="post-list">
        {posts.map((post) => (
          <li className="post-card" key={post.slug}>
            <p className="post-date">{new Date(post.publishedAt).toLocaleDateString("ja-JP")}</p>
            <h2>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            {post.excerpt ? <p>{post.excerpt}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
