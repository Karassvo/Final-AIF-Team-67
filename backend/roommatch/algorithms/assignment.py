"""Room assignment: Constraint Satisfaction (backtracking + MRV + forward
checking) followed by Simulated Annealing optimisation — from scratch.

Hard constraints (must never be violated)
    * room capacity
    * single-gender floors (student gender == room gender)
    * smokers only share rooms with smokers (and non-smokers with non-smokers)
    * mutual friend requests: both friends live in the same room

Soft objective (maximised by Simulated Annealing)
    every student's satisfaction = mean compatibility with roommates;
    J = (mean satisfaction + λ · mean of the worst-off 10 %) / (1 + λ)
    λ > 0 adds *fairness*: nobody is sacrificed for a better average.
"""

from __future__ import annotations

import math
import sys
import time
from dataclasses import dataclass, field

import numpy as np

from ..models import Dorm, Student

ALONE_SCORE = 50.0       # satisfaction of a student without roommates
EMPTY_ROOM_SCORE = 58.0  # value-ordering score for opening an empty room
CLUSTER_BONUS = 6.0      # value-ordering bonus when joining same-type residents
CONFLICT_THRESHOLD = 45.0


@dataclass
class CSPResult:
    success: bool
    room_of: np.ndarray
    nodes: int
    backtracks: int
    seconds: float
    reason: str = ""


@dataclass
class _State:
    room_of: np.ndarray
    count: np.ndarray
    smoke: list            # None | bool per room
    domains: list[set]
    members: list[list[int]] = field(default_factory=list)


class AssignmentCSP:
    """Backtracking search over students (variables) and rooms (values)."""

    def __init__(self, students: list[Student], dorm: Dorm, compat: np.ndarray,
                 cluster_labels: np.ndarray | None = None, var_order: str = "mrv",
                 value_order: str = "compat", forward_checking: bool = True,
                 max_nodes: int = 300_000, seed: int = 0):
        self.students, self.dorm, self.compat = students, dorm, compat
        self.n, self.m = len(students), len(dorm.rooms)
        self.cap = np.array([r.capacity for r in dorm.rooms])
        self.smoker = np.array([s.smoker for s in students])
        self.gender = np.array([s.gender for s in students])
        self.room_gender = np.array([r.gender for r in dorm.rooms])
        id2idx = {s.id: i for i, s in enumerate(students)}
        self.friend = np.array([id2idx.get(s.friend_id, -1) if s.friend_id is not None else -1
                                for s in students])
        # only honour *mutual* requests
        for i, f in enumerate(self.friend):
            if f >= 0 and self.friend[f] != i:
                self.friend[i] = -1
        self.labels = cluster_labels
        self.var_order, self.value_order = var_order, value_order
        self.fc, self.max_nodes = forward_checking, max_nodes
        self.rng = np.random.default_rng(seed)
        self.nodes = self.backtracks = 0

    # ----- constraint checks -------------------------------------------------
    def _consistent(self, st: _State, i: int, r: int) -> bool:
        if self.room_gender[r] != self.gender[i] or st.count[r] >= self.cap[r]:
            return False
        if st.smoke[r] is not None and st.smoke[r] != self.smoker[i]:
            return False
        f = self.friend[i]
        if f >= 0:
            if st.room_of[f] >= 0 and st.room_of[f] != r:
                return False
            if st.room_of[f] < 0 and st.count[r] + 2 > self.cap[r]:
                return False   # leave a bed for the friend
        return True

    # ----- heuristics -------------------------------------------------------
    def _select_var(self, st: _State, unassigned: set) -> int:
        if self.var_order == "static":
            return min(unassigned)
        # MRV: fewest legal values; tie-break by degree (friend constraint), then smokers
        best, best_key = -1, None
        for i in unassigned:
            size = len(st.domains[i]) if self.fc else sum(
                self._consistent(st, i, r) for r in range(self.m))
            key = (size, -int(self.friend[i] >= 0), -int(self.smoker[i]), i)
            if best_key is None or key < best_key:
                best, best_key = i, key
        return best

    def _order_values(self, st: _State, i: int) -> list[int]:
        vals = [r for r in (st.domains[i] if self.fc else range(self.m)) if self._consistent(st, i, r)]
        if self.value_order == "random":
            self.rng.shuffle(vals)
            return vals
        if self.value_order == "static":
            return sorted(vals)

        def score(r: int) -> float:
            occ = st.members[r]
            if not occ:
                return EMPTY_ROOM_SCORE
            s = float(self.compat[i, occ].mean())
            if self.labels is not None and np.mean(self.labels[occ] == self.labels[i]) >= 0.5:
                s += CLUSTER_BONUS
            return s
        return sorted(vals, key=lambda r: (-score(r), r))

    # ----- forward checking -------------------------------------------------
    def _forward_check(self, st: _State, i: int, r: int, unassigned: set):
        removed: list[tuple[int, int]] = []
        full = st.count[r] >= self.cap[r]
        for j in unassigned:
            if r in st.domains[j] and (full or (st.smoke[r] is not None and self.smoker[j] != st.smoke[r])):
                st.domains[j].discard(r)
                removed.append((j, r))
        f = self.friend[i]
        if f >= 0 and f in unassigned:
            for rr in list(st.domains[f]):
                if rr != r:
                    st.domains[f].discard(rr)
                    removed.append((f, rr))
        wipeout = any(not st.domains[j] for j in unassigned) or not self._capacity_feasible(st, unassigned)
        return removed, wipeout

    def _capacity_feasible(self, st: _State, unassigned: set) -> bool:
        """Global counting constraint: for every gender there must remain
        enough free beds for the remaining smokers and non-smokers
        (rooms not yet 'claimed' by either group can host both)."""
        for g in ("F", "M"):
            rem_s = sum(1 for j in unassigned if self.gender[j] == g and self.smoker[j])
            rem_n = sum(1 for j in unassigned if self.gender[j] == g and not self.smoker[j])
            free_s = free_n = free_any = 0
            for r in np.where(self.room_gender == g)[0]:
                free = self.cap[r] - st.count[r]
                if st.smoke[r] is None:
                    free_any += free
                elif st.smoke[r]:
                    free_s += free
                else:
                    free_n += free
            if rem_s > free_s + free_any or rem_n > free_n + free_any or \
                    rem_s + rem_n > free_s + free_n + free_any:
                return False
            # smokers need whole rooms: beds left in unclaimed rooms that the
            # non-smokers do not need must suffice for the smokers
            if rem_s > free_s + max(0, free_any - max(0, rem_n - free_n)):
                return False
        return True

    # ----- search -------------------------------------------------------------
    def solve(self) -> CSPResult:
        t0 = time.perf_counter()
        if any(sum(self.cap[self.room_gender == g]) < np.sum(self.gender == g) for g in ("F", "M")):
            return CSPResult(False, np.full(self.n, -1), 0, 0, 0.0, "not enough beds")
        st = _State(room_of=np.full(self.n, -1), count=np.zeros(self.m, dtype=int),
                    smoke=[None] * self.m,
                    domains=[{r for r in range(self.m) if self.room_gender[r] == self.gender[i]}
                             for i in range(self.n)],
                    members=[[] for _ in range(self.m)])
        unassigned = set(range(self.n))
        sys.setrecursionlimit(max(10_000, self.n * 4))
        ok = self._backtrack(st, unassigned)
        reason = "" if ok else ("node limit reached" if self.nodes >= self.max_nodes else "unsatisfiable")
        return CSPResult(ok, st.room_of.copy(), self.nodes, self.backtracks,
                         time.perf_counter() - t0, reason)

    def _backtrack(self, st: _State, unassigned: set) -> bool:
        if not unassigned:
            return True
        if self.nodes >= self.max_nodes:
            return False
        i = self._select_var(st, unassigned)
        for r in self._order_values(st, i):
            self.nodes += 1
            prev_smoke = st.smoke[r]
            st.room_of[i] = r
            st.count[r] += 1
            st.members[r].append(i)
            st.smoke[r] = bool(self.smoker[i])
            unassigned.discard(i)
            removed, wipeout = self._forward_check(st, i, r, unassigned) if self.fc else ([], False)
            if not wipeout and self._backtrack(st, unassigned):
                return True
            for j, rr in removed:                      # undo
                st.domains[j].add(rr)
            unassigned.add(i)
            st.members[r].pop()
            st.count[r] -= 1
            st.smoke[r] = prev_smoke
            st.room_of[i] = -1
            if self.nodes >= self.max_nodes:
                return False
        self.backtracks += 1
        return False


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------
def rooms_members(room_of: np.ndarray, n_rooms: int) -> list[list[int]]:
    members: list[list[int]] = [[] for _ in range(n_rooms)]
    for i, r in enumerate(room_of):
        if r >= 0:
            members[int(r)].append(i)
    return members


def student_scores(room_of: np.ndarray, compat: np.ndarray, n_rooms: int) -> np.ndarray:
    scores = np.full(len(room_of), ALONE_SCORE)
    for occ in rooms_members(room_of, n_rooms):
        if len(occ) > 1:
            sub = compat[np.ix_(occ, occ)]
            scores[occ] = (sub.sum(axis=1) - np.diag(sub)) / (len(occ) - 1)
    return scores


def worst_fraction_mean(scores: np.ndarray, frac: float = 0.1) -> float:
    k = max(1, int(math.ceil(len(scores) * frac)))
    return float(np.partition(scores, k - 1)[:k].mean())


def objective(scores: np.ndarray, fairness: float) -> float:
    return (scores.mean() + fairness * worst_fraction_mean(scores)) / (1.0 + fairness)


def evaluate(room_of: np.ndarray, compat: np.ndarray, n_rooms: int,
             true_matrix: np.ndarray | None = None) -> dict:
    s = student_scores(room_of, compat, n_rooms)
    members = rooms_members(room_of, n_rooms)
    out = {
        "mean_score": round(float(s.mean()), 2),
        "worst10_score": round(worst_fraction_mean(s), 2),
        "min_score": round(float(s.min()), 2),
        "conflict_rate": round(float(np.mean(s < CONFLICT_THRESHOLD)) * 100, 2),
        "lonely": int(sum(len(m) == 1 for m in members)),
        "rooms_used": int(sum(len(m) > 0 for m in members)),
    }
    if true_matrix is not None:
        t = student_scores(room_of, true_matrix, n_rooms)
        out["true_mean"] = round(float(t.mean()), 2)
        out["true_worst10"] = round(worst_fraction_mean(t), 2)
        out["true_conflict_rate"] = round(float(np.mean(t < CONFLICT_THRESHOLD)) * 100, 2)
    return out


def check_constraints(room_of: np.ndarray, students: list[Student], dorm: Dorm) -> list[str]:
    """Return a list of violated hard constraints (empty == valid)."""
    errors = []
    members = rooms_members(room_of, len(dorm.rooms))
    id2room = {students[i].id: int(r) for i, r in enumerate(room_of)}
    if np.any(room_of < 0):
        errors.append("unassigned students")
    for r, occ in enumerate(members):
        room = dorm.rooms[r]
        if len(occ) > room.capacity:
            errors.append(f"room {room.id} over capacity")
        if any(students[i].gender != room.gender for i in occ):
            errors.append(f"room {room.id} gender mismatch")
        if len({students[i].smoker for i in occ}) > 1:
            errors.append(f"room {room.id} mixes smokers and non-smokers")
    for s in students:
        f = s.friend_id
        if f is not None and f in id2room:
            friend = next((x for x in students if x.id == f), None)
            if friend is not None and friend.friend_id == s.id and id2room[f] != id2room[s.id]:
                errors.append(f"friends {s.id} and {f} separated")
    return errors


# ---------------------------------------------------------------------------
# Simulated Annealing
# ---------------------------------------------------------------------------
@dataclass
class AnnealResult:
    room_of: np.ndarray
    history: list[dict]
    frames: list[list[float]]   # per-room mean scores snapshots (for animation)
    accepted: int
    improved: int
    seconds: float
    t0: float = 0.0


class _AnnealState:
    """Mutable search state with O(room size) move evaluation and undo."""

    def __init__(self, room_of, students, dorm, compat, fairness):
        self.room_of = room_of.copy()
        self.compat, self.fairness = compat, fairness
        self.m = len(dorm.rooms)
        self.cap = np.array([r.capacity for r in dorm.rooms])
        self.smoker = np.array([s.smoker for s in students])
        self.gender = np.array([s.gender for s in students])
        self.room_gender = np.array([r.gender for r in dorm.rooms])
        ids = {s.id for s in students}
        locked = np.array([s.friend_id is not None and s.friend_id in ids for s in students])
        self.members = [set(x) for x in rooms_members(self.room_of, self.m)]
        self.scores = student_scores(self.room_of, compat, self.m)
        self.movable = np.where(~locked)[0]
        self.by_gender = {g: self.movable[self.gender[self.movable] == g] for g in ("F", "M")}
        self.value = objective(self.scores, fairness)
        self._undo = None

    def _update_room(self, r: int) -> None:
        occ = list(self.members[r])
        if len(occ) == 1:
            self.scores[occ[0]] = ALONE_SCORE
        elif len(occ) > 1:
            sub = self.compat[np.ix_(occ, occ)]
            self.scores[occ] = (sub.sum(axis=1) - np.diag(sub)) / (len(occ) - 1)

    def _room_ok(self, r: int, i: int, ignore: int = -1) -> bool:
        return all(self.smoker[j] == self.smoker[i] for j in self.members[r] if j != ignore)

    def propose(self, rng) -> float | None:
        """Apply a random valid move; return objective delta (or None)."""
        i = int(rng.choice(self.movable))
        ri = int(self.room_of[i])
        if rng.random() < 0.75:                                   # swap two residents
            j = int(rng.choice(self.by_gender[self.gender[i]]))
            rj = int(self.room_of[j])
            if rj == ri or not self._room_ok(rj, i, ignore=j) or not self._room_ok(ri, j, ignore=i):
                return None
            affected = list(self.members[ri] | self.members[rj])
            self._undo = ("swap", i, j, ri, rj, affected, self.scores[affected].copy(), self.value)
            self.members[ri].remove(i); self.members[rj].remove(j)
            self.members[ri].add(j); self.members[rj].add(i)
            self.room_of[i], self.room_of[j] = rj, ri
        else:                                                     # move into a free bed
            free = [r for r in range(self.m) if self.room_gender[r] == self.gender[i] and r != ri
                    and len(self.members[r]) < self.cap[r] and self._room_ok(r, i)]
            if not free:
                return None
            rj = int(rng.choice(free))
            affected = list(self.members[ri] | self.members[rj] | {i})
            self._undo = ("move", i, -1, ri, rj, affected, self.scores[affected].copy(), self.value)
            self.members[ri].remove(i); self.members[rj].add(i)
            self.room_of[i] = rj
        self._update_room(ri)
        self._update_room(rj)
        new = objective(self.scores, self.fairness)
        delta = new - self.value
        self.value = new
        return delta

    def undo(self) -> None:
        kind, i, j, ri, rj, affected, old_scores, old_value = self._undo
        if kind == "swap":
            self.members[ri].remove(j); self.members[rj].remove(i)
            self.members[ri].add(i); self.members[rj].add(j)
            self.room_of[i], self.room_of[j] = ri, rj
        else:
            self.members[rj].remove(i); self.members[ri].add(i)
            self.room_of[i] = ri
        self.scores[affected] = old_scores
        self.value = old_value

    def room_means(self) -> list[float]:
        return [round(float(self.scores[list(mm)].mean()), 1) if mm else -1.0 for mm in self.members]


def calibrate_temperature(state: _AnnealState, rng, samples: int = 300, p0: float = 0.5) -> float:
    """Initial temperature such that an average worsening move is accepted
    with probability p0 (classic Kirkpatrick-style calibration):
    exp(-avg_worse / T0) = p0  ->  T0 = -avg_worse / ln(p0)."""
    worse = []
    for _ in range(samples * 3):
        d = state.propose(rng)
        if d is None:
            continue
        if d < 0:
            worse.append(-d)
        state.undo()
        if len(worse) >= samples:
            break
    avg = float(np.mean(worse)) if worse else 1e-3
    return -avg / math.log(p0)


def anneal(room_of: np.ndarray, students: list[Student], dorm: Dorm, compat: np.ndarray,
           iterations: int = 30_000, t0: float | None = None, cooling_ratio: float = 1e-3,
           fairness: float = 0.0, seed: int = 0, n_frames: int = 40) -> AnnealResult:
    """Simulated annealing with geometric cooling T_k = T0 * r^(k/N),
    auto-calibrated T0 and best-so-far tracking (the returned solution is
    never worse than the starting one)."""
    t_start = time.perf_counter()
    rng = np.random.default_rng(seed)
    st = _AnnealState(room_of, students, dorm, compat, fairness)
    if len(st.movable) < 2 or iterations <= 0:
        return AnnealResult(st.room_of, [], [st.room_means()], 0, 0, time.perf_counter() - t_start)
    t0 = t0 if t0 is not None else calibrate_temperature(st, rng)
    decay = cooling_ratio ** (1.0 / iterations)
    temp = t0
    best_value, best_room_of = st.value, st.room_of.copy()
    history, frames = [], [st.room_means()]
    record_every = max(1, iterations // 200)
    frame_every = max(1, iterations // n_frames)
    accepted = improved = 0

    def record(it: int) -> None:
        history.append({"iter": it, "temperature": round(temp, 5), "objective": round(st.value, 3),
                        "mean": round(float(st.scores.mean()), 3),
                        "worst10": round(worst_fraction_mean(st.scores), 3)})

    for it in range(iterations):
        delta = st.propose(rng)
        if delta is not None:
            if delta >= 0 or rng.random() < math.exp(delta / temp):   # Metropolis criterion
                accepted += 1
                if delta > 0:
                    improved += 1
                if st.value > best_value + 1e-12:
                    best_value, best_room_of = st.value, st.room_of.copy()
            else:
                st.undo()
        temp *= decay
        if it % record_every == 0:
            record(it)
        if it % frame_every == 0 and it > 0:
            frames.append(st.room_means())
    record(iterations)
    # return to the best state found
    final = _AnnealState(best_room_of, students, dorm, compat, fairness)
    frames.append(final.room_means())
    return AnnealResult(best_room_of, history, frames, accepted, improved,
                        time.perf_counter() - t_start, t0)
