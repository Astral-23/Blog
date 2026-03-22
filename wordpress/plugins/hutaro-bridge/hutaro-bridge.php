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

    public static function init(): void {
        add_shortcode('hutaro_text', [self::class, 'render_text_shortcode']);
        add_shortcode('hutaro_ticker', [self::class, 'render_ticker_shortcode']);
        add_shortcode('hutaro_counter', [self::class, 'render_counter_shortcode']);
        add_shortcode('hutaro_latest_posts', [self::class, 'render_latest_posts_shortcode']);

        add_filter('the_content', [self::class, 'transform_md_embed_tags'], 5);
        add_filter('the_content', [self::class, 'harden_external_links'], 20);

        add_action('rest_api_init', [self::class, 'register_rest_routes']);
        add_action('wp_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('init', [self::class, 'register_legacy_rewrite_rules']);
        add_action('parse_request', [self::class, 'handle_legacy_api_request']);
        add_filter('upload_mimes', [self::class, 'allow_extra_mimes']);
    }

    public static function enqueue_assets(): void {
        $css = <<<'CSS'
.hutaro-embed-text { margin: 1rem 0; }
.hutaro-embed-text.align-left { text-align: left; }
.hutaro-embed-text.align-center { text-align: center; }
.hutaro-embed-text.align-right { text-align: right; }

.hutaro-embed-counter {
  display: inline-block;
  min-width: 7.8ch;
  padding: 0.06rem 0.34rem 0.08rem;
  background: #000;
  color: #fff;
  font-family: "MS PGothic", "Osaka", Menlo, Consolas, monospace;
  font-size: 0.92em;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.2;
}

.hutaro-embed-latest-posts { margin: 1.2rem 0; }
.hutaro-embed-latest-posts ul { margin: 0; padding: 0; }
.hutaro-embed-latest-posts li { margin: 0; }

.hutaro-image {
  margin: 1rem 0;
}
.hutaro-image img {
  display: block;
  max-width: 100%;
  height: auto;
}
.hutaro-image figcaption {
  margin-top: 0.5rem;
  font-size: 0.92rem;
  color: #666;
  text-align: center;
}
.hutaro-image[data-voices] {
  position: relative;
}
.hutaro-voice-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.hutaro-voice-burst {
  position: absolute;
  transform: translate(-50%, -50%);
  writing-mode: vertical-rl;
  text-orientation: upright;
  line-height: 1.05;
  font-size: clamp(1rem, 0.9rem + 1vw, 1.4rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #547443;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
  opacity: 0;
  animation: hutaro-voice-burst 3000ms ease forwards;
}

.hutaro-ticker {
  position: relative;
  margin: 1.2rem 0;
  overflow: hidden;
  white-space: nowrap;
}
.hutaro-ticker-track {
  display: inline-block;
  white-space: nowrap;
  min-width: max-content;
  animation: hutaro-ticker-bounce 6s linear infinite alternate;
}
.hutaro-ticker-static .hutaro-ticker-track {
  animation: none;
  min-width: 0;
}
.hutaro-ticker-static {
  text-align: center;
}
.hutaro-ticker-text {
  display: inline-block;
  font-size: clamp(1rem, 0.8rem + 1.3vw, 1.4rem);
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.1rem 0.3rem;
}
.hutaro-ticker-color-rainbow .hutaro-ticker-text {
  background: linear-gradient(90deg, #ff3b3b, #ff9f1a, #ffe66d, #2ec4b6, #4d96ff, #b07cff, #ff3b3b);
  background-size: 240% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: hutaro-rainbow 4s linear infinite;
}
.hutaro-ticker-color-white .hutaro-ticker-text { color: #fff; }
.hutaro-ticker-color-accent .hutaro-ticker-text { color: var(--wp--preset--color--accent, #0f766e); }

@keyframes hutaro-ticker-bounce {
  0% { transform: translateX(0); }
  100% { transform: translateX(calc(100vw - 100%)); }
}

@keyframes hutaro-rainbow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

@keyframes hutaro-voice-burst {
  0% {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 14px)) scale(0.96);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  70% {
    opacity: 1;
    transform: translate(-50%, calc(-50% - 4px)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, calc(-50% - 8px)) scale(1.02);
  }
}
CSS;

        $js = <<<'JS'
(function () {
  function resolveCountdown(text) {
    return text.replace(/\{\{countdown:(\d{1,2})-(\d{1,2})\}\}/g, function (_, m, d) {
      var month = parseInt(m, 10);
      var day = parseInt(d, 10);
      if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
        return '0';
      }

      var now = new Date();
      var today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      var year = now.getUTCFullYear();
      var target = new Date(Date.UTC(year, month - 1, day));
      if (target < today) {
        target = new Date(Date.UTC(year + 1, month - 1, day));
      }
      var diff = Math.floor((target - today) / (24 * 60 * 60 * 1000));
      return String(diff);
    });
  }

  function bootTicker(el) {
    var rawText = el.getAttribute('data-text') || '';
    var text = resolveCountdown(rawText);
    var textNode = el.querySelector('.hutaro-ticker-text');
    if (textNode) {
      textNode.textContent = text;
    }

    var duration = parseFloat(el.getAttribute('data-duration-sec') || '6');
    var track = el.querySelector('.hutaro-ticker-track');
    if (track && Number.isFinite(duration) && duration > 0) {
      track.style.animationDuration = duration + 's';
    }

    var color = (el.getAttribute('data-color') || '').trim();
    if (color && color.charAt(0) === '#') {
      el.style.setProperty('--hutaro-ticker-solid-color', color);
      if (textNode) {
        textNode.style.color = color;
      }
    }
  }

  function bootCounter(el) {
    var key = el.getAttribute('data-key') || 'home';
    var digits = parseInt(el.getAttribute('data-digits') || '7', 10);
    var endpoint = (window.wpApiSettings && window.wpApiSettings.root ? window.wpApiSettings.root : '/wp-json/') + 'hutaro/v1/counter';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key })
    })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('counter failed')); })
      .then(function (payload) {
        var total = Number(payload.total || 0);
        var padded = String(Math.max(0, Math.floor(total))).padStart(Math.max(1, digits), '0');
        el.textContent = padded.replace(/[0-9]/g, function (d) {
          return String.fromCharCode(d.charCodeAt(0) + 0xFEE0);
        });
      })
      .catch(function () {
        el.textContent = '----';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-hutaro-ticker="1"]').forEach(bootTicker);
    document.querySelectorAll('[data-hutaro-counter="1"]').forEach(bootCounter);

    document.querySelectorAll('figure.hutaro-image[data-voices]').forEach(function (figure) {
      var voicesRaw = figure.getAttribute('data-voices') || '';
      var voices = voicesRaw.split('|').map(function (v) { return v.trim(); }).filter(Boolean);
      if (!voices.length) {
        return;
      }

      var img = figure.querySelector('img');
      if (!img) {
        return;
      }

      var layer = document.createElement('span');
      layer.className = 'hutaro-voice-layer';
      figure.appendChild(layer);

      var index = 0;
      var spawn = function () {
        var burst = document.createElement('span');
        burst.className = 'hutaro-voice-burst';
        burst.textContent = voices[index % voices.length];
        index += 1;
        burst.style.top = (14 + Math.random() * 72) + '%';
        burst.style.left = (10 + Math.random() * 76) + '%';
        layer.appendChild(burst);
        window.setTimeout(function () {
          if (burst.parentNode) {
            burst.parentNode.removeChild(burst);
          }
        }, 3000);
      };

      img.style.cursor = 'pointer';
      img.addEventListener('click', spawn);
      img.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          spawn();
        }
      });
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'セリフ演出を再生');
    });
  });
})();
JS;

        wp_register_style('hutaro-bridge-inline-style', false);
        wp_enqueue_style('hutaro-bridge-inline-style');
        wp_add_inline_style('hutaro-bridge-inline-style', $css);

        wp_register_script('hutaro-bridge-inline-script', false, [], null, true);
        wp_enqueue_script('hutaro-bridge-inline-script');
        wp_add_inline_script('hutaro-bridge-inline-script', $js);
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

    public static function render_ticker_shortcode(array $atts): string {
        $attrs = shortcode_atts([
            'text' => '',
            'speed' => 'normal',
            'color' => 'rainbow',
        ], $atts, 'hutaro_ticker');

        $duration = self::resolve_ticker_duration($attrs['speed']);
        $is_static = $duration === null;

        $color = strtolower(trim((string) $attrs['color']));
        $color_class = in_array($color, ['rainbow', 'white', 'accent'], true) ? $color : 'rainbow';

        return sprintf(
            '<div class="hutaro-ticker hutaro-ticker-color-%s%s" data-hutaro-ticker="1" data-text="%s" data-duration-sec="%s" data-color="%s"><span class="hutaro-ticker-track"><span class="hutaro-ticker-text"></span></span></div>',
            esc_attr($color_class),
            $is_static ? ' hutaro-ticker-static' : '',
            esc_attr((string) $attrs['text']),
            esc_attr($duration === null ? '0' : (string) $duration),
            esc_attr((string) $attrs['color'])
        );
    }

    public static function render_counter_shortcode(array $atts): string {
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

    public static function render_latest_posts_shortcode(array $atts): string {
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

    public static function register_rest_routes(): void {
        register_rest_route('hutaro/v1', '/health', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => function () {
                return rest_ensure_response([
                    'status' => 'ok',
                    'service' => 'blog',
                    'timestamp' => gmdate('c'),
                ]);
            },
        ]);

        register_rest_route('hutaro/v1', '/counter', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'rest_counter_get'],
        ]);

        register_rest_route('hutaro/v1', '/counter', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'rest_counter_post'],
        ]);
    }

    public static function register_legacy_rewrite_rules(): void {
        // Next.js互換の公開URLをWordPressへマップ
        add_rewrite_rule('^blog/?$', 'index.php?category_name=blog', 'top');
        add_rewrite_rule('^blog-tech/?$', 'index.php?category_name=blog-tech', 'top');
        add_rewrite_rule('^blog/([^/]+)/?$', 'index.php?category_name=blog&name=$matches[1]', 'top');
        add_rewrite_rule('^blog-tech/([^/]+)/?$', 'index.php?category_name=blog-tech&name=$matches[1]', 'top');

        // 旧API互換
        add_rewrite_rule('^api/health/?$', 'index.php?hutaro_legacy_api=health', 'top');
        add_rewrite_rule('^api/access-counter/?$', 'index.php?hutaro_legacy_api=access-counter', 'top');
    }

    public static function handle_legacy_api_request(WP $wp): void {
        $api = isset($wp->query_vars['hutaro_legacy_api']) ? (string) $wp->query_vars['hutaro_legacy_api'] : '';
        if ($api === '') {
            return;
        }

        nocache_headers();
        header('Content-Type: application/json; charset=utf-8');

        if ($api === 'health') {
            status_header(200);
            echo wp_json_encode([
                'status' => 'ok',
                'service' => 'blog',
                'timestamp' => gmdate('c'),
            ]);
            exit;
        }

        if ($api === 'access-counter') {
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                $key = isset($_GET['key']) ? sanitize_text_field(wp_unslash((string) $_GET['key'])) : '';
                if (!self::is_valid_counter_key($key)) {
                    status_header(400);
                    echo wp_json_encode(['error' => 'invalid key']);
                    exit;
                }
                $entry = self::get_counter_entry($key);
                status_header(200);
                echo wp_json_encode([
                    'key' => $key,
                    'total' => intval($entry['total']),
                    'updatedAt' => (string) $entry['updatedAt'],
                ]);
                exit;
            }

            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $raw = file_get_contents('php://input');
                $decoded = json_decode(is_string($raw) ? $raw : '', true);
                $key = isset($decoded['key']) ? trim((string) $decoded['key']) : '';
                if (!self::is_valid_counter_key($key)) {
                    status_header(400);
                    echo wp_json_encode(['error' => 'invalid key']);
                    exit;
                }

                $store = self::get_counter_store();
                $entry = isset($store[$key]) && is_array($store[$key]) ? $store[$key] : [
                    'total' => 0,
                    'updatedAt' => gmdate('c'),
                ];
                $entry['total'] = intval($entry['total']) + 1;
                $entry['updatedAt'] = gmdate('c');
                $store[$key] = $entry;
                update_option(self::COUNTER_OPTION_KEY, $store, false);

                status_header(200);
                echo wp_json_encode([
                    'key' => $key,
                    'total' => intval($entry['total']),
                    'updatedAt' => (string) $entry['updatedAt'],
                ]);
                exit;
            }
        }

        status_header(404);
        echo wp_json_encode(['error' => 'not found']);
        exit;
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
        $key = isset($body['key']) ? trim((string) $body['key']) : '';
        if (!self::is_valid_counter_key($key)) {
            return new WP_REST_Response(['error' => 'invalid key'], 400);
        }

        $store = self::get_counter_store();
        $entry = isset($store[$key]) && is_array($store[$key]) ? $store[$key] : [
            'total' => 0,
            'updatedAt' => gmdate('c'),
        ];

        $entry['total'] = intval($entry['total']) + 1;
        $entry['updatedAt'] = gmdate('c');

        $store[$key] = $entry;
        update_option(self::COUNTER_OPTION_KEY, $store, false);

        return new WP_REST_Response([
            'key' => $key,
            'total' => intval($entry['total']),
            'updatedAt' => (string) $entry['updatedAt'],
        ], 200);
    }

    public static function transform_md_embed_tags(string $content): string {
        if (strpos($content, 'md-embed') === false) {
            return $content;
        }

        $open_close_pattern = '/<md-embed\s+([^>]+)>(.*?)<\/md-embed>/is';
        $self_pattern = '/<md-embed\s+([^>]+)\/>/is';

        $content = preg_replace_callback($open_close_pattern, function ($matches) {
            $attrs = self::parse_html_attrs($matches[1]);
            $body = trim((string) $matches[2]);
            return self::md_embed_to_shortcode($attrs, $body);
        }, $content);

        $content = preg_replace_callback($self_pattern, function ($matches) {
            $attrs = self::parse_html_attrs($matches[1]);
            return self::md_embed_to_shortcode($attrs, '');
        }, $content);

        return $content;
    }

    private static function md_embed_to_shortcode(array $attrs, string $body): string {
        $type = isset($attrs['type']) ? trim((string) $attrs['type']) : '';
        if ($type === '') {
            return '';
        }

        $allowed = ['count', 'source', 'text', 'size', 'position', 'speed', 'color', 'counterkey', 'digits'];
        $parts = [];
        foreach ($allowed as $key) {
            if (!isset($attrs[$key])) {
                continue;
            }
            $parts[] = sprintf('%s="%s"', $key, esc_attr((string) $attrs[$key]));
        }

        if ($body !== '' && !isset($attrs['text'])) {
            $parts[] = sprintf('text="%s"', esc_attr($body));
        }

        if ($type === 'latestPosts') {
            return '[hutaro_latest_posts ' . implode(' ', $parts) . ']';
        }
        if ($type === 'ticker') {
            return '[hutaro_ticker ' . implode(' ', $parts) . ']';
        }
        if ($type === 'counter') {
            return '[hutaro_counter ' . implode(' ', $parts) . ']';
        }
        if ($type === 'text' || $type === 'styledText') {
            return '[hutaro_text ' . implode(' ', $parts) . ']';
        }

        return '';
    }

    private static function parse_html_attrs(string $raw): array {
        $attrs = [];
        preg_match_all('/([a-zA-Z_:][a-zA-Z0-9_:\-]*)\s*=\s*"([^"]*)"/', $raw, $matches, PREG_SET_ORDER);
        foreach ($matches as $match) {
            $attrs[strtolower($match[1])] = $match[2];
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
}

HutaroBridge::init();

add_filter('query_vars', function (array $vars): array {
    $vars[] = 'hutaro_legacy_api';
    return $vars;
});
