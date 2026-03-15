import Link from "next/link";
import { getPostsBySection } from "@/lib/content";
import { getSiteSettings } from "@/lib/site-config";

export default function TechListPage() {
  const posts = getPostsBySection("blog-tech");
  const settings = getSiteSettings();

  return (
    <section className="page-wrap">
      <h1 className="page-title">blog-tech</h1>
      {settings.blogTechLead ? <p className="page-lead">{settings.blogTechLead}</p> : null}
      <ul className="post-list">
        {posts.map((post) => (
          <li className="post-card" key={post.slug}>
            <p className="post-date">{new Date(post.publishedAt).toLocaleDateString("ja-JP")}</p>
            <h2>
              <Link href={`/blog-tech/${post.slug}`}>{post.title}</Link>
            </h2>
            {post.excerpt ? <p>{post.excerpt}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
