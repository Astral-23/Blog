from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass

CELL_WEIGHT = [
    2714,  147,   69,  -18,  -18,   69,  147, 2714,
     147, -577, -186, -153, -153, -186, -577,  147,
      69, -186, -379, -122, -122, -379, -186,   69,
     -18, -153, -122, -169, -169, -122, -153,  -18,
     -18, -153, -122, -169, -169, -122, -153,  -18,
      69, -186, -379, -122, -122, -379, -186,   69,
    147, -577, -186, -153, -153, -186, -577,  147,
    2714,  147,   69,  -18,  -18,   69,  147, 2714]

BOARD_SIZE = 64


@dataclass
class SearchResult:
    action: int | None
    iterations: int
    elapsed_seconds: float

    
class MTTreeNode:
    """
    2人プレイゲーム用のMonte Carlo Treeの実装
    """
    def __init__(self, state, parent=None, strategy="UCT"):
        self.state = state.clone()
        self.parent = parent
        self.strategy = strategy
        self.parent_player = parent.state.current_player() if parent is not None else None
        self.children = {}  
        self.untried_actions = list(state.legal_actions())
        self.visit_count = 0
        self.value_sum = 0.0
        
        
    def is_terminal(self):
        return self.state.is_terminal()
    
    def is_fully_expanded(self):
        return len(self.untried_actions) == 0

    def choose_child(self):
        if self.strategy == "UCT":
            return self.uct_choose_child()
        elif self.strategy == "EPSILON_GREEDY":
            return self.epsilon_greedy_choose_child()

    def epsilon_greedy_choose_child(self, epsilon = 0.1):
        if random.random() < epsilon:
            return random.choice(list(self.children.values()))
        best_score = -float('inf')
        best_children = []
        for child in self.children.values():
            avg_value = child.value_sum / child.visit_count
            if avg_value > best_score:
                best_score = avg_value
                best_children = [child]
            elif avg_value == best_score:
                best_children.append(child)
        return random.choice(best_children)

    ## 理論的には1.414だが、こうした方が良い。ランダム探索寄りになっている？
    def uct_choose_child(self, exploration_constant = 0.01):
        best_score = -float('inf')
        best_children = []
        for child in self.children.values():
            avg_value = child.value_sum / child.visit_count
            exploration = exploration_constant * math.sqrt(math.log(self.visit_count) / child.visit_count)
            ucb_value = avg_value + exploration
            if ucb_value > best_score:
                best_score = ucb_value
                best_children = [child]
            elif ucb_value == best_score:
                best_children.append(child)
        return random.choice(best_children)
    
    def expand_child(self):
        """
        子を一つ展開する
        """
        assert self.is_fully_expanded() == False, "This node is fully expanded so you can't expand"
        
        action = self.untried_actions.pop()
        next_state = self.state.clone()
        next_state.apply_action(action)
        child = self.__class__(next_state, self, strategy = self.strategy)
        self.children[action] = child
        return child
    
    def selection(self):
        """
        葉まで下る
        """
        node = self
        while not node.is_terminal() and node.is_fully_expanded():
            node = node.choose_child()
        return node
    
    def backpropagate(self):
        """
        現在の盤面を評価し、ルートに向かって報酬を反転させながら伝播させる
        """
        eval_player = self.parent_player
        base_reward = self.evaluate(eval_player)
        node = self
        while True:
            node.visit_count += 1
            if node.parent_player is not None:
                if node.parent_player == eval_player:
                    node.value_sum += base_reward
                else:
                    node.value_sum += (1.0 - base_reward)
            node = node.parent
            if node is None:
                break
        
        
    def select_best_action(self):
        """
        探索回数が一番多い行動を返す
        """
        if self.children:
            return max(self.children.items(), key=lambda item: item[1].visit_count)[0]
        legal_actions = self.state.legal_actions()
        if not legal_actions:
            return None
        return random.choice(legal_actions)

    def search(self, iter=None, dead_line = 1.0):
        """
        行動を探索する
        """
        if self.is_terminal():
            return SearchResult(None, 0, 0.0)
        start_time = time.perf_counter()
        it = 0
        while True:
            if dead_line is not None and time.perf_counter() > start_time + dead_line :
                break
            leaf = self.selection()
            target_node = leaf
            if not leaf.is_terminal():
                target_node = leaf.expand_child()
            target_node.backpropagate()
            it += 1
            if iter is not None and it >= iter:
                break

        elapsed_seconds = time.perf_counter() - start_time
        best_action = self.select_best_action()
        return SearchResult(best_action, it, elapsed_seconds)
    
    def apply_action(self, action):
        """
        actionを実行した時の新たな根ノードを返す。内部的にデータを破壊する。
        """
        if action in self.children:
            self.children[action].parent = None
            return self.children[action]
        
        if self.is_terminal():
            return None
        
        if action in self.state.legal_actions():
            next_state = self.state.clone()
            next_state.apply_action(action)
            new_node = self.__class__(next_state, None, strategy = self.strategy)
            new_node.parent_player = self.state.current_player()
            return new_node
        return None
        
    def evaluate(self, player_id):
        """
        盤面を評価する

        Args:
            player_id (_type_): _description_

        Raises:
            NotImplementedError: _description_
        """
        raise NotImplementedError()
    
    def get_evaluation(self, player_id):
        if self.parent_player is None or self.visit_count == 0:
            return -1
        if self.parent_player == player_id:
            return self.value_sum / self.visit_count
        else:
            return (1.0 - self.value_sum / self.visit_count)


    
class OthelloAgent(MTTreeNode):
    def __init__(self, state, parent=None, strategy = "UCT"):
        assert strategy in ["UCT", "EPSILON_GREEDY"], "Invalid strategy"
        super().__init__(state, parent, strategy)
    
    def evaluate(self, player_id):
        """
        現在の盤面を特定のプレイヤー視点で評価し、[0, 1] で返す。
        player_id: 0 (黒/x), 1 (白/o)
        """
        if self.state.is_terminal():
            returns = self.state.returns()
            # OpenSpielのreturnsは通常 [-1.0, 1.0] なので [0.0, 1.0] に変換
            return (returns[player_id] + 1.0) / 2.0
        
        sum = 0.0
        obs = self.state.observation_tensor(player_id)
        for i in range(BOARD_SIZE):
            sum += CELL_WEIGHT[i] * obs[BOARD_SIZE * 1 + i]
            sum -= CELL_WEIGHT[i] * obs[BOARD_SIZE * 2 + i]
        # 値を[0, 1]に正規化する。正規化を前提とした係数をchoose_childはしている
        return (sum + 20916) / 41832
    
    def get_search_result(self, iter = None, dead_line = 1.0):
        return self.search(iter, dead_line)

    def get_action(self, iter = None, dead_line = 1.0):
        return self.get_search_result(iter, dead_line).action
