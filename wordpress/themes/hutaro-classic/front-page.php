<?php
if (!defined('ABSPATH')) { exit; }
get_header();
?>
<section class="page-wrap">
  <article class="entry-content">
    <?php
    while (have_posts()) {
        the_post();
        the_content();
    }
    ?>
  </article>
</section>
<?php get_footer();
