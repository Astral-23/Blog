<?php if (!defined('ABSPATH')) { exit; } ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
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
      <ul class="nav-list">
        <?php
        $currentPath = (string) wp_parse_url(home_url(add_query_arg([])), PHP_URL_PATH);
        foreach (hutaro_classic_nav_items() as $item):
            $itemPath = (string) wp_parse_url($item['href'], PHP_URL_PATH);
            $isActive = untrailingslashit($currentPath) === untrailingslashit($itemPath);
        ?>
          <li><a class="nav-link<?php echo $isActive ? ' is-active' : ''; ?>" href="<?php echo esc_url($item['href']); ?>"><?php echo esc_html($item['label']); ?></a></li>
        <?php endforeach; ?>
      </ul>
    </nav>
  </div>
</header>
<main class="site-main">
