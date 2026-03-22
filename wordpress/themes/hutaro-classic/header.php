<?php if (!defined('ABSPATH')) { exit; } ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <?php $leaf_icon = get_template_directory_uri() . '/assets/leaf.png'; ?>
  <link rel="icon" type="image/png" href="<?php echo esc_url($leaf_icon); ?>" />
  <link rel="apple-touch-icon" href="<?php echo esc_url($leaf_icon); ?>" />
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="site-header">
  <div class="site-header-inner">
    <a class="site-title" href="<?php echo esc_url(home_url('/')); ?>">
      <span>Hutaro Blog</span>
      <span style="font-size:0.78em;">4th Edition</span>
    </a>
    <nav aria-label="Global">
      <?php
      wp_nav_menu([
          'theme_location' => 'global',
          'container' => false,
          'menu_class' => 'nav-list',
          'fallback_cb' => 'hutaro_classic_nav_fallback',
      ]);
      ?>
    </nav>
  </div>
</header>
<main class="site-main">
