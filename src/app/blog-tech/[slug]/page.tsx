import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { getPostBySlug, getPostsBySection } from "@/lib/content";
import { formatDisplayDate } from "@/lib/date";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getPostsBySection("blog-tech").map((post) => ({ slug: post.slug }));
}

export default async function TechPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug("blog-tech", slug);

  if (!post) {
    notFound();
  }

  return (
    <section className="page-wrap">
      <div className="post-meta">
        <p>Published: {formatDisplayDate(post.publishedAt)}</p>
        <p>Updated: {formatDisplayDate(post.updatedAt)}</p>
      </div>
      <MarkdownContent source={post.content} />
    </section>
  );
}
