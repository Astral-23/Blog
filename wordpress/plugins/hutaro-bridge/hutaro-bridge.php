<?php
/**
 * Plugin Name: Hutaro Bridge
 * Description: Compatibility layer for Hutaro Blog migration (embeds, counter API, health API).
 * Version: 0.1.0
 * Author: Hutaro
 */

if (!defined('ABSPATH')) {
    exit;
}

final class HutaroBridge {
    private const COUNTER_OPTION_KEY = 'hutaro_counter_store';
    private const COUNTER_KEY_PATTERN = '/^[a-z0-9][a-z0-9:_\/-]{0,127}$/';
    private const COUNTER_HIT_COOLDOWN_SEC = 1800;
    private const BOT_UA_PATTERN = '/(bot|crawler|spider|slurp|bingpreview|mediapartners-google|adsbot|google web preview|headless|selenium|phantomjs|curl|wget|python-requests|go-http-client|axios|httpclient|scrapy|uptimerobot|pingdom|statuscake|datadog|newrelic|lighthouse)/i';
    private static ?array $embed_spec_cache = null;
    private static ?array $shortcode_renderer_map_cache = null;

    public static function init(): void {
        foreach (array_keys(self::get_shortcode_renderer_map()) as $shortcode) {
            add_shortcode($shortcode, [self::class, 'render_embed_shortcode']);
        }

        add_filter('the_content', [self::class, 'transform_md_embed_tags'], 5);
        add_filter('the_content', [self::class, 'harden_external_links'], 20);

        add_action('rest_api_init', [self::class, 'register_rest_routes']);
        add_action('wp_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('init', [self::class, 'register_legacy_rewrite_rules']);
        add_action('template_redirect', [self::class, 'redirect_legacy_category_paths'], 1);
        add_action('parse_request', [self::class, 'handle_legacy_api_request']);
        add_filter('upload_mimes', [self::class, 'allow_extra_mimes']);
        add_filter('wp_sitemaps_add_provider', [self::class, 'filter_sitemap_providers'], 10, 2);
        add_filter('wp_sitemaps_posts_query_args', [self::class, 'filter_sitemap_posts_query_args'], 10, 2);
    }

    public static function on_activation(): void {
        self::register_legacy_rewrite_rules();
        flush_rewrite_rules();
    }

    public static function on_deactivation(): void {
        flush_rewrite_rules();
    }

    public static function enqueue_assets(): void {
        $base_dir = plugin_dir_path(__FILE__) . 'assets/';
        $base_url = plugin_dir_url(__FILE__) . 'assets/';

        $css_path = $base_dir . 'hutaro-bridge.css';
        $js_path = $base_dir . 'hutaro-bridge.js';
        $othello_css_path = $base_dir . 'othello-demo.css';
        $othello_js_path = $base_dir . 'othello-demo.js';

        $css_ver = file_exists($css_path) ? (string) filemtime($css_path) : '0.1.0';
        $js_ver = file_exists($js_path) ? (string) filemtime($js_path) : '0.1.0';
        $othello_css_ver = file_exists($othello_css_path) ? (string) filemtime($othello_css_path) : '0.1.0';
        $othello_js_ver = file_exists($othello_js_path) ? (string) filemtime($othello_js_path) : '0.1.0';

        wp_enqueue_style(
            'hutaro-bridge-style',
            $base_url . 'hutaro-bridge.css',
            [],
            $css_ver
        );
        wp_enqueue_script(
            'hutaro-bridge-script',
            $base_url . 'hutaro-bridge.js',
            [],
            $js_ver,
            true
        );

        if (!self::is_othello_demo_page()) {
            return;
        }

        wp_enqueue_style(
            'hutaro-othello-demo-style',
            $base_url . 'othello-demo.css',
            ['hutaro-bridge-style'],
            $othello_css_ver
        );
        wp_enqueue_script(
            'hutaro-othello-demo-script',
            $base_url . 'othello-demo.js',
            [],
            $othello_js_ver,
            true
        );
        wp_add_inline_script(
            'hutaro-othello-demo-script',
            'window.HUTARO_OTHELLO_CONFIG = ' . wp_json_encode([
                'apiBase' => home_url('/api/othello'),
            ]) . ';',
            'before'
        );
    }

    private static function is_othello_demo_page(): bool {
        if (!is_singular('post')) {
            return false;
        }

        $post_id = get_queried_object_id();
        if ($post_id <= 0) {
            return false;
        }

        return get_post_field('post_name', $post_id) === 'othello' && has_category('works', $post_id);
    }

    public static function render_text_shortcode(array $atts, string $content = ''): string {
        $attrs = shortcode_atts([
            'position' => 'left',
            'size' => '',
            'color' => '',
            'text' => '',
        ], $atts, 'hutaro_text');

        $position = in_array($attrs['position'], ['left', 'center', 'right'], true) ? $attrs['position'] : 'left';
        $text = trim($attrs['text']) !== '' ? $attrs['text'] : $content;
        if (trim($text) === '') {
            return '';
        }

        $style = [];
        if (preg_match('/^\d+(\.\d+)?$/', $attrs['size'])) {
            $style[] = 'font-size:' . esc_attr($attrs['size']) . 'rem';
        } elseif (preg_match('/^\d+(\.\d+)?(px|rem|em|%)$/', $attrs['size'])) {
            $style[] = 'font-size:' . esc_attr($attrs['size']);
        }

        if (preg_match('/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgb\([^\)]+\)|rgba\([^\)]+\)|hsl\([^\)]+\)|hsla\([^\)]+\))$/', $attrs['color'])) {
            $style[] = 'color:' . esc_attr($attrs['color']);
        }

        return sprintf(
            '<div class="hutaro-embed-text align-%s"%s>%s</div>',
            esc_attr($position),
            count($style) > 0 ? ' style="' . esc_attr(implode(';', $style)) . '"' : '',
            wp_kses_post(do_shortcode($text))
        );
    }

    public static function render_box_shortcode(array $atts, string $content = ''): string {
        $attrs = shortcode_atts([
            'html' => '',
            'text' => '',
        ], $atts, 'hutaro_box');

        $html = trim((string) $attrs['html']);
        if ($html !== '') {
            return sprintf(
                '<div class="hutaro-embed-box">%s</div>',
                wp_kses_post(do_shortcode($html))
            );
        }

        $text = trim($attrs['text']) !== '' ? $attrs['text'] : $content;
        if (trim($text) === '') {
            return '';
        }

        return sprintf(
            '<div class="hutaro-embed-box"><p>%s</p></div>',
            wp_kses_post(nl2br(do_shortcode($text)))
        );
    }

    public static function render_ticker_shortcode(array $atts, string $content = ''): string {
        $attrs = shortcode_atts([
            'text' => '',
            'speed' => 'normal',
            'color' => 'rainbow',
            'size' => '',
        ], $atts, 'hutaro_ticker');

        $duration = self::resolve_ticker_duration($attrs['speed']);
        $is_static = $duration === null;

        $color = strtolower(trim((string) $attrs['color']));
        $color_class = in_array($color, ['rainbow', 'white', 'accent'], true) ? $color : 'rainbow';
        $text_style = '';
        if (preg_match('/^\d+(\.\d+)?$/', $attrs['size'])) {
            $text_style = ' style="font-size:' . esc_attr($attrs['size']) . 'rem"';
        } elseif (preg_match('/^\d+(\.\d+)?(px|rem|em|%)$/', $attrs['size'])) {
            $text_style = ' style="font-size:' . esc_attr($attrs['size']) . '"';
        }

        return sprintf(
            '<div class="hutaro-ticker hutaro-ticker-color-%s%s" data-hutaro-ticker="1" data-text="%s" data-duration-sec="%s" data-color="%s"><span class="hutaro-ticker-track"><span class="hutaro-ticker-text"%s></span></span></div>',
            esc_attr($color_class),
            $is_static ? ' hutaro-ticker-static' : '',
            esc_attr((string) $attrs['text']),
            esc_attr($duration === null ? '0' : (string) $duration),
            esc_attr((string) $attrs['color']),
            $text_style
        );
    }

    public static function render_counter_shortcode(array $atts, string $content = ''): string {
        $attrs = shortcode_atts([
            'key' => 'home',
            'counterKey' => '',
            'digits' => '7',
        ], $atts, 'hutaro_counter');

        $key = trim($attrs['counterKey']) !== '' ? $attrs['counterKey'] : $attrs['key'];
        if (!self::is_valid_counter_key($key)) {
            $key = 'home';
        }

        $digits = intval($attrs['digits']);
        if ($digits < 1) {
            $digits = 7;
        }

        return sprintf(
            '<span class="hutaro-embed-counter" data-hutaro-counter="1" data-key="%s" data-digits="%d">0000000</span>',
            esc_attr($key),
            $digits
        );
    }

    public static function render_latest_posts_shortcode(array $atts, string $content = ''): string {
        $attrs = shortcode_atts([
            'source' => 'all',
            'count' => '5',
        ], $atts, 'hutaro_latest_posts');

        $count = intval($attrs['count']);
        if ($count < 1) {
            $count = 5;
        }
        if ($count > 20) {
            $count = 20;
        }

        $source = trim((string) $attrs['source']);

        $query_args = [
            'post_type' => 'post',
            'post_status' => 'publish',
            'posts_per_page' => $count,
            'orderby' => 'date',
            'order' => 'DESC',
        ];

        if ($source === 'blog' || $source === 'blog-tech') {
            $query_args['category_name'] = $source;
        } else {
            // source=all でも移行対象カテゴリのみを表示する。
            $query_args['category_name'] = 'blog,blog-tech';
        }

        $query = new WP_Query($query_args);

        if (!$query->have_posts()) {
            return '<p class="hutaro-embed-note">最新記事はまだありません。</p>';
        }

        // テーマ側の一覧カード描画を再利用して、/blog と同一見た目を保証する。
        if (function_exists('hutaro_classic_render_post_cards')) {
            $cards = hutaro_classic_render_post_cards($query);
            return '<div class="hutaro-embed-latest-posts">' . $cards . '</div>';
        }

        $items = [];
        while ($query->have_posts()) {
            $query->the_post();
            $excerpt = trim((string) get_the_excerpt());
            $items[] = sprintf(
                '<li class="post-card"><a class="post-card-link" href="%s"><p class="post-date">%s</p><h2>%s</h2>%s</a></li>',
                esc_url(get_permalink()),
                esc_html(get_the_date('Y-m-d')),
                esc_html(get_the_title()),
                $excerpt !== '' ? '<p>' . esc_html($excerpt) . '</p>' : ''
            );
        }
        wp_reset_postdata();

        return '<div class="hutaro-embed-latest-posts"><ul class="post-list">' . implode('', $items) . '</ul></div>';
    }

    public static function render_joke_buttons_shortcode(array $atts, string $content = ''): string {
        $attrs = shortcode_atts([
            'persist' => 'none',
        ], $atts, 'hutaro_joke_buttons');

        $persist = strtolower(trim((string) $attrs['persist']));
        $persist_mode = in_array($persist, ['none', 'local'], true) ? $persist : 'none';
        $labels = ['いいね', '高評価', 'チャンネル登録'];
        $items = [];
        foreach ($labels as $label) {
            $items[] = sprintf(
                '<button type="button" class="hutaro-joke-button" data-hutaro-joke-button="%s" aria-pressed="false">%s</button>',
                esc_attr($label),
                esc_html($label)
            );
        }

        return sprintf(
            '<section class="hutaro-joke-buttons" data-hutaro-joke-buttons="1" data-persist="%s" aria-label="ジョークボタン">%s</section>',
            esc_attr($persist_mode),
            implode('', $items)
        );
    }

    public static function render_comments_shortcode(array $atts, string $content = ''): string {
        if (!is_singular() || post_password_required()) {
            return '';
        }

        $attrs = shortcode_atts([
            'title' => '',
            'class' => '',
        ], $atts, 'hutaro_comments');

        $title = trim(wp_strip_all_tags((string) $attrs['title']));
        $title_is_explicit = array_key_exists('title', $atts);
        $extra_classes = [];
        foreach (preg_split('/\s+/', trim((string) $attrs['class'])) ?: [] as $candidate) {
            $sanitized = sanitize_html_class($candidate);
            if ($sanitized !== '') {
                $extra_classes[] = $sanitized;
            }
        }

        $GLOBALS['hutaro_comments_embed_args'] = [
            'title_reply' => $title,
            'title_is_explicit' => $title_is_explicit,
            'extra_classes' => array_values(array_unique($extra_classes)),
        ];

        ob_start();
        comments_template();
        $html = (string) ob_get_clean();

        unset($GLOBALS['hutaro_comments_embed_args']);
        return $html;
    }

    public static function render_embed_shortcode($atts, string $content = '', string $tag = ''): string {
        $renderer = self::get_shortcode_renderer($tag);
        if ($renderer === '') {
            return '';
        }

        $method = self::renderer_to_method_name($renderer);
        if ($method === '' || !method_exists(self::class, $method)) {
            return '';
        }

        return (string) self::{$method}(self::decode_shortcode_atts(is_array($atts) ? $atts : []), self::decode_shortcode_attr((string) $content));
    }

    public static function render_tweet_shortcode(array $atts, string $content = ''): string {
        $attrs = shortcode_atts([
            'url' => '',
        ], $atts, 'hutaro_tweet');

        $url = trim((string) $attrs['url']);
        if ($url === '') {
            return '';
        }

        return self::render_wp_embed_shortcode($url);
    }

    private static function canonical_tweet_url(string $raw_url): string {
        $input = trim($raw_url);
        if ($input === '') {
            return '';
        }

        $parts = wp_parse_url($input);
        if (!is_array($parts)) {
            return '';
        }

        $host = isset($parts['host']) ? strtolower((string) $parts['host']) : '';
        if (!in_array($host, ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'], true)) {
            return '';
        }

        $path = isset($parts['path']) ? (string) $parts['path'] : '';
        if (!preg_match('#^/([A-Za-z0-9_]{1,15})/status(?:es)?/(\d+)(?:/)?$#', $path, $matches)) {
            return '';
        }

        return 'https://twitter.com/' . $matches[1] . '/status/' . $matches[2];
    }

    private static function render_wp_embed_shortcode(string $raw_url): string {
        $canonical = self::canonical_tweet_url($raw_url);
        if ($canonical === '') {
            $fallback = trim($raw_url);
            if ($fallback === '') {
                return '';
            }
            return sprintf('<a href="%1$s">%1$s</a>', esc_url($fallback));
        }

        return sprintf(
            '<blockquote class="twitter-tweet"><a href="%1$s">%1$s</a></blockquote>',
            esc_url($canonical)
        );
    }

    public static function register_rest_routes(): void {
        register_rest_route('hutaro/v1', '/health', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'rest_health'],
        ]);

        register_rest_route('hutaro/v1', '/counter', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'args' => [
                'key' => [
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => static function ($value) {
                        return sanitize_text_field((string) $value);
                    },
                    'validate_callback' => static function ($value) {
                        return HutaroBridge::is_valid_counter_key(trim((string) $value));
                    },
                ],
            ],
            'callback' => [self::class, 'rest_counter_get'],
        ]);

        register_rest_route('hutaro/v1', '/counter', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'args' => [
                'key' => [
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => static function ($value) {
                        return sanitize_text_field((string) $value);
                    },
                    'validate_callback' => static function ($value) {
                        return HutaroBridge::is_valid_counter_key(trim((string) $value));
                    },
                ],
            ],
            'callback' => [self::class, 'rest_counter_post'],
        ]);
    }

    public static function register_legacy_rewrite_rules(): void {
        // Next.js互換の公開URLをWordPressへマップ
        add_rewrite_rule('^blog/?$', 'index.php?category_name=blog', 'top');
        add_rewrite_rule('^blog-tech/?$', 'index.php?category_name=blog-tech', 'top');
        add_rewrite_rule('^works/?$', 'index.php?category_name=works', 'top');
        add_rewrite_rule('^blog/([^/]+)/?$', 'index.php?category_name=blog&name=$matches[1]', 'top');
        add_rewrite_rule('^blog-tech/([^/]+)/?$', 'index.php?category_name=blog-tech&name=$matches[1]', 'top');
        add_rewrite_rule('^works/([^/]+)/?$', 'index.php?category_name=works&name=$matches[1]', 'top');

        // 旧API互換
        add_rewrite_rule('^api/health/?$', 'index.php?hutaro_legacy_api=health', 'top');
        add_rewrite_rule('^api/access-counter/?$', 'index.php?hutaro_legacy_api=access-counter', 'top');
    }

    public static function redirect_legacy_category_paths(): void {
        if (is_admin() || is_feed() || wp_doing_ajax() || wp_doing_cron()) {
            return;
        }
        if (!is_category()) {
            return;
        }

        $term = get_queried_object();
        if (!$term instanceof WP_Term) {
            return;
        }

        $slug = (string) $term->slug;
        if ($slug !== 'blog' && $slug !== 'blog-tech' && $slug !== 'works') {
            return;
        }

        if ($slug === 'blog') {
            $base = '/blog/';
        } elseif ($slug === 'blog-tech') {
            $base = '/blog-tech/';
        } else {
            $base = '/works/';
        }
        $paged = max(1, intval(get_query_var('paged')));
        $target = $paged > 1 ? home_url($base . 'page/' . $paged . '/') : home_url($base);
        $target = trailingslashit($target);

        $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
        $request_path = wp_parse_url($request_uri, PHP_URL_PATH);
        $target_path = wp_parse_url($target, PHP_URL_PATH);

        if (is_string($request_path) && is_string($target_path) && untrailingslashit($request_path) === untrailingslashit($target_path)) {
            return;
        }

        wp_safe_redirect($target, 301, 'HutaroBridge');
        exit;
    }

    public static function handle_legacy_api_request(WP $wp): void {
        $api = isset($wp->query_vars['hutaro_legacy_api']) ? (string) $wp->query_vars['hutaro_legacy_api'] : '';
        if ($api === '') {
            return;
        }

        $request = self::build_legacy_rest_request($api);
        if (!$request instanceof WP_REST_Request) {
            self::send_legacy_response(new WP_Error('not_found', 'not found', ['status' => 404]));
        }

        $response = rest_do_request($request);
        self::send_legacy_response($response);
    }

    public static function rest_health(?WP_REST_Request $request = null): WP_REST_Response {
        return new WP_REST_Response([
            'status' => 'ok',
            'service' => 'blog',
            'timestamp' => gmdate('c'),
        ], 200);
    }

    public static function rest_counter_get(WP_REST_Request $request) {
        $key = trim((string) $request->get_param('key'));
        if (!self::is_valid_counter_key($key)) {
            return new WP_REST_Response(['error' => 'invalid key'], 400);
        }

        $entry = self::get_counter_entry($key);
        return new WP_REST_Response([
            'key' => $key,
            'total' => intval($entry['total']),
            'updatedAt' => (string) $entry['updatedAt'],
        ], 200);
    }

    public static function rest_counter_post(WP_REST_Request $request) {
        $body = $request->get_json_params();
        $key = isset($body['key']) ? trim((string) $body['key']) : trim((string) $request->get_param('key'));
        if (!self::is_valid_counter_key($key)) {
            return new WP_REST_Response(['error' => 'invalid key'], 400);
        }

        $store = self::get_counter_store();
        $entry = isset($store[$key]) && is_array($store[$key]) ? $store[$key] : [
            'total' => 0,
            'updatedAt' => gmdate('c'),
        ];

        if (!self::should_count_counter_hit($request, $key)) {
            return new WP_REST_Response([
                'key' => $key,
                'total' => intval($entry['total']),
                'updatedAt' => (string) $entry['updatedAt'],
                'counted' => false,
            ], 200);
        }

        $entry['total'] = intval($entry['total']) + 1;
        $entry['updatedAt'] = gmdate('c');

        $store[$key] = $entry;
        update_option(self::COUNTER_OPTION_KEY, $store, false);

        return new WP_REST_Response([
            'key' => $key,
            'total' => intval($entry['total']),
            'updatedAt' => (string) $entry['updatedAt'],
            'counted' => true,
        ], 200);
    }

    private static function send_legacy_response($response): void {
        if (is_wp_error($response)) {
            $status = 500;
            $error_data = $response->get_error_data();
            if (is_array($error_data) && isset($error_data['status'])) {
                $status = intval($error_data['status']);
            }
            if ($status < 100 || $status > 599) {
                $status = 500;
            }
            nocache_headers();
            wp_send_json(['error' => $response->get_error_message()], $status);
        }

        $normalized = rest_ensure_response($response);
        if (is_wp_error($normalized)) {
            self::send_legacy_response($normalized);
        }

        if ($normalized instanceof WP_HTTP_Response) {
            nocache_headers();
            wp_send_json($normalized->get_data(), $normalized->get_status());
        }

        nocache_headers();
        wp_send_json(['error' => 'invalid response'], 500);
    }

    private static function build_legacy_rest_request(string $api): ?WP_REST_Request {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';

        if ($api === 'health') {
            if ($method !== 'GET') {
                return null;
            }
            return new WP_REST_Request('GET', '/hutaro/v1/health');
        }

        if ($api === 'access-counter') {
            if ($method === 'GET') {
                $key = isset($_GET['key']) ? sanitize_text_field(wp_unslash((string) $_GET['key'])) : '';
                $request = new WP_REST_Request('GET', '/hutaro/v1/counter');
                $request->set_param('key', $key);
                return $request;
            }

            if ($method === 'POST') {
                $raw = file_get_contents('php://input');
                $decoded = json_decode(is_string($raw) ? $raw : '', true);
                $key = isset($decoded['key']) ? trim((string) $decoded['key']) : '';
                $request = new WP_REST_Request('POST', '/hutaro/v1/counter');
                $request->set_param('key', $key);
                return $request;
            }

            return null;
        }

        return null;
    }

    public static function transform_md_embed_tags(string $content): string {
        if (strpos($content, 'md-embed') === false) {
            return $content;
        }

        if (!class_exists('DOMDocument')) {
            return $content;
        }

        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML('<?xml encoding="utf-8" ?><div>' . $content . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        if (!$loaded) {
            return $content;
        }

        $nodes = $dom->getElementsByTagName('md-embed');
        if ($nodes->length === 0) {
            return $content;
        }

        $targets = [];
        foreach ($nodes as $node) {
            $targets[] = $node;
        }

        foreach ($targets as $node) {
            if (!$node instanceof DOMElement || !$node->parentNode) {
                continue;
            }
            $attrs = self::parse_element_attrs($node);
            $body = trim((string) $node->textContent);
            $shortcode = self::md_embed_to_shortcode($attrs, $body);
            $node->parentNode->replaceChild($dom->createTextNode($shortcode), $node);
        }

        $html = $dom->saveHTML();
        if (!is_string($html)) {
            return $content;
        }
        return preg_replace('/^<div>|<\/div>$/', '', $html) ?? $content;
    }

    private static function md_embed_to_shortcode(array $attrs, string $body): string {
        $type = isset($attrs['type']) ? trim((string) $attrs['type']) : '';
        if ($type === '') {
            return '';
        }

        $spec = self::get_embed_type_spec($type);
        if ($spec === null) {
            return '';
        }

        $allowed = isset($spec['attrs']) && is_array($spec['attrs']) ? $spec['attrs'] : [];
        $parts = [];
        foreach ($allowed as $key) {
            if (!isset($attrs[$key])) {
                continue;
            }
            $parts[] = sprintf('%s="%s"', $key === 'counterkey' ? 'counterKey' : $key, esc_attr(self::escape_shortcode_attr((string) $attrs[$key])));
        }

        $body_attr = isset($spec['bodyAttr']) ? trim((string) $spec['bodyAttr']) : '';
        if ($body !== '' && $body_attr !== '' && !isset($attrs[$body_attr])) {
            $parts[] = sprintf('%s="%s"', $body_attr, esc_attr(self::escape_shortcode_attr($body)));
        }

        $shortcode = isset($spec['shortcode']) ? trim((string) $spec['shortcode']) : '';
        if ($shortcode === '') {
            return '';
        }

        return '[' . $shortcode . (count($parts) > 0 ? ' ' . implode(' ', $parts) : '') . ']';
    }

    private static function get_embed_type_spec(string $type): ?array {
        $spec = self::get_embed_spec();
        if (!isset($spec['types']) || !is_array($spec['types'])) {
            return null;
        }
        if (!isset($spec['types'][$type]) || !is_array($spec['types'][$type])) {
            return null;
        }
        return $spec['types'][$type];
    }

    private static function get_embed_spec(): array {
        if (self::$embed_spec_cache !== null) {
            return self::$embed_spec_cache;
        }

        $path = plugin_dir_path(__FILE__) . 'embed-spec.json';
        if (file_exists($path)) {
            $raw = file_get_contents($path);
            if (is_string($raw) && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded) && isset($decoded['types']) && is_array($decoded['types'])) {
                    self::$embed_spec_cache = $decoded;
                    return self::$embed_spec_cache;
                }
            }
        }

        self::$embed_spec_cache = [
            'types' => [
                'latestPosts' => [
                    'shortcode' => 'hutaro_latest_posts',
                    'renderer' => 'latestPosts',
                    'attrs' => ['count', 'source'],
                ],
                'ticker' => [
                    'shortcode' => 'hutaro_ticker',
                    'renderer' => 'ticker',
                    'attrs' => ['text', 'size', 'speed', 'color'],
                    'bodyAttr' => 'text',
                ],
                'counter' => [
                    'shortcode' => 'hutaro_counter',
                    'renderer' => 'counter',
                    'attrs' => ['counterkey', 'digits'],
                ],
                'comments' => [
                    'shortcode' => 'hutaro_comments',
                    'renderer' => 'comments',
                    'attrs' => ['title'],
                ],
                'jokeButtons' => [
                    'shortcode' => 'hutaro_joke_buttons',
                    'renderer' => 'jokeButtons',
                    'attrs' => ['persist'],
                ],
                'tweet' => [
                    'shortcode' => 'hutaro_tweet',
                    'renderer' => 'tweet',
                    'attrs' => ['url'],
                ],
                'box' => [
                    'shortcode' => 'hutaro_box',
                    'renderer' => 'box',
                    'attrs' => ['html', 'text'],
                    'bodyAttr' => 'text',
                ],
                'text' => [
                    'shortcode' => 'hutaro_text',
                    'renderer' => 'text',
                    'attrs' => ['text', 'size', 'position', 'color'],
                    'bodyAttr' => 'text',
                ],
                'styledText' => [
                    'shortcode' => 'hutaro_text',
                    'renderer' => 'text',
                    'attrs' => ['text', 'size', 'position', 'color'],
                    'bodyAttr' => 'text',
                ],
            ],
        ];

        return self::$embed_spec_cache;
    }

    private static function get_shortcode_renderer_map(): array {
        if (self::$shortcode_renderer_map_cache !== null) {
            return self::$shortcode_renderer_map_cache;
        }

        $map = [];
        $spec = self::get_embed_spec();
        $types = isset($spec['types']) && is_array($spec['types']) ? $spec['types'] : [];
        foreach ($types as $type_spec) {
            if (!is_array($type_spec)) {
                continue;
            }
            $shortcode = isset($type_spec['shortcode']) ? trim((string) $type_spec['shortcode']) : '';
            $renderer = isset($type_spec['renderer']) ? trim((string) $type_spec['renderer']) : '';
            if ($shortcode === '' || $renderer === '' || isset($map[$shortcode])) {
                continue;
            }
            $map[$shortcode] = $renderer;
        }

        self::$shortcode_renderer_map_cache = $map;
        return self::$shortcode_renderer_map_cache;
    }

    private static function get_shortcode_renderer(string $tag): string {
        $map = self::get_shortcode_renderer_map();
        return isset($map[$tag]) ? (string) $map[$tag] : '';
    }

    private static function renderer_to_method_name(string $renderer): string {
        $normalized = preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', trim($renderer));
        if (!is_string($normalized)) {
            return '';
        }
        $normalized = strtolower(str_replace([' ', '-'], '_', $normalized));
        if ($normalized === '') {
            return '';
        }
        return 'render_' . $normalized . '_shortcode';
    }

    private static function escape_shortcode_attr(string $value): string {
        return str_replace(
            ["\\", "\r\n", "\r", "\n", '"'],
            ["\\\\", "\n", "\n", "\\n", "'"],
            $value
        );
    }

    private static function decode_shortcode_attr(string $value): string {
        return str_replace(
            ["\0", "\\n"],
            ["\\", "\n"],
            str_replace("\\\\", "\0", $value)
        );
    }

    private static function decode_shortcode_atts(array $atts): array {
        $decoded = [];
        foreach ($atts as $key => $value) {
            if (is_string($value)) {
                $decoded[$key] = self::decode_shortcode_attr($value);
                continue;
            }
            $decoded[$key] = $value;
        }
        return $decoded;
    }

    private static function parse_element_attrs(DOMElement $node): array {
        $attrs = [];
        if (!$node->hasAttributes()) {
            return $attrs;
        }
        foreach ($node->attributes as $attribute) {
            if (!$attribute) {
                continue;
            }
            $attrs[strtolower($attribute->name)] = (string) $attribute->value;
        }
        return $attrs;
    }

    public static function harden_external_links(string $content): string {
        if (stripos($content, '<a ') === false) {
            return $content;
        }

        if (!class_exists('DOMDocument')) {
            return $content;
        }

        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8" ?><div>' . $content . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        $anchors = $dom->getElementsByTagName('a');
        $site_host = wp_parse_url(home_url(), PHP_URL_HOST);

        foreach ($anchors as $anchor) {
            $href = trim((string) $anchor->getAttribute('href'));
            if ($href === '') {
                continue;
            }

            $host = wp_parse_url($href, PHP_URL_HOST);
            if ($host && $site_host && strtolower((string) $host) !== strtolower((string) $site_host)) {
                $anchor->setAttribute('target', '_blank');

                $rel = trim((string) $anchor->getAttribute('rel'));
                $rels = array_filter(array_unique(array_merge(explode(' ', $rel), ['noreferrer', 'noopener'])));
                $anchor->setAttribute('rel', implode(' ', $rels));
            }
        }

        $html = $dom->saveHTML();
        if (!is_string($html)) {
            return $content;
        }

        return preg_replace('/^<div>|<\/div>$/', '', $html) ?? $content;
    }

    private static function is_valid_counter_key(string $key): bool {
        return preg_match(self::COUNTER_KEY_PATTERN, $key) === 1;
    }

    private static function should_count_counter_hit(WP_REST_Request $request, string $key): bool {
        if (self::is_likely_non_human_request($request)) {
            return false;
        }

        $ip = self::resolve_client_ip();
        if ($ip === '') {
            return true;
        }

        $cooldown_key = 'hutaro_counter_cd_' . md5($key . '|' . $ip);
        $cooldown_hit = get_transient($cooldown_key);
        if ($cooldown_hit !== false) {
            return false;
        }

        set_transient($cooldown_key, 1, self::COUNTER_HIT_COOLDOWN_SEC);
        return true;
    }

    private static function is_likely_non_human_request(WP_REST_Request $request): bool {
        $ua = trim((string) $request->get_header('user_agent'));
        if ($ua === '' || preg_match(self::BOT_UA_PATTERN, $ua) === 1) {
            return true;
        }

        $purpose_headers = [
            (string) $request->get_header('purpose'),
            (string) $request->get_header('sec_purpose'),
            (string) $request->get_header('x_purpose'),
            (string) $request->get_header('x_moz'),
        ];

        foreach ($purpose_headers as $value) {
            $raw = strtolower(trim($value));
            if ($raw === '') {
                continue;
            }
            if (strpos($raw, 'prefetch') !== false || strpos($raw, 'prerender') !== false || strpos($raw, 'preview') !== false) {
                return true;
            }
        }

        return false;
    }

    private static function resolve_client_ip(): string {
        $candidates = [];

        if (isset($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            $candidates[] = (string) $_SERVER['HTTP_CF_CONNECTING_IP'];
        }

        if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
            if (count($parts) > 0) {
                $candidates[] = (string) $parts[0];
            }
        }

        if (isset($_SERVER['REMOTE_ADDR'])) {
            $candidates[] = (string) $_SERVER['REMOTE_ADDR'];
        }

        foreach ($candidates as $candidate) {
            $ip = trim($candidate);
            if ($ip === '') {
                continue;
            }
            if (filter_var($ip, FILTER_VALIDATE_IP) !== false) {
                return $ip;
            }
        }

        return '';
    }

    private static function get_counter_store(): array {
        $raw = get_option(self::COUNTER_OPTION_KEY, []);
        return is_array($raw) ? $raw : [];
    }

    private static function get_counter_entry(string $key): array {
        $store = self::get_counter_store();
        if (!isset($store[$key]) || !is_array($store[$key])) {
            return [
                'total' => 0,
                'updatedAt' => gmdate('c'),
            ];
        }
        return [
            'total' => isset($store[$key]['total']) ? intval($store[$key]['total']) : 0,
            'updatedAt' => isset($store[$key]['updatedAt']) ? (string) $store[$key]['updatedAt'] : gmdate('c'),
        ];
    }

    private static function resolve_ticker_duration(string $value): ?float {
        $normalized = strtolower(trim($value));
        if ($normalized === 'slow') {
            return 12.0;
        }
        if ($normalized === 'normal' || $normalized === '') {
            return 6.0;
        }
        if ($normalized === 'fast') {
            return 3.0;
        }

        $num = floatval($normalized);
        if (!is_finite($num)) {
            return 6.0;
        }
        if ($num <= 0) {
            return null;
        }

        $half_trip = 1 / (2 * $num);
        if ($half_trip < 0.25) {
            $half_trip = 0.25;
        }
        if ($half_trip > 60) {
            $half_trip = 60;
        }
        return $half_trip;
    }

    public static function allow_extra_mimes(array $mimes): array {
        $mimes['svg'] = 'image/svg+xml';
        return $mimes;
    }

    public static function filter_sitemap_providers($provider, string $name) {
        // Exclude low-value duplicate URLs from indexing targets.
        if ($name === 'users' || $name === 'taxonomies') {
            return false;
        }
        return $provider;
    }

    public static function filter_sitemap_posts_query_args(array $args, string $post_type): array {
        if ($post_type !== 'page') {
            return $args;
        }

        $sample_page = get_page_by_path('sample-page', OBJECT, 'page');
        if (!$sample_page instanceof WP_Post) {
            return $args;
        }

        $blocked_ids = isset($args['post__not_in']) && is_array($args['post__not_in']) ? $args['post__not_in'] : [];
        $blocked_ids[] = intval($sample_page->ID);
        $args['post__not_in'] = array_values(array_unique(array_filter(array_map('intval', $blocked_ids))));

        return $args;
    }
}

HutaroBridge::init();
register_activation_hook(__FILE__, ['HutaroBridge', 'on_activation']);
register_deactivation_hook(__FILE__, ['HutaroBridge', 'on_deactivation']);

add_filter('query_vars', function (array $vars): array {
    $vars[] = 'hutaro_legacy_api';
    return $vars;
});
