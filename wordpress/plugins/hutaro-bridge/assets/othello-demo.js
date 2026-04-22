(function () {
  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (typeof text === "string") {
      el.textContent = text;
    }
    return el;
  }

  function apiBase() {
    var cfg = window.HUTARO_OTHELLO_CONFIG || {};
    var raw = String(cfg.apiBase || "/api/othello");
    return raw.replace(/\/+$/, "");
  }

  function isHumanTurn(snapshot) {
    return !!snapshot
      && !snapshot.is_terminal
      && !snapshot.match_finished
      && String(snapshot.player_types[String(snapshot.current_player)] || "") === "human";
  }

  function isAiTurn(snapshot) {
    return !!snapshot
      && !snapshot.is_terminal
      && !snapshot.match_finished
      && String(snapshot.player_types[String(snapshot.current_player)] || "") === "ai";
  }

  function cellLabel(index) {
    var row = Math.floor(index / 8);
    var col = index % 8;
    return String(row + 1) + String.fromCharCode("a".charCodeAt(0) + col);
  }

  function OthelloApp(root) {
    this.root = root;
    this.sessionId = "";
    this.snapshot = null;
    this.busy = false;
    this.autoTimer = 0;
    this.errorEl = null;
    this.boardEl = null;
    this.statusEl = null;
    this.turnEl = null;
    this.scoreEl = null;
    this.evalEl = null;
    this.iterEl = null;
    this.undoButton = null;
    this.redoButton = null;
    this.replayActionsEl = null;
    this.replayMetaEl = null;
    this.startButton = null;
    this.modeSelect = null;
    this.blackTimeField = null;
    this.whiteTimeField = null;
    this.blackStrategyField = null;
    this.whiteStrategyField = null;
    this.delayField = null;
    this.blackTimeInput = null;
    this.whiteTimeInput = null;
    this.blackStrategySelect = null;
    this.whiteStrategySelect = null;
    this.delayInput = null;
  }

  OthelloApp.prototype.mount = function () {
    this.root.innerHTML = "";
    this.root.classList.add("hutaro-othello-app");

    var shell = createEl("section", "hutaro-othello-shell");
    var boardWrap = createEl("section", "hutaro-othello-board-wrap");
    var panel = createEl("aside", "hutaro-othello-panel");
    this.boardEl = createEl("div", "hutaro-othello-board");
    this.boardEl.setAttribute("role", "grid");
    this.boardEl.setAttribute("aria-label", "オセロ盤");

    boardWrap.appendChild(this.boardEl);
    boardWrap.appendChild(this.buildBoardInfo());
    panel.appendChild(this.buildControls());
    shell.appendChild(boardWrap);
    shell.appendChild(panel);
    this.root.appendChild(shell);

    this.createSession();
  };

  OthelloApp.prototype.buildControls = function () {
    var wrapper = createEl("div");
    var controls = createEl("div", "hutaro-othello-controls");
    controls.appendChild(this.buildSettingsGroup());
    controls.appendChild(this.buildActionButtons());
    wrapper.appendChild(controls);
    return wrapper;
  };

  OthelloApp.prototype.buildBoardInfo = function () {
    var wrap = createEl("section", "hutaro-othello-board-info");

    this.statusEl = createEl("p", "hutaro-othello-status", "読み込み中...");
    this.statusEl.setAttribute("aria-live", "polite");
    wrap.appendChild(this.statusEl);

    var list = createEl("ul", "hutaro-othello-stat-list");
    this.turnEl = this.makeStat(list, "手番");
    this.scoreEl = this.makeStat(list, "石数");
    this.evalEl = this.makeStat(list, "先手評価値");
    this.iterEl = this.makeStat(list, "探索反復数");
    wrap.appendChild(list);

    this.replayActionsEl = createEl("div", "hutaro-othello-actions is-hidden");

    this.undoButton = createEl("button", "hutaro-othello-button", "ひとつ前");
    this.undoButton.type = "button";
    this.undoButton.addEventListener("click", this.undo.bind(this));
    this.replayActionsEl.appendChild(this.undoButton);

    this.redoButton = createEl("button", "hutaro-othello-button", "ひとつ後");
    this.redoButton.type = "button";
    this.redoButton.addEventListener("click", this.redo.bind(this));
    this.replayActionsEl.appendChild(this.redoButton);

    this.replayMetaEl = createEl("p", "hutaro-othello-replay-meta is-hidden", "");
    wrap.appendChild(this.replayActionsEl);
    wrap.appendChild(this.replayMetaEl);

    this.errorEl = createEl("p", "hutaro-othello-error");
    wrap.appendChild(this.errorEl);
    return wrap;
  };

  OthelloApp.prototype.buildSettingsGroup = function () {
    var group = createEl("section", "hutaro-othello-group");
    group.appendChild(createEl("h3", "", "対局設定"));

    this.modeSelect = this.createSelect("mode", [
      ["human_black", "あなたが先手（黒）"],
      ["human_white", "あなたが後手（白）"],
      ["ai_vs_ai", "AI vs AI"]
    ]);
    this.modeSelect.addEventListener("change", this.syncSettingVisibility.bind(this));
    group.appendChild(this.wrapLabeled("対局モード", this.modeSelect));

    this.blackTimeInput = this.createInput("number", "1.0");
    this.blackTimeInput.min = "0.0001";
    this.blackTimeInput.max = "30";
    this.blackTimeInput.step = "0.1";
    this.blackTimeField = this.wrapLabeled("黒AI 思考時間（秒）", this.blackTimeInput);
    group.appendChild(this.blackTimeField);

    this.whiteTimeInput = this.createInput("number", "1.0");
    this.whiteTimeInput.min = "0.0001";
    this.whiteTimeInput.max = "30";
    this.whiteTimeInput.step = "0.1";
    this.whiteTimeField = this.wrapLabeled("白AI 思考時間（秒）", this.whiteTimeInput);
    group.appendChild(this.whiteTimeField);

    this.blackStrategySelect = this.createSelect("black-strategy", [
      ["UCT", "UCT"],
      ["EPSILON_GREEDY", "epsilon-greedy"]
    ]);
    this.blackStrategyField = this.wrapLabeled("黒AI 探索方式", this.blackStrategySelect);
    group.appendChild(this.blackStrategyField);

    this.whiteStrategySelect = this.createSelect("white-strategy", [
      ["UCT", "UCT"],
      ["EPSILON_GREEDY", "epsilon-greedy"]
    ]);
    this.whiteStrategyField = this.wrapLabeled("白AI 探索方式", this.whiteStrategySelect);
    group.appendChild(this.whiteStrategyField);

    this.delayInput = this.createInput("number", "500");
    this.delayInput.min = "0";
    this.delayInput.max = "5000";
    this.delayInput.step = "100";
    this.delayField = this.wrapLabeled("AI vs AI 表示待ち時間（ms）", this.delayInput);
    group.appendChild(this.delayField);
    this.syncSettingVisibility();
    return group;
  };

  OthelloApp.prototype.buildActionButtons = function () {
    var wrap = createEl("section", "hutaro-othello-group");
    wrap.appendChild(createEl("h3", "", "操作"));
    var actions = createEl("div", "hutaro-othello-actions");

    this.startButton = createEl("button", "hutaro-othello-button is-primary", "新しい対局");
    this.startButton.type = "button";
    this.startButton.addEventListener("click", this.createSession.bind(this));
    actions.appendChild(this.startButton);

    wrap.appendChild(actions);
    return wrap;
  };

  OthelloApp.prototype.makeStat = function (list, label) {
    var item = createEl("li");
    item.appendChild(createEl("span", "hutaro-othello-stat-label", label));
    var value = createEl("strong", "", "-");
    item.appendChild(value);
    list.appendChild(item);
    return value;
  };

  OthelloApp.prototype.wrapLabeled = function (label, field) {
    var wrap = createEl("label", "hutaro-othello-group");
    wrap.appendChild(createEl("span", "hutaro-othello-label", label));
    wrap.appendChild(field);
    return wrap;
  };

  OthelloApp.prototype.createSelect = function (name, options) {
    var select = document.createElement("select");
    select.name = name;
    options.forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry[0];
      option.textContent = entry[1];
      select.appendChild(option);
    });
    return select;
  };

  OthelloApp.prototype.createInput = function (type, value) {
    var input = document.createElement("input");
    input.type = type;
    input.value = value;
    return input;
  };

  OthelloApp.prototype.syncSettingVisibility = function () {
    var mode = this.modeSelect ? this.modeSelect.value : "human_black";
    var showBlackAi = mode !== "human_black";
    var showWhiteAi = mode !== "human_white";
    var showDelay = mode === "ai_vs_ai";

    this.setFieldVisibility(this.blackTimeField, showBlackAi);
    this.setFieldVisibility(this.blackStrategyField, showBlackAi);
    this.setFieldVisibility(this.whiteTimeField, showWhiteAi);
    this.setFieldVisibility(this.whiteStrategyField, showWhiteAi);
    this.setFieldVisibility(this.delayField, showDelay);
  };

  OthelloApp.prototype.setFieldVisibility = function (field, visible) {
    if (!field) {
      return;
    }
    field.classList.toggle("is-hidden", !visible);
  };

  OthelloApp.prototype.request = function (path, options) {
    var init = Object.assign({
      headers: { "Content-Type": "application/json" }
    }, options || {});
    return fetch(apiBase() + path, init).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!res.ok) {
          var detail = payload && payload.detail ? String(payload.detail) : "Request failed";
          throw new Error(detail);
        }
        return payload;
      });
    });
  };

  OthelloApp.prototype.createSession = function () {
    this.clearError();
    this.setBusy(true);
    window.clearTimeout(this.autoTimer);
    var payload = {
      mode: this.modeSelect.value,
      black_ai_time_limit_seconds: Number(this.blackTimeInput.value || 1),
      white_ai_time_limit_seconds: Number(this.whiteTimeInput.value || 1),
      black_ai_strategy: this.blackStrategySelect.value,
      white_ai_strategy: this.whiteStrategySelect.value,
      ai_vs_ai_delay_ms: Number(this.delayInput.value || 500)
    };
    this.request("/session", {
      method: "POST",
      body: JSON.stringify(payload)
    }).then(function (data) {
      this.sessionId = String(data.session_id || "");
      this.applySnapshot(data.snapshot);
    }.bind(this)).catch(this.showError.bind(this)).finally(function () {
      this.setBusy(false);
      this.renderBoard();
      this.updateButtons();
      this.maybeRunAi();
    }.bind(this));
  };

  OthelloApp.prototype.applySnapshot = function (snapshot) {
    this.snapshot = snapshot || null;
    this.renderBoard();
    this.renderStats();
    this.updateButtons();
    this.maybeRunAi();
  };

  OthelloApp.prototype.renderBoard = function () {
    var snapshot = this.snapshot;
    this.boardEl.innerHTML = "";
    if (!snapshot || !Array.isArray(snapshot.board)) {
      return;
    }
    var legal = new Set((snapshot.legal_actions || []).map(String));
    for (var index = 0; index < snapshot.board.length; index += 1) {
      var cell = createEl("button", "hutaro-othello-cell");
      cell.type = "button";
      cell.disabled = true;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("data-cell-label", cellLabel(index));
      if (isHumanTurn(snapshot) && legal.has(String(index)) && !this.busy) {
        cell.classList.add("is-clickable");
        cell.disabled = false;
        cell.addEventListener("click", this.playHumanMove.bind(this, index));
        cell.setAttribute("aria-label", cellLabel(index) + " に打つ");
        cell.appendChild(createEl("span", "hutaro-othello-legal-dot"));
      }
      if (snapshot.board[index] === "x" || snapshot.board[index] === "o") {
        var stone = createEl("span", "hutaro-othello-stone " + (snapshot.board[index] === "x" ? "is-black" : "is-white"));
        cell.appendChild(stone);
      }
      this.boardEl.appendChild(cell);
    }
  };

  OthelloApp.prototype.renderStats = function () {
    var snapshot = this.snapshot;
    if (!snapshot) {
      return;
    }
    this.statusEl.textContent = this.statusText(snapshot);
    this.turnEl.textContent = this.turnText(snapshot);
    this.scoreEl.textContent = "黒 " + snapshot.black_count + " / 白 " + snapshot.white_count;
    this.evalEl.textContent = snapshot.evaluation == null ? "-" : Number(snapshot.evaluation).toFixed(3);
    this.iterEl.textContent = snapshot.iterations == null ? "-" : String(snapshot.iterations);
  };

  OthelloApp.prototype.statusText = function (snapshot) {
    var text = String((snapshot && snapshot.status_message) || "");
    if (snapshot && snapshot.match_finished && !snapshot.is_terminal) {
      return text || "終局後の履歴を表示しています。";
    }
    return text;
  };

  OthelloApp.prototype.turnText = function (snapshot) {
    if (!snapshot) {
      return "-";
    }
    if (snapshot.match_finished && !snapshot.is_terminal) {
      return "履歴閲覧";
    }
    if (snapshot.is_terminal) {
      return "終局";
    }
    var player = Number(snapshot.current_player);
    var role = String(snapshot.player_types[String(player)] || "");
    var stone = player === 0 ? "黒" : "白";
    if (role === "human") {
      return "あなた（" + stone + "）";
    }
    return "AI（" + stone + "）";
  };

  OthelloApp.prototype.updateButtons = function () {
    var snapshot = this.snapshot;
    var disable = this.busy || !snapshot;
    var showReplay = !!(snapshot && snapshot.match_finished);
    if (this.replayActionsEl) {
      this.replayActionsEl.classList.toggle("is-hidden", !showReplay);
    }
    if (this.replayMetaEl) {
      this.replayMetaEl.classList.toggle("is-hidden", !showReplay);
      this.replayMetaEl.textContent = showReplay
        ? "履歴 " + String((snapshot.history_index || 0) + 1) + " / " + String(snapshot.history_length || 0)
        : "";
    }
    this.undoButton.disabled = disable || !snapshot.can_undo;
    this.redoButton.disabled = disable || !snapshot.can_redo;
    this.startButton.disabled = this.busy;
  };

  OthelloApp.prototype.playHumanMove = function (action) {
    if (!this.sessionId || this.busy) {
      return;
    }
    this.clearError();
    this.setBusy(true);
    this.request("/session/" + encodeURIComponent(this.sessionId) + "/human-move", {
      method: "POST",
      body: JSON.stringify({ action: action })
    }).then(function (data) {
      this.applySnapshot(data.snapshot);
    }.bind(this)).catch(this.showError.bind(this)).finally(function () {
      this.setBusy(false);
      this.renderBoard();
      this.updateButtons();
    }.bind(this));
  };

  OthelloApp.prototype.runAiMove = function () {
    if (!this.sessionId || this.busy || !isAiTurn(this.snapshot)) {
      return;
    }
    this.clearError();
    this.setBusy(true);
    this.request("/session/" + encodeURIComponent(this.sessionId) + "/ai-move", {
      method: "POST",
      body: JSON.stringify({})
    }).then(function (data) {
      this.applySnapshot(data.snapshot);
    }.bind(this)).catch(this.showError.bind(this)).finally(function () {
      this.setBusy(false);
      this.renderBoard();
      this.updateButtons();
    }.bind(this));
  };

  OthelloApp.prototype.maybeRunAi = function () {
    var snapshot = this.snapshot;
    window.clearTimeout(this.autoTimer);
    if (!snapshot || !isAiTurn(snapshot)) {
      return;
    }
    var delay = snapshot.mode === "ai_vs_ai" ? Number(this.delayInput.value || 500) : 180;
    this.autoTimer = window.setTimeout(this.runAiMove.bind(this), Math.max(0, delay));
  };

  OthelloApp.prototype.undo = function () {
    this.simplePost("/session/" + encodeURIComponent(this.sessionId) + "/undo");
  };

  OthelloApp.prototype.redo = function () {
    this.simplePost("/session/" + encodeURIComponent(this.sessionId) + "/redo");
  };

  OthelloApp.prototype.simplePost = function (path) {
    if (!this.sessionId || this.busy) {
      return;
    }
    this.clearError();
    this.setBusy(true);
    this.request(path, {
      method: "POST",
      body: JSON.stringify({})
    }).then(function (data) {
      this.applySnapshot(data.snapshot);
    }.bind(this)).catch(this.showError.bind(this)).finally(function () {
      this.setBusy(false);
      this.renderBoard();
      this.updateButtons();
    }.bind(this));
  };

  OthelloApp.prototype.setBusy = function (busy) {
    this.busy = !!busy;
    this.updateButtons();
  };

  OthelloApp.prototype.showError = function (error) {
    this.errorEl.textContent = error instanceof Error ? error.message : String(error || "Unknown error");
  };

  OthelloApp.prototype.clearError = function () {
    this.errorEl.textContent = "";
  };

  function boot() {
    document.querySelectorAll("[data-hutaro-othello-app='1']").forEach(function (root) {
      var app = new OthelloApp(root);
      app.mount();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
