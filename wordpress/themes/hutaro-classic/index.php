<?php
if (!defined('ABSPATH')) { exit; }
get_header();
?>
<section class="page-wrap">
  <h1 class="page-title">blog</h1>
  <?php
  $q = new WP_Query([
      'post_type' => 'post',
      'post_status' => 'publish',
      'posts_per_page' => 100,
      'orderby' => 'date',
      'order' => 'DESC',
  ]);
  echo hutaro_classic_render_post_cards($q);
  ?>
</section>
<?php get_footer();
