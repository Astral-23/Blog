<?php
if (!defined('ABSPATH')) {
    exit;
}

function hutaro_classic_setup(): void {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('menus');
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
    register_nav_menus([
        'global' => 'Global Navigation',
    ]);
}
add_action('after_setup_theme', 'hutaro_classic_setup');

function hutaro_classic_enqueue_assets(): void {
    $css_path = get_stylesheet_directory() . '/style.css';
    $version = file_exists($css_path) ? (string) filemtime($css_path) : '0.1.0';
    wp_enqueue_style('hutaro-classic-style', get_stylesheet_uri(), [], $version);
}
add_action('wp_enqueue_scripts', 'hutaro_classic_enqueue_assets');

function hutaro_classic_nav_items(): array {
    return [
        ['href' => home_url('/'), 'label' => 'home'],
        ['href' => home_url('/blog/'), 'label' => 'blog'],
        ['href' => home_url('/blog-tech/'), 'label' => 'blog(tech)'],
    ];
}

function hutaro_classic_nav_fallback(): void {
    echo '<ul class="nav-list">';
    foreach (hutaro_classic_nav_items() as $item) {
        echo '<li class="menu-item"><a class="nav-link" href="' . esc_url($item['href']) . '">' . esc_html($item['label']) . '</a></li>';
    }
    echo '</ul>';
}

function hutaro_classic_render_post_cards(WP_Query $query): string {
    if (!$query->have_posts()) {
        return '<p>まだ記事がありません。</p>';
    }

    ob_start();
    echo '<ul class="post-list">';
    while ($query->have_posts()) {
        $query->the_post();
        echo '<li class="post-card">';
        echo '<a class="post-card-link" href="' . esc_url(get_permalink()) . '">';
        echo '<p class="post-date">' . esc_html(get_the_date('Y-m-d')) . '</p>';
        echo '<h2>' . esc_html(get_the_title()) . '</h2>';
        $excerpt = trim((string) get_the_excerpt());
        if ($excerpt === '') {
            $excerpt = trim((string) wp_strip_all_tags((string) get_the_content()));
            if ($excerpt !== '') {
                $excerpt = wp_trim_words($excerpt, 42, '...');
            }
        }
        if ($excerpt !== '') {
            echo '<p>' . esc_html($excerpt) . '</p>';
        }
        echo '</a>';
        echo '</li>';
    }
    echo '</ul>';
    wp_reset_postdata();

    return (string) ob_get_clean();
}

function hutaro_classic_tune_archive_queries(WP_Query $query): void {
    if (is_admin() || !$query->is_main_query()) {
        return;
    }

    if ($query->is_category(['blog', 'blog-tech']) || $query->is_home()) {
        $query->set('post_type', 'post');
        $query->set('post_status', 'publish');
        $query->set('posts_per_page', 12);
        $query->set('orderby', 'date');
        $query->set('order', 'DESC');
    }
}
add_action('pre_get_posts', 'hutaro_classic_tune_archive_queries');

function hutaro_classic_nav_link_classes(array $atts, WP_Post $menu_item, stdClass $args): array {
    if (!isset($args->theme_location) || $args->theme_location !== 'global') {
        return $atts;
    }

    $classes = [];
    if (isset($atts['class']) && is_string($atts['class']) && $atts['class'] !== '') {
        $classes = preg_split('/\s+/', $atts['class']) ?: [];
    }
    $classes[] = 'nav-link';
    $atts['class'] = implode(' ', array_unique(array_filter($classes)));
    return $atts;
}
add_filter('nav_menu_link_attributes', 'hutaro_classic_nav_link_classes', 10, 3);
