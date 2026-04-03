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

function hutaro_classic_meta_description_from_text(string $text): string {
    $normalized = wp_strip_all_tags($text, true);
    $normalized = preg_replace('/\s+/u', ' ', $normalized ?? '');
    return trim((string) $normalized);
}

function hutaro_classic_get_default_social_image(): string {
    $front_id = (int) get_option('page_on_front');
    if ($front_id > 0) {
        if (has_post_thumbnail($front_id)) {
            $front_thumb = wp_get_attachment_image_url(get_post_thumbnail_id($front_id), 'full');
            if (is_string($front_thumb) && $front_thumb !== '') {
                return $front_thumb;
            }
        }

        $front_content = (string) get_post_field('post_content', $front_id);
        if (
            preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $front_content, $matches) === 1 &&
            isset($matches[1]) &&
            is_string($matches[1]) &&
            $matches[1] !== ''
        ) {
            return $matches[1];
        }
    }

    $site_icon = get_site_icon_url(512);
    if (is_string($site_icon) && $site_icon !== '') {
        return $site_icon;
    }

    return get_template_directory_uri() . '/assets/leaf.png';
}

function hutaro_classic_get_social_meta(): array {
    $title = wp_get_document_title();
    $description = '';
    $image = '';
    $image_alt = '';
    $type = is_singular() ? 'article' : 'website';
    $url = home_url(add_query_arg([], $GLOBALS['wp']->request ?? ''));

    if (is_front_page()) {
        $title = get_bloginfo('name');
        $description = hutaro_classic_meta_description_from_text((string) get_bloginfo('description'));
        $url = home_url('/');
    } elseif (is_singular()) {
        $post_id = get_queried_object_id();
        if ($post_id) {
            $excerpt = get_the_excerpt($post_id);
            if (!is_string($excerpt) || trim($excerpt) === '') {
                $content = get_post_field('post_content', $post_id);
                $excerpt = wp_trim_words(hutaro_classic_meta_description_from_text((string) $content), 35, '...');
            }
            $description = hutaro_classic_meta_description_from_text((string) $excerpt);

            if (has_post_thumbnail($post_id)) {
                $thumb_id = get_post_thumbnail_id($post_id);
                $thumb_url = wp_get_attachment_image_url($thumb_id, 'full');
                if (is_string($thumb_url) && $thumb_url !== '') {
                    $image = $thumb_url;
                }
                $thumb_alt = get_post_meta($thumb_id, '_wp_attachment_image_alt', true);
                if (is_string($thumb_alt) && trim($thumb_alt) !== '') {
                    $image_alt = trim($thumb_alt);
                }
            }
            $permalink = get_permalink($post_id);
            if (is_string($permalink) && $permalink !== '') {
                $url = $permalink;
            }
        }
    } elseif (is_home() || is_archive()) {
        $description = hutaro_classic_meta_description_from_text((string) get_bloginfo('description'));
        $url = get_pagenum_link(get_query_var('paged') ?: 1);
    }

    if ($description === '') {
        $description = hutaro_classic_meta_description_from_text((string) get_bloginfo('description'));
    }
    if ($description === '') {
        $description = hutaro_classic_meta_description_from_text($title);
    }

    if ($image === '') {
        $image = hutaro_classic_get_default_social_image();
    }
    if ($image_alt === '') {
        $image_alt = get_bloginfo('name');
    }

    return [
        'title' => $title,
        'description' => $description,
        'image' => $image,
        'image_alt' => $image_alt,
        'type' => $type,
        'url' => $url,
    ];
}

function hutaro_classic_output_social_meta_tags(): void {
    if (is_admin() || is_feed() || is_robots() || is_trackback()) {
        return;
    }

    $meta = hutaro_classic_get_social_meta();
    $locale = str_replace('_', '-', get_locale());
    $twitter_card = $meta['image'] !== '' ? 'summary_large_image' : 'summary';

    echo "\n";
    echo '<meta property="og:locale" content="' . esc_attr($locale) . '" />' . "\n";
    echo '<meta property="og:type" content="' . esc_attr($meta['type']) . '" />' . "\n";
    echo '<meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '" />' . "\n";
    echo '<meta property="og:title" content="' . esc_attr($meta['title']) . '" />' . "\n";
    echo '<meta property="og:description" content="' . esc_attr($meta['description']) . '" />' . "\n";
    echo '<meta property="og:url" content="' . esc_url($meta['url']) . '" />' . "\n";
    echo '<meta property="og:image" content="' . esc_url($meta['image']) . '" />' . "\n";
    echo '<meta property="og:image:alt" content="' . esc_attr($meta['image_alt']) . '" />' . "\n";
    echo '<meta name="twitter:card" content="' . esc_attr($twitter_card) . '" />' . "\n";
    echo '<meta name="twitter:title" content="' . esc_attr($meta['title']) . '" />' . "\n";
    echo '<meta name="twitter:description" content="' . esc_attr($meta['description']) . '" />' . "\n";
    echo '<meta name="twitter:image" content="' . esc_url($meta['image']) . '" />' . "\n";
    echo '<meta name="twitter:image:alt" content="' . esc_attr($meta['image_alt']) . '" />' . "\n";
}
add_action('wp_head', 'hutaro_classic_output_social_meta_tags', 5);
