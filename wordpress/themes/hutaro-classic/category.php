<?php
if (!defined('ABSPATH')) { exit; }
get_header();
$slug = get_queried_object() && isset(get_queried_object()->slug) ? (string) get_queried_object()->slug : '';
$title = $slug !== '' ? $slug : single_cat_title('', false);
$lead = '';
if ($slug === 'blog') {
    $lead = '✩ゆるふわ日常系コメディ✩';
}
if ($slug === 'blog-tech') {
    $lead = '工学部...つまりメイドさんロボが作れるってことか？';
}
?>
<section class="page-wrap">
  <h1 class="page-title"><?php echo esc_html($title); ?></h1>
  <?php if ($lead !== ''): ?><p class="page-lead"><?php echo esc_html($lead); ?></p><?php endif; ?>
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
