<?php
if (!defined('ABSPATH')) { exit; }
get_header();
?>
<section class="page-wrap">
  <h1 class="page-title">blog</h1>
  <?php
  global $wp_query;
  if ($wp_query instanceof WP_Query) {
      echo hutaro_classic_render_post_cards($wp_query);
      echo '<nav class="pagination-wrap" aria-label="Pagination">';
      echo paginate_links([
          'prev_text' => 'Prev',
          'next_text' => 'Next',
          'type' => 'list',
      ]);
      echo '</nav>';
  }
  ?>
</section>
<?php get_footer();
