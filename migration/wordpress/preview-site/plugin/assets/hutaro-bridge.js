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
    if (track) {
      var applyTickerShift = function () {
        var containerWidth = el.clientWidth || 0;
        var trackWidth = track.scrollWidth || 0;
        var shift = containerWidth > trackWidth ? (containerWidth - trackWidth) / 2 : 0;
        track.style.setProperty('--hutaro-ticker-shift', shift.toFixed(2) + 'px');
      };
      applyTickerShift();
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', applyTickerShift, { passive: true });
      }
    }

    var color = (el.getAttribute('data-color') || '').trim();
    if (color && color.charAt(0) === '#') {
      el.style.setProperty('--hutaro-ticker-solid-color', color);
      if (textNode) {
        textNode.style.color = color;
      }
    }
  }

  function toFullWidthDigits(text) {
    return text.replace(/[0-9]/g, function (d) {
      return String.fromCharCode(d.charCodeAt(0) + 0xFEE0);
    });
  }

  function renderCounterValue(el, total) {
    var digits = parseInt(el.getAttribute('data-digits') || '7', 10);
    if (!Number.isFinite(digits) || digits < 1) {
      digits = 7;
    }
    var padded = String(Math.max(0, Math.floor(total))).padStart(digits, '0');
    el.textContent = toFullWidthDigits(padded);
  }

  function renderCounterError(el) {
    el.textContent = '----';
  }

  function bootCounters() {
    var endpoint = (window.wpApiSettings && window.wpApiSettings.root ? window.wpApiSettings.root : '/wp-json/') + 'hutaro/v1/counter';
    var countersByKey = {};

    document.querySelectorAll('[data-hutaro-counter="1"]').forEach(function (el) {
      var rawKey = (el.getAttribute('data-key') || 'home').trim();
      var key = rawKey || 'home';
      if (!countersByKey[key]) {
        countersByKey[key] = [];
      }
      countersByKey[key].push(el);
    });

    Object.keys(countersByKey).forEach(function (key) {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key })
      })
        .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('counter failed')); })
        .then(function (payload) {
          var total = Number(payload.total || 0);
          countersByKey[key].forEach(function (el) {
            renderCounterValue(el, total);
          });
        })
        .catch(function () {
          countersByKey[key].forEach(function (el) {
            renderCounterError(el);
          });
        });
    });
  }

  function createAchievementSystem() {
    var popupTotalMs = 10000;
    var popupFadeMs = 2000;
    var jitterPattern = [17, 233, 91, 149, 41, 277, 63, 121, 205, 11, 259, 87, 173, 37, 241, 109];
    var queue = [];
    var showing = false;
    var layer = null;
    var state = {
      pageViews: 0,
      jokeToggleCount: 0,
      voiceBurstCount: 0,
      channelRegisterClicksByPath: {}
    };
    var unlocked = {};

    var definitions = [
      {
        id: 'osawari-fuko',
        title: '伊吹風子にお触りする',
        comment: '俺の風子に触るんじゃねぇ！',
        triggerOn: ['voice:burst'],
        when: function (_, payload) {
          var path = String(payload && payload.path ? payload.path : '');
          var src = String(payload && payload.src ? payload.src : '');
          return path === '/' && src.indexOf('fuko_top_home.jpg') !== -1;
        }
      },
      {
        id: 'even-register',
        title: '偶数回チャンネル登録する',
        comment: '感動したのでチャンネル登録2回押しました！',
        triggerOn: ['joke:toggle'],
        when: function (currentState, payload) {
          if (!payload || String(payload.label || '') !== 'チャンネル登録') {
            return false;
          }
          var path = String(payload.path || '/');
          return Number(currentState.channelRegisterClicksByPath[path] || 0) >= 2;
        }
      },
      {
        id: 'ten-register',
        title: '10回チャンネル登録する',
        comment: 'チャンネル登録10回記念です！',
        triggerOn: ['joke:toggle'],
        when: function (currentState, payload) {
          if (!payload || String(payload.label || '') !== 'チャンネル登録') {
            return false;
          }
          var path = String(payload.path || '/');
          return Number(currentState.channelRegisterClicksByPath[path] || 0) >= 10;
        }
      },
      {
        id: 'hundred-register',
        title: '100回チャンネル登録する',
        comment: 'こんなボタンにマジになってどうするの',
        triggerOn: ['joke:toggle'],
        when: function (currentState, payload) {
          if (!payload || String(payload.label || '') !== 'チャンネル登録') {
            return false;
          }
          var path = String(payload.path || '/');
          return Number(currentState.channelRegisterClicksByPath[path] || 0) >= 100;
        }
      }
    ];

    function appendStaggeredText(el, text, maxDelayMs) {
      var chars = Array.from(String(text || ''));
      var maxDelay = Math.max(1, Math.floor(Number(maxDelayMs) || 1));
      chars.forEach(function (ch, idx) {
        var span = document.createElement('span');
        span.className = 'hutaro-achievement-char';
        var seededDelay = jitterPattern[idx % jitterPattern.length] % maxDelay;
        span.style.setProperty('--hutaro-char-delay-ms', String(seededDelay));
        span.style.setProperty('--hutaro-char-idx', String(idx));
        span.textContent = ch === ' ' ? '\u00a0' : ch;
        el.appendChild(span);
      });
    }

    function ensureLayer() {
      if (layer && layer.parentNode) {
        return layer;
      }
      layer = document.createElement('section');
      layer.className = 'hutaro-achievement-layer';
      layer.setAttribute('aria-live', 'polite');
      layer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(layer);
      return layer;
    }

    function showPopup(achievement, onDone) {
      var host = ensureLayer();
      var popup = document.createElement('section');
      popup.className = 'hutaro-achievement-popup';
      popup.setAttribute('role', 'status');
      popup.setAttribute('aria-label', '隠し実績');

      var title = document.createElement('p');
      title.className = 'hutaro-achievement-title';
      appendStaggeredText(title, '~~~ 隠し実績: ' + achievement.title + ' を達成した ! ~~~', 280);

      var comment = document.createElement('p');
      comment.className = 'hutaro-achievement-comment';
      appendStaggeredText(comment, String(achievement.comment || ''), 320);

      popup.appendChild(title);
      popup.appendChild(comment);
      host.appendChild(popup);

      window.requestAnimationFrame(function () {
        popup.classList.add('is-visible');
      });

      var closed = false;
      var close = function () {
        if (closed) {
          return;
        }
        closed = true;
        popup.classList.remove('is-visible');
        popup.classList.add('is-leaving');
        window.setTimeout(function () {
          if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
          }
          onDone();
        }, popupFadeMs);
      };

      window.setTimeout(close, Math.max(0, popupTotalMs - popupFadeMs));
      popup.addEventListener('click', close);
    }

    function flushQueue() {
      if (showing || queue.length === 0) {
        return;
      }
      showing = true;
      var next = queue.shift();
      showPopup(next, function () {
        showing = false;
        flushQueue();
      });
    }

    function unlock(achievement) {
      unlocked[achievement.id] = true;
      queue.push(achievement);
      flushQueue();
    }

    function updateState(eventName, payload) {
      if (eventName === 'page:view') {
        state.pageViews += 1;
      } else if (eventName === 'joke:toggle') {
        state.jokeToggleCount += 1;
        if (payload && String(payload.label || '') === 'チャンネル登録') {
          var path = String(payload.path || '/');
          var current = Number(state.channelRegisterClicksByPath[path] || 0);
          state.channelRegisterClicksByPath[path] = current + 1;
        }
      } else if (eventName === 'voice:burst') {
        state.voiceBurstCount += 1;
      }
    }

    function evaluate(eventName, payload) {
      definitions.forEach(function (achievement) {
        if (unlocked[achievement.id]) {
          return;
        }
        if (achievement.triggerOn.indexOf(eventName) === -1) {
          return;
        }
        var ok = false;
        try {
          ok = Boolean(achievement.when(state, payload || {}, eventName));
        } catch (_) {
          ok = false;
        }
        if (ok) {
          unlock(achievement);
        }
      });
    }

    return {
      track: function (eventName, payload) {
        if (!eventName) {
          return;
        }
        var safePayload = payload || {};
        updateState(String(eventName), safePayload);
        evaluate(String(eventName), safePayload);
      }
    };
  }

  function bootJokeButtons(achievements) {
    function animateJokeButton(button, event) {
      var rect = button.getBoundingClientRect();
      var x = event && Number.isFinite(event.clientX) ? event.clientX - rect.left : rect.width / 2;
      var y = event && Number.isFinite(event.clientY) ? event.clientY - rect.top : rect.height / 2;
      button.style.setProperty('--hutaro-ripple-x', x + 'px');
      button.style.setProperty('--hutaro-ripple-y', y + 'px');

      button.classList.remove('hutaro-joke-pop', 'hutaro-joke-ripple', 'hutaro-joke-shine', 'hutaro-joke-glow');
      void button.offsetWidth;
      button.classList.add('hutaro-joke-pop', 'hutaro-joke-ripple', 'hutaro-joke-shine', 'hutaro-joke-glow');

      window.setTimeout(function () {
        button.classList.remove('hutaro-joke-pop', 'hutaro-joke-ripple', 'hutaro-joke-shine', 'hutaro-joke-glow');
      }, 520);
    }

    function spawnJokeParticles(button) {
      var colors = ['#64b171', '#88c792', '#4e9f61', '#b9dfc1', '#7fcf95'];
      var stars = ['★', '☆', '✦', '✧'];
      for (var i = 0; i < 16; i += 1) {
        var particle = document.createElement('span');
        particle.className = 'hutaro-joke-particle';
        particle.textContent = stars[Math.floor(Math.random() * stars.length)];
        var angle = (Math.PI * 2 * i) / 16 + (Math.random() * 0.35 - 0.175);
        var radius = 24 + Math.random() * 26;
        particle.style.setProperty('--hutaro-particle-x', (Math.cos(angle) * radius).toFixed(2) + 'px');
        particle.style.setProperty('--hutaro-particle-y', (Math.sin(angle) * radius).toFixed(2) + 'px');
        particle.style.setProperty('--hutaro-particle-size', (10 + Math.random() * 8).toFixed(2) + 'px');
        particle.style.setProperty('--hutaro-particle-rotate', (Math.random() * 120 - 60).toFixed(2) + 'deg');
        particle.style.setProperty('--hutaro-particle-color', colors[i % colors.length]);
        button.appendChild(particle);
        window.setTimeout(function (node) {
          if (node && node.parentNode) {
            node.parentNode.removeChild(node);
          }
        }, 650, particle);
      }
    }

    document.querySelectorAll('[data-hutaro-joke-buttons="1"]').forEach(function (group) {
      var persistMode = String(group.getAttribute('data-persist') || 'none').trim().toLowerCase();
      var key = 'hutaro:joke-buttons:' + (window.location.pathname || '/');
      var persisted = {};

      if (persistMode === 'local') {
        try {
          var raw = window.localStorage.getItem(key) || '{}';
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            persisted = parsed;
          }
        } catch (_) {
          persisted = {};
        }
      }

      group.querySelectorAll('[data-hutaro-joke-button]').forEach(function (button) {
        var label = String(button.getAttribute('data-hutaro-joke-button') || '').trim();
        if (!label) {
          return;
        }

        var isPressed = Boolean(persisted[label]);
        button.setAttribute('aria-pressed', isPressed ? 'true' : 'false');

        button.addEventListener('click', function (event) {
          var current = button.getAttribute('aria-pressed') === 'true';
          var next = !current;
          button.setAttribute('aria-pressed', next ? 'true' : 'false');
          animateJokeButton(button, event);
          spawnJokeParticles(button);
          var allPressed = true;
          group.querySelectorAll('[data-hutaro-joke-button]').forEach(function (node) {
            if (node.getAttribute('aria-pressed') !== 'true') {
              allPressed = false;
            }
          });
          if (achievements) {
            achievements.track('joke:toggle', {
              allPressed: allPressed,
              label: label,
              path: window.location.pathname || '/'
            });
          }

          if (persistMode !== 'local') {
            return;
          }

          persisted[label] = next;
          try {
            window.localStorage.setItem(key, JSON.stringify(persisted));
          } catch (_) {
            // Ignore storage errors (private browsing, quota, disabled storage).
          }
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var achievements = createAchievementSystem();
    achievements.track('page:view', { path: window.location.pathname || '/' });

    document.querySelectorAll('[data-hutaro-ticker="1"]').forEach(bootTicker);
    bootCounters();
    bootJokeButtons(achievements);

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
        achievements.track('voice:burst', {
          path: window.location.pathname || '/',
          src: img.getAttribute('src') || ''
        });
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
