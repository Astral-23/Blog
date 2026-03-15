import Link from "next/link";
import { getPostsBySection } from "@/lib/content";
import { getSiteSettings } from "@/lib/site-config";

export default function BlogListPage() {
  const posts = getPostsBySection("blog");
  const settings = getSiteSettings();

  return (
    <section className="page-wrap">
      <h1 className="page-title">blog</h1>
      {settings.blogLead ? <p className="page-lead">{settings.blogLead}</p> : null}
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
