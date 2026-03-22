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
