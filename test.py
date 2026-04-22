import threading
import tkinter as tk

import pyspiel

from Agent import OthelloAgent


BOARD_LENGTH = 8
PASS_ACTION = 64
CELL_SIZE = 64
BOARD_PADDING = 36
STONE_MARGIN = 6
DEFAULT_AI_TIME_LIMIT_SECONDS = 1.0
MIN_AI_TIME_LIMIT_SECONDS = 0.0001
AI_TIME_LIMIT_SPINBOX_MAX = 30.0
DEFAULT_AI_VS_AI_DELAY_MS = 500
MIN_AI_VS_AI_DELAY_MS = 0
AI_VS_AI_DELAY_SPINBOX_MAX = 5000
AI_STRATEGY_OPTIONS = [("UCT", "UCT"), ("EPSILON_GREEDY", "epsilon-greedy")]


class OthelloGui:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Othello vs AI")
        self.root.resizable(False, False)

        self.game = pyspiel.load_game("othello")
        self.human_player = 0
        self.ai_player = 1
        self.player_types = {0: "human", 1: "ai"}

        self.player_info_var = tk.StringVar()
        self.status_var = tk.StringVar()
        self.score_var = tk.StringVar()
        self.evaluation_var = tk.StringVar()
        self.debug_var = tk.StringVar()
        self.mode_var = tk.StringVar(value="human_black")
        self.black_ai_time_limit_var = tk.DoubleVar(value=DEFAULT_AI_TIME_LIMIT_SECONDS)
        self.white_ai_time_limit_var = tk.DoubleVar(value=DEFAULT_AI_TIME_LIMIT_SECONDS)
        self.black_ai_strategy_var = tk.StringVar(value="UCT")
        self.white_ai_strategy_var = tk.StringVar(value="UCT")
        self.ai_vs_ai_delay_var = tk.IntVar(value=DEFAULT_AI_VS_AI_DELAY_MS)
        self.current_game_ai_time_limits = {0: DEFAULT_AI_TIME_LIMIT_SECONDS, 1: DEFAULT_AI_TIME_LIMIT_SECONDS}
        self.current_game_ai_strategies = {0: "UCT", 1: "UCT"}
        self.current_game_ai_vs_ai_delay_ms = DEFAULT_AI_VS_AI_DELAY_MS
        self.settings_window = None
        self.settings_mode_buttons = []
        self.black_ai_time_limit_spinbox = None
        self.white_ai_time_limit_spinbox = None
        self.black_ai_strategy_menu = None
        self.white_ai_strategy_menu = None
        self.ai_vs_ai_delay_spinbox = None

        self.ai_thread = None
        self.ai_result = None
        self.ai_error = None
        self.ai_job_id = 0
        self.game_active = False
        self.review_mode = False

        self.last_action = None
        self.state = None
        self.ai_agents = {}
        self.history = []
        self.history_index = 0
        self.undo_button = None
        self.redo_button = None

        self._build_widgets()
        self._update_player_labels()
        self._prepare_initial_board()
        self.root.after(0, self.open_settings_dialog)

    def _build_widgets(self):
        main_frame = tk.Frame(self.root, padx=12, pady=12)
        main_frame.pack()

        top_frame = tk.Frame(main_frame)
        top_frame.pack(fill="x", pady=(0, 8))

        self.info_label = tk.Label(top_frame, textvariable=self.player_info_var)
        self.info_label.pack(anchor="w")

        self.score_label = tk.Label(top_frame, textvariable=self.score_var, font=("Helvetica", 11, "bold"))
        self.score_label.pack(anchor="w", pady=(4, 0))

        self.evaluation_label = tk.Label(top_frame, textvariable=self.evaluation_var)
        self.evaluation_label.pack(anchor="w", pady=(4, 0))

        self.status_label = tk.Label(
            top_frame,
            textvariable=self.status_var,
            width=42,
            anchor="w",
            justify="left",
        )
        self.status_label.pack(anchor="w", pady=(4, 8))

        control_frame = tk.Frame(top_frame)
        control_frame.pack(anchor="w")

        tk.Button(control_frame, text="新しい対局", command=self.open_settings_dialog).pack(side="left")
        self.undo_button = tk.Button(control_frame, text="Undo", command=self.undo_history, state="disabled")
        self.redo_button = tk.Button(control_frame, text="Redo", command=self.redo_history, state="disabled")

        canvas_size = BOARD_PADDING * 2 + CELL_SIZE * BOARD_LENGTH
        self.canvas = tk.Canvas(
            main_frame,
            width=canvas_size,
            height=canvas_size,
            bg="#1f6f43",
            highlightthickness=0,
        )
        self.canvas.pack()
        self.canvas.bind("<Button-1>", self.on_board_click)

    def _prepare_initial_board(self):
        self.state = self.game.new_initial_state()
        self.ai_agents = {}
        self.game_active = False
        self.review_mode = False
        self.status_var.set("設定ウィンドウで対局条件を選び、対局を始めてください。")
        self.last_action = None
        self.debug_var.set("探索反復数   -")
        self.history = []
        self.history_index = 0
        self._record_history_snapshot()
        self._hide_history_buttons()
        self._update_history_buttons_state()
        self.refresh()

    def open_settings_dialog(self):
        if self.settings_window is not None and self.settings_window.winfo_exists():
            self.settings_window.lift()
            self.settings_window.focus_force()
            return

        window = tk.Toplevel(self.root)
        self.settings_window = window
        window.title("対局設定")
        window.resizable(False, False)
        window.transient(self.root)
        window.grab_set()
        window.protocol("WM_DELETE_WINDOW", self._close_settings_dialog)

        try:
            window.attributes("-topmost", True)
            window.after(200, lambda: window.attributes("-topmost", False))
        except tk.TclError:
            pass

        frame = tk.Frame(window, padx=16, pady=16)
        frame.pack()

        tk.Label(frame, text="対局モード", font=("Helvetica", 11, "bold")).pack(anchor="w")

        mode_frame = tk.Frame(frame)
        mode_frame.pack(anchor="w", pady=(6, 12), fill="x")

        self.settings_mode_buttons = []
        for value, text in (
            ("human_black", "あなたが先手（黒）"),
            ("human_white", "あなたが後手（白）"),
            ("ai_vs_ai", "AI vs AI"),
        ):
            button = tk.Radiobutton(mode_frame, text=text, value=value, variable=self.mode_var)
            button.pack(anchor="w")
            self.settings_mode_buttons.append(button)

        ai_frame = tk.LabelFrame(frame, text="AI の思考時間", padx=12, pady=12)
        ai_frame.pack(fill="x")

        black_row = tk.Frame(ai_frame)
        black_row.pack(anchor="w", fill="x")
        tk.Label(black_row, text="黒AI").pack(side="left")
        self.black_ai_time_limit_spinbox = tk.Spinbox(
            black_row,
            from_=MIN_AI_TIME_LIMIT_SECONDS,
            to=AI_TIME_LIMIT_SPINBOX_MAX,
            increment=0.0001,
            width=8,
            format="%.4f",
            textvariable=self.black_ai_time_limit_var,
        )
        self.black_ai_time_limit_spinbox.pack(side="left", padx=(8, 4))
        tk.Label(black_row, text="秒").pack(side="left")

        white_row = tk.Frame(ai_frame)
        white_row.pack(anchor="w", fill="x", pady=(8, 0))
        tk.Label(white_row, text="白AI").pack(side="left")
        self.white_ai_time_limit_spinbox = tk.Spinbox(
            white_row,
            from_=MIN_AI_TIME_LIMIT_SECONDS,
            to=AI_TIME_LIMIT_SPINBOX_MAX,
            increment=0.0001,
            width=8,
            format="%.4f",
            textvariable=self.white_ai_time_limit_var,
        )
        self.white_ai_time_limit_spinbox.pack(side="left", padx=(8, 4))
        tk.Label(white_row, text="秒").pack(side="left")

        strategy_frame = tk.LabelFrame(frame, text="AI の探索方式", padx=12, pady=12)
        strategy_frame.pack(fill="x", pady=(12, 0))

        black_strategy_row = tk.Frame(strategy_frame)
        black_strategy_row.pack(anchor="w", fill="x")
        tk.Label(black_strategy_row, text="黒AI").pack(side="left")
        self.black_ai_strategy_menu = tk.OptionMenu(
            black_strategy_row,
            self.black_ai_strategy_var,
            *[label for _, label in AI_STRATEGY_OPTIONS],
        )
        self.black_ai_strategy_menu.pack(side="left", padx=(8, 0))

        white_strategy_row = tk.Frame(strategy_frame)
        white_strategy_row.pack(anchor="w", fill="x", pady=(8, 0))
        tk.Label(white_strategy_row, text="白AI").pack(side="left")
        self.white_ai_strategy_menu = tk.OptionMenu(
            white_strategy_row,
            self.white_ai_strategy_var,
            *[label for _, label in AI_STRATEGY_OPTIONS],
        )
        self.white_ai_strategy_menu.pack(side="left", padx=(8, 0))

        delay_frame = tk.LabelFrame(frame, text="AI vs AI の表示速度", padx=12, pady=12)
        delay_frame.pack(fill="x", pady=(12, 0))
        delay_row = tk.Frame(delay_frame)
        delay_row.pack(anchor="w")
        tk.Label(delay_row, text="1手ごとの待ち時間").pack(side="left")
        self.ai_vs_ai_delay_spinbox = tk.Spinbox(
            delay_row,
            from_=MIN_AI_VS_AI_DELAY_MS,
            to=AI_VS_AI_DELAY_SPINBOX_MAX,
            increment=100,
            width=8,
            textvariable=self.ai_vs_ai_delay_var,
        )
        self.ai_vs_ai_delay_spinbox.pack(side="left", padx=(8, 4))
        tk.Label(delay_row, text="ms").pack(side="left")
        tk.Label(
            delay_frame,
            text="AI 同士の対局が一瞬で終わらないよう、盤面更新の間に待ち時間を入れます。",
            justify="left",
        ).pack(anchor="w", pady=(8, 0))

        button_frame = tk.Frame(frame)
        button_frame.pack(fill="x", pady=(16, 0))
        tk.Button(button_frame, text="対局を始める", command=self._start_game_from_settings).pack(side="left")
        tk.Button(button_frame, text="閉じる", command=self._close_settings_dialog).pack(side="left", padx=(8, 0))

        window.update_idletasks()
        window.lift()
        window.focus_force()

    def _close_settings_dialog(self):
        if self.settings_window is None:
            return
        if self.settings_window.winfo_exists():
            self.settings_window.grab_release()
            self.settings_window.destroy()
        self.settings_window = None

    def _read_int_spinbox_value(self, variable, minimum, default):
        try:
            value = int(variable.get())
        except (tk.TclError, ValueError):
            value = default
        value = max(minimum, value)
        variable.set(value)
        return value

    def _read_float_spinbox_value(self, variable, minimum, default):
        try:
            value = float(variable.get())
        except (tk.TclError, ValueError):
            value = default
        value = max(minimum, value)
        variable.set(value)
        return value

    def _start_game_from_settings(self):
        mode = self.mode_var.get()
        black_time_limit = self._read_float_spinbox_value(
            self.black_ai_time_limit_var,
            MIN_AI_TIME_LIMIT_SECONDS,
            DEFAULT_AI_TIME_LIMIT_SECONDS,
        )
        white_time_limit = self._read_float_spinbox_value(
            self.white_ai_time_limit_var,
            MIN_AI_TIME_LIMIT_SECONDS,
            DEFAULT_AI_TIME_LIMIT_SECONDS,
        )
        ai_vs_ai_delay_ms = self._read_int_spinbox_value(
            self.ai_vs_ai_delay_var,
            MIN_AI_VS_AI_DELAY_MS,
            DEFAULT_AI_VS_AI_DELAY_MS,
        )
        black_strategy = self._strategy_code_from_label(self.black_ai_strategy_var.get())
        white_strategy = self._strategy_code_from_label(self.white_ai_strategy_var.get())

        self.ai_job_id += 1
        self.ai_thread = None
        self.ai_result = None
        self.ai_error = None
        self.last_action = None
        self.debug_var.set("探索反復数   -")
        self.current_game_ai_time_limits = {0: black_time_limit, 1: white_time_limit}
        self.current_game_ai_strategies = {0: black_strategy, 1: white_strategy}
        self.current_game_ai_vs_ai_delay_ms = ai_vs_ai_delay_ms
        self.game_active = True
        self.review_mode = False

        if mode == "human_black":
            self.player_types = {0: "human", 1: "ai"}
            self.human_player = 0
            self.ai_player = 1
        elif mode == "human_white":
            self.player_types = {0: "ai", 1: "human"}
            self.human_player = 1
            self.ai_player = 0
        else:
            self.player_types = {0: "ai", 1: "ai"}
            self.human_player = None
            self.ai_player = None

        self.state = self.game.new_initial_state()
        self.ai_agents = {
            player_id: OthelloAgent(self.state, strategy=self.current_game_ai_strategies[player_id])
            for player_id, player_type in self.player_types.items()
            if player_type == "ai"
        }
        self.history = []
        self.history_index = 0
        self._record_history_snapshot()
        self._update_player_labels()
        self._hide_history_buttons()
        self._update_history_buttons_state()
        self._close_settings_dialog()

        self.refresh()
        self.advance_game()

    def _update_player_labels(self):
        black_label = "あなた" if self.player_types[0] == "human" else self._ai_display_name(0)
        white_label = "あなた" if self.player_types[1] == "human" else self._ai_display_name(1)
        self.player_info_var.set(f"黒 (x): {black_label}    白 (o): {white_label}")

    def refresh(self):
        board = self._extract_board()
        black_count, white_count = self._count_stones(board)
        self.score_var.set(f"石数   黒: {black_count}    白: {white_count}")
        self._update_evaluation_display()
        self._draw_board(board)

    def _extract_board(self):
        lines = str(self.state).splitlines()
        board_lines = lines[2:2 + BOARD_LENGTH]
        board = []
        for line in board_lines:
            parts = line.split()
            board.append(parts[1:1 + BOARD_LENGTH])
        return board

    def _count_stones(self, board):
        black_count = sum(cell == "x" for row in board for cell in row)
        white_count = sum(cell == "o" for row in board for cell in row)
        return black_count, white_count

    def _draw_board(self, board):
        self.canvas.delete("all")

        board_end = BOARD_PADDING + CELL_SIZE * BOARD_LENGTH

        self.canvas.create_rectangle(
            BOARD_PADDING,
            BOARD_PADDING,
            board_end,
            board_end,
            fill="#2f8f53",
            outline="#133b22",
            width=3,
        )

        for index in range(BOARD_LENGTH + 1):
            coord = BOARD_PADDING + index * CELL_SIZE
            self.canvas.create_line(BOARD_PADDING, coord, board_end, coord, fill="#133b22", width=2)
            self.canvas.create_line(coord, BOARD_PADDING, coord, board_end, fill="#133b22", width=2)

        for index in range(BOARD_LENGTH):
            x = BOARD_PADDING + index * CELL_SIZE + CELL_SIZE / 2
            y = BOARD_PADDING + index * CELL_SIZE + CELL_SIZE / 2
            self.canvas.create_text(x, BOARD_PADDING / 2, text=chr(ord("a") + index), fill="white", font=("Helvetica", 12, "bold"))
            self.canvas.create_text(BOARD_PADDING / 2, y, text=str(index + 1), fill="white", font=("Helvetica", 12, "bold"))

        if self.last_action is not None and self.last_action != PASS_ACTION:
            row, col = divmod(self.last_action, BOARD_LENGTH)
            self._draw_last_move_marker(row, col)

        legal_actions = set(self.state.legal_actions())
        for row in range(BOARD_LENGTH):
            for col in range(BOARD_LENGTH):
                self._draw_cell(board[row][col], row, col)
                action = row * BOARD_LENGTH + col
                if (
                    self.game_active
                    and self._is_human_turn()
                    and action in legal_actions
                    and not self.state.is_terminal()
                    and self.ai_thread is None
                ):
                    self._draw_legal_hint(row, col)

    def _draw_last_move_marker(self, row, col):
        x0 = BOARD_PADDING + col * CELL_SIZE + 6
        y0 = BOARD_PADDING + row * CELL_SIZE + 6
        x1 = x0 + CELL_SIZE - 12
        y1 = y0 + CELL_SIZE - 12
        self.canvas.create_rectangle(x0, y0, x1, y1, outline="#ffd54f", width=3)

    def _draw_cell(self, cell, row, col):
        if cell not in {"x", "o"}:
            return

        x0 = BOARD_PADDING + col * CELL_SIZE + STONE_MARGIN
        y0 = BOARD_PADDING + row * CELL_SIZE + STONE_MARGIN
        x1 = x0 + CELL_SIZE - STONE_MARGIN * 2
        y1 = y0 + CELL_SIZE - STONE_MARGIN * 2

        if cell == "x":
            fill = "#111111"
            outline = "#2c2c2c"
        else:
            fill = "#f6f6f6"
            outline = "#d8d8d8"

        self.canvas.create_oval(x0, y0, x1, y1, fill=fill, outline=outline, width=2)

    def _draw_legal_hint(self, row, col):
        center_x = BOARD_PADDING + col * CELL_SIZE + CELL_SIZE / 2
        center_y = BOARD_PADDING + row * CELL_SIZE + CELL_SIZE / 2
        radius = 8
        self.canvas.create_oval(
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
            fill="#f5d142",
            outline="",
        )

    def on_board_click(self, event):
        if not self.game_active or self.state.is_terminal() or not self._is_human_turn() or self.ai_thread is not None:
            return

        row = (event.y - BOARD_PADDING) // CELL_SIZE
        col = (event.x - BOARD_PADDING) // CELL_SIZE
        if not (0 <= row < BOARD_LENGTH and 0 <= col < BOARD_LENGTH):
            return

        action = row * BOARD_LENGTH + col
        if action not in self.state.legal_actions():
            self.status_var.set("そこには打てません。黄色い印のあるマスを選んでください。")
            return

        self._apply_action(action, f"あなたは {row + 1}{chr(ord('a') + col)} に打ちました。")
        self.root.after(10, self.advance_game)

    def advance_game(self):
        if not self.game_active:
            return

        self.refresh()

        if self.state.is_terminal():
            self._show_result()
            return

        legal_actions = self.state.legal_actions()
        if legal_actions == [PASS_ACTION]:
            player_name = self._player_name(self.state.current_player())
            self._apply_action(PASS_ACTION, f"{player_name} は打てる場所がないためパスしました。")
            self.root.after(self._auto_advance_delay_ms(), self.advance_game)
            return

        if self._is_human_turn():
            self.status_var.set("あなたの番です。黄色い印のある場所をクリックしてください。")
            return

        self._start_ai_turn()

    def _start_ai_turn(self):
        if self.ai_thread is not None:
            return

        current_player = self.state.current_player()
        self.status_var.set(f"{self._player_name(current_player)} が考えています...")
        self.ai_result = None
        self.ai_error = None
        job_id = self.ai_job_id
        agent = self.ai_agents[current_player]
        time_limit = self.current_game_ai_time_limits[current_player]

        def worker():
            try:
                search_result = agent.get_search_result(dead_line=time_limit)
            except Exception as exc:
                if job_id == self.ai_job_id:
                    self.ai_error = exc
                    self.ai_result = None
                return

            if job_id == self.ai_job_id:
                self.ai_result = search_result

        self.ai_thread = threading.Thread(target=worker, daemon=True)
        self.ai_thread.start()
        self.root.after(100, self._poll_ai_result, job_id)

    def _poll_ai_result(self, job_id):
        if job_id != self.ai_job_id:
            return

        if self.ai_error is not None:
            error_message = f"AI の思考中にエラーが発生しました: {self.ai_error}"
            self.ai_thread = None
            self.status_var.set(error_message)
            return

        if self.ai_result is None:
            self.root.after(100, self._poll_ai_result, job_id)
            return

        search_result = self.ai_result
        self.ai_thread = None
        self.ai_result = None
        self.debug_var.set(f"探索反復数   {search_result.iterations}")
        self._update_evaluation_display()

        action = search_result.action

        if action is None:
            self.status_var.set("AI が着手を選べませんでした。")
            return

        if action == PASS_ACTION:
            self._apply_action(action, f"{self._player_name(self.state.current_player())} は打てる場所がないためパスしました。")
            self.root.after(self._auto_advance_delay_ms(), self.advance_game)
            return

        row, col = divmod(action, BOARD_LENGTH)
        self._apply_action(action, f"{self._player_name(self.state.current_player())} は {row + 1}{chr(ord('a') + col)} に打ちました。")
        self.root.after(self._auto_advance_delay_ms(), self.advance_game)

    def _apply_action(self, action, status_message):
        self.state.apply_action(action)
        for player_id, agent in list(self.ai_agents.items()):
            self.ai_agents[player_id] = agent.apply_action(action)
        self.last_action = None if action == PASS_ACTION else action
        self.status_var.set(status_message)
        self._record_history_snapshot()
        self.refresh()

    def _is_human_turn(self):
        return self.player_types.get(self.state.current_player()) == "human"

    def _is_ai_vs_ai_mode(self):
        return self.player_types[0] == "ai" and self.player_types[1] == "ai"

    def _auto_advance_delay_ms(self):
        if self._is_ai_vs_ai_mode():
            return self.current_game_ai_vs_ai_delay_ms
        return 250

    def _player_name(self, player_id):
        role = self.player_types.get(player_id, "ai")
        stone = "黒" if player_id == 0 else "白"
        if role == "human":
            return f"あなた（{stone}）"
        return f"{self._ai_display_name(player_id)}（{stone}）"

    def _ai_display_name(self, player_id):
        time_text = f"{self.current_game_ai_time_limits[player_id]:.4f}".rstrip("0").rstrip(".")
        strategy_text = self._strategy_label(self.current_game_ai_strategies[player_id])
        return f"伊抜きちゃんAI{time_text} {strategy_text}"

    def _strategy_code_from_label(self, label):
        for code, option_label in AI_STRATEGY_OPTIONS:
            if option_label == label:
                return code
        return "UCT"

    def _strategy_label(self, code):
        for option_code, label in AI_STRATEGY_OPTIONS:
            if option_code == code:
                return label
        return code

    def _update_evaluation_display(self):
        agent = self._get_display_agent()
        debug_text = self.debug_var.get()
        if agent is None:
            self.evaluation_var.set(f"先手評価値   -    {debug_text}")
            return

        evaluation = agent.get_evaluation(0)
        if evaluation < 0:
            self.evaluation_var.set(f"先手評価値   -    {debug_text}")
        else:
            self.evaluation_var.set(f"先手評価値   {evaluation:.3f}    {debug_text}")

    def _get_display_agent(self):
        if 0 in self.ai_agents:
            return self.ai_agents[0]
        if 1 in self.ai_agents:
            return self.ai_agents[1]
        return None

    def _record_history_snapshot(self):
        snapshot = {
            "state": self.state.clone(),
            "last_action": self.last_action,
            "status": self.status_var.get(),
        }
        if self.history_index < len(self.history) - 1:
            self.history = self.history[: self.history_index + 1]
        self.history.append(snapshot)
        self.history_index = len(self.history) - 1
        self._update_history_buttons_state()

    def _restore_history_snapshot(self, index):
        snapshot = self.history[index]
        self.state = snapshot["state"].clone()
        self.ai_agents = {
            player_id: OthelloAgent(self.state, strategy=self.current_game_ai_strategies[player_id])
            for player_id, player_type in self.player_types.items()
            if player_type == "ai"
        }
        self.last_action = snapshot["last_action"]
        self.status_var.set(snapshot["status"])
        self.history_index = index
        self.refresh()
        self._update_history_buttons_state()

    def _update_history_buttons_state(self):
        can_undo = self.history_index > 0 and self.ai_thread is None
        can_redo = self.history_index < len(self.history) - 1 and self.ai_thread is None
        if self.undo_button is not None:
            self.undo_button.configure(state="normal" if can_undo else "disabled")
        if self.redo_button is not None:
            self.redo_button.configure(state="normal" if can_redo else "disabled")

    def _show_history_buttons(self):
        if self.undo_button is not None and not self.undo_button.winfo_manager():
            self.undo_button.pack(side="left", padx=(8, 0))
        if self.redo_button is not None and not self.redo_button.winfo_manager():
            self.redo_button.pack(side="left", padx=(8, 0))

    def _hide_history_buttons(self):
        if self.undo_button is not None and self.undo_button.winfo_manager():
            self.undo_button.pack_forget()
        if self.redo_button is not None and self.redo_button.winfo_manager():
            self.redo_button.pack_forget()

    def undo_history(self):
        if self.ai_thread is not None or self.history_index == 0:
            return
        self.game_active = False
        self.review_mode = True
        self.ai_result = None
        self.ai_error = None
        self._restore_history_snapshot(self.history_index - 1)
        self.status_var.set(
            f"履歴閲覧中: {self.history_index} 手目の局面です。Undo / Redo で移動できます。"
        )
        self._update_history_buttons_state()

    def redo_history(self):
        if self.ai_thread is not None or self.history_index >= len(self.history) - 1:
            return
        self.game_active = False
        self.review_mode = True
        self.ai_result = None
        self.ai_error = None
        self._restore_history_snapshot(self.history_index + 1)
        self.status_var.set(
            f"履歴閲覧中: {self.history_index} 手目の局面です。Undo / Redo で移動できます。"
        )
        self._update_history_buttons_state()

    def _show_result(self):
        self.refresh()
        returns = self.state.returns()
        board = self._extract_board()
        black_count, white_count = self._count_stones(board)

        if self.human_player is None:
            if returns[0] > returns[1]:
                result_text = "黒AI の勝ちです。"
            elif returns[0] < returns[1]:
                result_text = "白AI の勝ちです。"
            else:
                result_text = "引き分けです。"
        else:
            if returns[self.human_player] > returns[self.ai_player]:
                result_text = "あなたの勝ちです。"
            elif returns[self.human_player] < returns[self.ai_player]:
                result_text = "AI の勝ちです。"
            else:
                result_text = "引き分けです。"

        self.game_active = False
        self.status_var.set(f"対局終了。{result_text} 最終結果: 黒 {black_count} - 白 {white_count}")
        self._show_history_buttons()
        self._update_history_buttons_state()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    try:
        OthelloGui().run()
    except tk.TclError as exc:
        print("GUI を起動できませんでした。表示可能なデスクトップ環境で実行してください。")
        print(f"詳細: {exc}")
