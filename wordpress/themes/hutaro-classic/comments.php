<?php
if (!defined('ABSPATH')) {
    exit;
}

if (post_password_required()) {
    return;
}

$embed_args = $GLOBALS['hutaro_comments_embed_args'] ?? null;
$title_reply = 'コメントを書く';
$title_reply_before = '<h3 id="reply-title" class="comment-reply-title">';
$title_reply_after = '</h3>';
if (is_array($embed_args) && !empty($embed_args['title_is_explicit'])) {
    $title_reply = trim((string) ($embed_args['title_reply'] ?? ''));
    if ($title_reply === '') {
        $title_reply_before = '';
        $title_reply_after = '';
    }
} elseif (is_array($embed_args) && isset($embed_args['title_reply'])) {
    $candidate = trim((string) $embed_args['title_reply']);
    if ($candidate !== '') {
        $title_reply = $candidate;
    }
}

$section_classes = ['comments-area'];
if (is_array($embed_args) && isset($embed_args['extra_classes']) && is_array($embed_args['extra_classes'])) {
    foreach ($embed_args['extra_classes'] as $class_name) {
        $sanitized = sanitize_html_class((string) $class_name);
        if ($sanitized !== '') {
            $section_classes[] = $sanitized;
        }
    }
}
?>
<section id="comments" class="<?php echo esc_attr(implode(' ', array_values(array_unique($section_classes)))); ?>">
  <?php if (have_comments()): ?>
    <h2 class="comments-title">
      <?php
      printf(
          esc_html(_nx('%1$s件のコメント', '%1$s件のコメント', get_comments_number(), 'comments title', 'hutaro-classic')),
          esc_html(number_format_i18n(get_comments_number()))
      );
      ?>
    </h2>

    <ol class="comment-list">
      <?php
      wp_list_comments([
          'style' => 'ol',
          'short_ping' => true,
          'avatar_size' => 40,
      ]);
      ?>
    </ol>

    <?php if (get_comment_pages_count() > 1 && get_option('page_comments')): ?>
      <nav class="comment-navigation" aria-label="<?php esc_attr_e('コメントページナビゲーション', 'hutaro-classic'); ?>">
        <div class="comment-navigation-prev"><?php previous_comments_link(esc_html__('古いコメント', 'hutaro-classic')); ?></div>
        <div class="comment-navigation-next"><?php next_comments_link(esc_html__('新しいコメント', 'hutaro-classic')); ?></div>
      </nav>
    <?php endif; ?>

    <?php if (!comments_open()): ?>
      <p class="no-comments"><?php esc_html_e('コメントは受け付けていません。', 'hutaro-classic'); ?></p>
    <?php endif; ?>
  <?php endif; ?>

  <?php
  comment_form([
      'title_reply' => $title_reply,
      'title_reply_before' => $title_reply_before,
      'title_reply_after' => $title_reply_after,
      'label_submit' => '送信',
      'comment_notes_before' => '',
      'comment_notes_after' => '',
  ]);
  ?>
</section>
