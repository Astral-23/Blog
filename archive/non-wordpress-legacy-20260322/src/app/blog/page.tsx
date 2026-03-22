import { getPostsBySection } from "@/lib/content";
import { getSiteSettings } from "@/lib/site-config";
import { PostCardList } from "@/components/post-card-list";

export default function BlogListPage() {
  const posts = getPostsBySection("blog");
  const settings = getSiteSettings();

  return (
    <section className="page-wrap">
      <h1 className="page-title">blog</h1>
      {settings.blogLead ? <p className="page-lead">{settings.blogLead}</p> : null}
      <PostCardList posts={posts} />
    </section>
  );
}
