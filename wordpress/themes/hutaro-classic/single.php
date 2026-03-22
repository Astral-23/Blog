<?php
if (!defined('ABSPATH')) { exit; }
get_header();
?>
<section class="page-wrap">
  <?php while (have_posts()): the_post(); ?>
    <h1 class="page-title"><?php the_title(); ?></h1>
    <div class="post-meta">
      <p>Published: <?php echo esc_html(get_the_date('Y-m-d')); ?></p>
      <p>Updated: <?php echo esc_html(get_the_modified_date('Y-m-d')); ?></p>
    </div>
    <article class="entry-content"><?php the_content(); ?></article>
  <?php endwhile; ?>
</section>
<?php get_footer();
