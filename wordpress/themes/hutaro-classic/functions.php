<?php
if (!defined('ABSPATH')) {
    exit;
}

function hutaro_classic_setup(): void {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
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
