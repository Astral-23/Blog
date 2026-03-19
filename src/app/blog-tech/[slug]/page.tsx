import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { getPostBySlug, getPostsBySection } from "@/lib/content";
import { formatDisplayDate } from "@/lib/date";
import { resolveCardImage, toAbsoluteUrl } from "@/lib/metadata";
import { getSiteSettings } from "@/lib/site-config";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getPostsBySection("blog-tech").map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug("blog-tech", slug);
  const site = getSiteSettings();
  const pageUrl = toAbsoluteUrl(`/blog-tech/${slug}`);
  const defaultImage = resolveCardImage(null);

  if (!post) {
    return {
      title: site.title,
      description: site.description,
      openGraph: {
        title: site.title,
        description: site.description,
        url: pageUrl,
        siteName: site.title,
        locale: "ja_JP",
        type: "article",
        images: [{ url: defaultImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: site.title,
        description: site.description,
        images: [defaultImage],
      },
    };
  }

  const title = `${post.title} | ${site.title}`;
  const description = post.excerpt || site.description;
  const image = resolveCardImage(post.cardImage);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: site.title,
      locale: "ja_JP",
      type: "article",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function TechPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug("blog-tech", slug);

  if (!post) {
    notFound();
  }

  return (
    <section className="page-wrap">
      <h1 className="page-title">{post.title}</h1>
      <div className="post-meta">
        <p>Published: {formatDisplayDate(post.publishedAt)}</p>
        <p>Updated: {formatDisplayDate(post.updatedAt)}</p>
      </div>
      <MarkdownContent source={post.content} demoteH1 />
    </section>
  );
}
