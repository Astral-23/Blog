import { getPostsBySection } from "@/lib/content";
import { getSiteSettings } from "@/lib/site-config";
import { PostCardList } from "@/components/post-card-list";

export default function TechListPage() {
  const posts = getPostsBySection("blog-tech");
  const settings = getSiteSettings();

  return (
    <section className="page-wrap">
      <h1 className="page-title">blog-tech</h1>
      {settings.blogTechLead ? <p className="page-lead">{settings.blogTechLead}</p> : null}
      <PostCardList posts={posts} />
    </section>
  );
}
