"""Application service: holds the current dataset and orchestrates the four
AI modules. The FastAPI layer is a thin wrapper around this class, and the
experiment scripts use it directly."""

from __future__ import annotations

import csv
import io
import threading
import time
from typing import Optional

import numpy as np

from .algorithms import assignment as asg
from .algorithms.clustering import (Standardizer, adjusted_rand_index, choose_k,
                                    describe_centroid, kmeans, name_clusters, pca_2d,
                                    silhouette_score)
from .algorithms.fuzzy import (INPUTS, RULES, FuzzyCompatibility, FuzzyParams,
                               compatibility_from_rows, compatibility_matrix)
from .algorithms.learning import (DecisionTree, RandomForest, classification_metrics,
                                  genetic_tune, pearson, train_test_split)
from .algorithms.text import TfidfModel, cosine_similarity_matrix, extract_interests, shared_interests
from .data.generator import generate_world
from .data.ground_truth import generate_feedback, true_satisfaction_matrix
from .features import PAIR_FEATURES, pairwise_feature_tensors
from .models import FEATURE_RANGES, LIFESTYLE_FEATURES, Dorm, Student, build_dorm

METHODS = {
    "random": "Random valid assignment (CSP, random value order)",
    "greedy": "CSP + MRV + forward checking, compatibility-ordered values",
    "annealing": "CSP + Simulated Annealing",
    "fair_annealing": "CSP + Simulated Annealing with fairness term",
}


def fmt_hour(h: float) -> str:
    h = h % 24
    return f"{int(h):02d}:{int(round((h - int(h)) * 60)) % 60:02d}"


class RoomMatchEngine:
    def __init__(self, n_students: int = 240, seed: int = 42):
        self.lock = threading.RLock()
        self.fuzzy = FuzzyCompatibility()
        self.tuned = False
        self.learn_result: Optional[dict] = None
        self.feedback: Optional[dict] = None
        self.k: Optional[int] = None
        self.generate(n_students, seed)

    # ------------------------------------------------------------------ data
    def generate(self, n_students: int = 240, seed: int = 42) -> dict:
        students, dorm = generate_world(n_students, seed)
        return self.load(students, dorm, synthetic=True, seed=seed)

    def load(self, students: list[Student], dorm: Dorm, synthetic: bool = False, seed: int = 0) -> dict:
        with self.lock:
            self.students, self.dorm, self.synthetic, self.seed = students, dorm, synthetic, seed
            self._rebuild()
            self.assign("fair_annealing", fairness=0.5, iterations=max(25_000, 100 * len(students)))
            return self.summary()

    def _rebuild(self, recluster: bool = True) -> None:
        t0 = time.perf_counter()
        self.id2idx = {s.id: i for i, s in enumerate(self.students)}
        self.tfidf = TfidfModel().fit([s.about for s in self.students])
        self.interest_sim = cosine_similarity_matrix(self.tfidf.transform([s.about for s in self.students]))
        self.features = pairwise_feature_tensors(self.students, self.interest_sim)
        self.compat = compatibility_matrix(self.features, self.fuzzy)
        has_truth = self.synthetic
        self.true_matrix = true_satisfaction_matrix(self.features) if has_truth else None
        if recluster:
            self._cluster()
        self.build_seconds = time.perf_counter() - t0

    def _cluster(self) -> None:
        raw = np.array([s.lifestyle_vector() for s in self.students])
        self.scaler = Standardizer().fit(raw)
        z = self.scaler.transform(raw)
        self.k_analysis = choose_k(z, seed=self.seed)
        k = self.k or self.k_analysis["elbow_k"]
        res = kmeans(z, k, seed=self.seed)
        self.labels = res.labels
        self.centroids_raw = self.scaler.inverse(res.centroids)
        self.cluster_names = name_clusters(self.centroids_raw, self.scaler)
        self.silhouette = silhouette_score(z, res.labels, seed=self.seed)
        self.pca, self.pca_var = pca_2d(z)
        self.kmeans_iter = res.n_iter

    def set_k(self, k: Optional[int]) -> dict:
        with self.lock:
            self.k = k
            self._cluster()
            return self.clusters()

    # ------------------------------------------------------------ assignment
    def _csp(self, value_order: str, seed: int = 0, var_order: str = "mrv",
             forward_checking: bool = True) -> asg.CSPResult:
        return asg.AssignmentCSP(self.students, self.dorm, self.compat, self.labels,
                                 var_order=var_order, value_order=value_order,
                                 forward_checking=forward_checking, seed=seed).solve()

    def run_method(self, method: str, fairness: float = 0.5, iterations: int = 25_000,
                   seed: int = 0) -> dict:
        t0 = time.perf_counter()
        csp = self._csp("random" if method == "random" else "compat", seed=seed)
        if not csp.success:
            raise ValueError(f"No valid assignment: {csp.reason}")
        out = {"method": method, "csp": {"nodes": csp.nodes, "backtracks": csp.backtracks,
                                        "seconds": round(csp.seconds, 3)}}
        room_of, history, frames = csp.room_of, [], []
        if method in ("annealing", "fair_annealing"):
            lam = fairness if method == "fair_annealing" else 0.0
            sa = asg.anneal(room_of, self.students, self.dorm, self.compat,
                            iterations=iterations, fairness=lam, seed=seed)
            room_of, history, frames = sa.room_of, sa.history, sa.frames
            out["annealing"] = {"accepted": sa.accepted, "improved": sa.improved,
                                "seconds": round(sa.seconds, 3), "fairness": lam,
                                "iterations": iterations}
        out["room_of"] = room_of
        out["history"], out["frames"] = history, frames
        out["metrics"] = asg.evaluate(room_of, self.compat, len(self.dorm.rooms), self.true_matrix)
        out["violations"] = asg.check_constraints(room_of, self.students, self.dorm)
        out["seconds"] = round(time.perf_counter() - t0, 3)
        return out

    def assign(self, method: str = "fair_annealing", fairness: float = 0.5,
               iterations: int = 25_000, seed: int = 0) -> dict:
        with self.lock:
            res = self.run_method(method, fairness, iterations, seed)
            self.room_of = res["room_of"]
            self.method = method
            self.last_run = {k: v for k, v in res.items() if k != "room_of"}
            return self.last_run

    def compare(self, iterations: int = 20_000, seeds: tuple[int, ...] = (0, 1, 2)) -> dict:
        with self.lock:
            rows = []
            for method in METHODS:
                runs = [self.run_method(method, 0.5, iterations, seed=s) for s in seeds]
                keys = runs[0]["metrics"].keys()
                agg = {k: round(float(np.mean([r["metrics"][k] for r in runs])), 2) for k in keys}
                agg["seconds"] = round(float(np.mean([r["seconds"] for r in runs])), 3)
                rows.append({"method": method, "description": METHODS[method], **agg})
            return {"rows": rows, "seeds": list(seeds), "n_students": len(self.students)}

    # ----------------------------------------------------------------- views
    def _members(self) -> list[list[int]]:
        return asg.rooms_members(self.room_of, len(self.dorm.rooms))

    def _student_scores(self) -> np.ndarray:
        return asg.student_scores(self.room_of, self.compat, len(self.dorm.rooms))

    def cluster_of(self, i: int) -> dict:
        c = int(self.labels[i])
        return {"id": c, **self.cluster_names[c]}

    def student_brief(self, i: int) -> dict:
        s = self.students[i]
        return {"id": s.id, "name": s.name, "gender": s.gender, "year": s.year,
                "faculty": s.faculty, "language": s.language, "smoker": s.smoker,
                "cluster": self.cluster_of(i)}

    def summary(self) -> dict:
        with self.lock:
            m = self.last_run["metrics"]
            return {
                "n_students": len(self.students), "n_rooms": len(self.dorm.rooms),
                "beds": self.dorm.capacity, "floors": len(self.dorm.floors()),
                "n_female": sum(s.gender == "F" for s in self.students),
                "smokers": sum(s.smoker for s in self.students),
                "friend_pairs": sum(s.friend_id is not None for s in self.students) // 2,
                "method": self.method, "metrics": m, "synthetic": self.synthetic,
                "tuned": self.tuned, "k": int(len(self.cluster_names)),
                "build_seconds": round(self.build_seconds, 3),
                "cluster_sizes": [
                    {**self.cluster_names[c], "id": c, "size": int(np.sum(self.labels == c))}
                    for c in range(len(self.cluster_names))],
                "score_histogram": np.histogram(self._student_scores(), bins=10, range=(0, 100))[0].tolist(),
            }

    def list_students(self) -> list[dict]:
        scores = self._student_scores()
        return [{**self.student_brief(i), "room": self.dorm.rooms[int(self.room_of[i])].id,
                 "score": round(float(scores[i]), 1)} for i in range(len(self.students))]

    def dorm_view(self) -> dict:
        with self.lock:
            scores = self._student_scores()
            members = self._members()
            floors: dict[int, list] = {}
            for r, room in enumerate(self.dorm.rooms):
                occ = members[r]
                floors.setdefault(room.floor, []).append({
                    "index": r, "id": room.id, "number": room.number, "capacity": room.capacity,
                    "gender": room.gender, "smoking": bool(occ and self.students[occ[0]].smoker),
                    "score": round(float(scores[occ].mean()), 1) if len(occ) > 1 else None,
                    "residents": [{**self.student_brief(i), "score": round(float(scores[i]), 1)} for i in occ],
                })
            return {"name": self.dorm.name,
                    "floors": [{"floor": f, "gender": rooms[0]["gender"], "rooms": rooms}
                               for f, rooms in sorted(floors.items())],
                    "frames": self.last_run.get("frames", [])}

    def clusters(self) -> dict:
        with self.lock:
            pop_mean, pop_std = self.scaler.mean, self.scaler.std
            out = {
                "k": len(self.cluster_names), "silhouette": round(self.silhouette, 4),
                "k_analysis": self.k_analysis, "pca_explained": [round(float(v), 3) for v in self.pca_var],
                "features": LIFESTYLE_FEATURES, "feature_ranges": FEATURE_RANGES,
                "points": [{"id": s.id, "name": s.name, "x": round(float(self.pca[i, 0]), 3),
                            "y": round(float(self.pca[i, 1]), 3), "cluster": int(self.labels[i])}
                           for i, s in enumerate(self.students)],
                "clusters": [],
                "kmeans_iterations": int(self.kmeans_iter),
            }
            for c, info in enumerate(self.cluster_names):
                idx = np.where(self.labels == c)[0]
                interests: dict[str, int] = {}
                for i in idx:
                    for t in extract_interests(self.students[i].about):
                        interests[t] = interests.get(t, 0) + 1
                top = sorted(interests.items(), key=lambda kv: -kv[1])[:5]
                out["clusters"].append({
                    "id": c, **info, "size": int(len(idx)),
                    "centroid": {f: round(float(v), 2) for f, v in zip(LIFESTYLE_FEATURES, self.centroids_raw[c])},
                    "traits": describe_centroid(self.centroids_raw[c], pop_mean, pop_std),
                    "top_interests": [{"interest": k, "count": v} for k, v in top],
                    "smokers_pct": round(float(np.mean([self.students[i].smoker for i in idx])) * 100, 1)
                    if len(idx) else 0.0,
                })
            if self.synthetic:
                out["ari_vs_true_archetypes"] = round(adjusted_rand_index(
                    self.labels, np.array([s.archetype for s in self.students])), 4)
            return out

    # ------------------------------------------------------------- pair view
    def _crisp(self, i: int, j: int) -> dict:
        return {k: float(self.features[k][i, j]) for k in PAIR_FEATURES}

    def reasons(self, i: int, j: int) -> list[dict]:
        a, b = self.students[i], self.students[j]
        f = self._crisp(i, j)
        r = []
        if f["sleep_diff"] <= 1.0:
            r.append({"type": "good", "key": "sleep_close", "a": fmt_hour(a.bedtime), "b": fmt_hour(b.bedtime)})
        elif f["sleep_diff"] >= 2.5:
            r.append({"type": "bad", "key": "sleep_far", "a": fmt_hour(a.bedtime), "b": fmt_hour(b.bedtime)})
        if f["clean_diff"] <= 1:
            r.append({"type": "good", "key": "clean_close"})
        elif f["clean_diff"] >= 2:
            r.append({"type": "bad", "key": "clean_far"})
        if f["noise_conflict"] <= 0.5:
            r.append({"type": "good", "key": "noise_ok"})
        elif f["noise_conflict"] >= 2:
            r.append({"type": "bad", "key": "noise_conflict"})
        if f["social_diff"] <= 1:
            r.append({"type": "good", "key": "social_close"})
        elif f["social_diff"] >= 3:
            r.append({"type": "bad", "key": "social_far"})
        if f["same_language"]:
            r.append({"type": "good", "key": "same_language", "lang": a.language})
        common = shared_interests(a.about, b.about)
        if common:
            r.append({"type": "good", "key": "shared_interests", "items": common})
        if f["smoker_mismatch"]:
            r.append({"type": "bad", "key": "smoker_mismatch"})
        return r

    def profile_vector(self, s: Student) -> dict:
        out = {}
        for f in LIFESTYLE_FEATURES:
            lo, hi = FEATURE_RANGES[f]
            out[f] = round((getattr(s, f) - lo) / (hi - lo), 3)
        return out

    def student_full(self, s: Student) -> dict:
        d = s.to_dict()
        d.pop("archetype", None)
        d["bedtime_str"], d["wake_time_str"] = fmt_hour(s.bedtime), fmt_hour(s.wake_time)
        d["interests"] = extract_interests(s.about)
        d["profile"] = self.profile_vector(s)
        return d

    def pair(self, a_id: int, b_id: int) -> dict:
        with self.lock:
            i, j = self.id2idx[a_id], self.id2idx[b_id]
            crisp = self._crisp(i, j)
            explanation = self.fuzzy.explain({k: crisp[k] for k in INPUTS})
            out = {
                "a": {**self.student_full(self.students[i]), "cluster": self.cluster_of(i)},
                "b": {**self.student_full(self.students[j]), "cluster": self.cluster_of(j)},
                "features": {k: round(v, 3) for k, v in crisp.items()},
                "fuzzy": explanation,
                "score": round(float(self.compat[i, j]), 1),
                "reasons": self.reasons(i, j),
                "same_room": bool(self.room_of[i] == self.room_of[j]),
                "rules": [{"if": ante, "then": cons} for ante, cons in RULES],
            }
            if self.true_matrix is not None:
                out["true_score"] = round(float(self.true_matrix[i, j]), 1)
            return out

    def top_matches(self, i: int, n: int = 5) -> list[dict]:
        s = self.students[i]
        cand = [j for j in range(len(self.students))
                if j != i and self.students[j].gender == s.gender and self.students[j].smoker == s.smoker]
        cand.sort(key=lambda j: -self.compat[i, j])
        return [{**self.student_brief(j), "score": round(float(self.compat[i, j]), 1),
                 "reasons": self.reasons(i, j)[:3]} for j in cand[:n]]

    def student_detail(self, sid: int) -> dict:
        with self.lock:
            i = self.id2idx[sid]
            r = int(self.room_of[i])
            scores = self._student_scores()
            mates = [j for j in self._members()[r] if j != i]
            return {
                "student": self.student_full(self.students[i]),
                "cluster": self.cluster_of(i),
                "room": {"index": r, "id": self.dorm.rooms[r].id, "capacity": self.dorm.rooms[r].capacity,
                         "floor": self.dorm.rooms[r].floor},
                "score": round(float(scores[i]), 1),
                "roommates": [{**self.student_brief(j), "score": round(float(self.compat[i, j]), 1),
                               "reasons": self.reasons(i, j)} for j in mates],
                "top_matches": self.top_matches(i),
                "swaps": self.swap_suggestions(i),
            }

    # --------------------------------------------------------- swap market
    def swap_suggestions(self, i: int, n: int = 5) -> list[dict]:
        s = self.students[i]
        ids = {x.id for x in self.students}
        if s.friend_id is not None and s.friend_id in ids:
            return []
        members = self._members()
        ri = int(self.room_of[i])
        base = self._student_scores()
        out = []
        for j, t in enumerate(self.students):
            rj = int(self.room_of[j])
            if rj == ri or t.gender != s.gender or (t.friend_id is not None and t.friend_id in ids):
                continue
            if any(self.students[k].smoker != s.smoker for k in members[rj] if k != j):
                continue
            if any(self.students[k].smoker != t.smoker for k in members[ri] if k != i):
                continue
            new_ri = [k for k in members[ri] if k != i] + [j]
            new_rj = [k for k in members[rj] if k != j] + [i]

            def room_scores(occ):
                if len(occ) == 1:
                    return {occ[0]: asg.ALONE_SCORE}
                sub = self.compat[np.ix_(occ, occ)]
                v = (sub.sum(axis=1) - np.diag(sub)) / (len(occ) - 1)
                return dict(zip(occ, v))
            new = {**room_scores(new_ri), **room_scores(new_rj)}
            affected = set(members[ri]) | set(members[rj])
            delta_total = sum(new[k] - base[k] for k in affected)
            gain_i, gain_j = new[i] - base[i], new[j] - base[j]
            if gain_i > 1.0 and gain_j >= -2.0 and delta_total > 0:
                out.append({"with": {**self.student_brief(j), "room": self.dorm.rooms[rj].id},
                            "gain_self": round(float(gain_i), 1), "gain_other": round(float(gain_j), 1),
                            "gain_total": round(float(delta_total), 1)})
        out.sort(key=lambda d: -d["gain_total"])
        return out[:n]

    def apply_swap(self, a_id: int, b_id: int) -> dict:
        with self.lock:
            i, j = self.id2idx[a_id], self.id2idx[b_id]
            backup = self.room_of.copy()
            self.room_of[i], self.room_of[j] = self.room_of[j], self.room_of[i]
            errors = asg.check_constraints(self.room_of, self.students, self.dorm)
            if errors:
                self.room_of = backup
                raise ValueError("; ".join(errors))
            self.last_run["metrics"] = asg.evaluate(self.room_of, self.compat, len(self.dorm.rooms),
                                                    self.true_matrix)
            return self.student_detail(a_id)

    # ------------------------------------------------- new student mid-year
    def add_student(self, data: dict, place: bool = True) -> dict:
        with self.lock:
            data = dict(data)
            data["id"] = max(s.id for s in self.students) + 1
            data.setdefault("name", f"Student {data['id']}")
            data.setdefault("faculty", "IT")
            data.setdefault("year", 1)
            data.pop("archetype", None)
            new = Student.from_dict(data)
            if new.friend_id is not None and new.friend_id not in self.id2idx:
                new.friend_id = None
            self.students.append(new)
            i = len(self.students) - 1
            self.room_of = np.append(self.room_of, -1)
            self._rebuild(recluster=False)
            # assign new student to nearest existing centroid (no reclustering)
            z = self.scaler.transform(new.lifestyle_vector()[None, :])
            cz = self.scaler.transform(self.centroids_raw)
            self.labels = np.append(self.labels, int(((cz - z) ** 2).sum(axis=1).argmin()))
            raw = np.array([x.lifestyle_vector() for x in self.students])
            self.pca, self.pca_var = pca_2d(self.scaler.transform(raw))
            placed = self.place_student(i) if place else None
            return {"id": new.id, "passport": self.passport(i), "placed": placed}

    def place_student(self, i: int) -> Optional[dict]:
        """Best room with a free bed (respecting all hard constraints)."""
        s = self.students[i]
        members = self._members()
        best, best_score = None, -1.0
        for r, room in enumerate(self.dorm.rooms):
            occ = [k for k in members[r] if k != i]
            if room.gender != s.gender or len(occ) >= room.capacity:
                continue
            if any(self.students[k].smoker != s.smoker for k in occ):
                continue
            score = float(self.compat[i, occ].mean()) if occ else asg.ALONE_SCORE
            if score > best_score:
                best, best_score = r, score
        if best is None:
            # the dormitory is full for this gender: add a new room on a new floor
            from .models import Room
            floor = max(self.dorm.floors()) + 1
            self.dorm.rooms.append(Room(id=f"{floor}-01", floor=floor, number=1, capacity=3, gender=s.gender))
            best, best_score = len(self.dorm.rooms) - 1, asg.ALONE_SCORE
        self.room_of[i] = best
        self.last_run["metrics"] = asg.evaluate(self.room_of, self.compat, len(self.dorm.rooms),
                                                self.true_matrix)
        return {"room": self.dorm.rooms[best].id, "score": round(best_score, 1)}

    def passport(self, i: int) -> dict:
        s = self.students[i]
        return {"student": self.student_full(s), "cluster": self.cluster_of(i),
                "top_matches": self.top_matches(i)}

    def preview_passport(self, data: dict) -> dict:
        """Passport for a questionnaire without adding the student."""
        with self.lock:
            snapshot = (list(self.students), self.room_of.copy(), self.labels.copy(), self.pca.copy(),
                    self.pca_var.copy(), [r for r in self.dorm.rooms], dict(self.last_run))
            try:
                res = self.add_student(data, place=False)
                return res["passport"]
            finally:
                (self.students, self.room_of, self.labels, self.pca, self.pca_var, self.dorm.rooms,
                 self.last_run) = snapshot
                self._rebuild(recluster=False)

    # --------------------------------------------------------------- learning
    def learn(self, n_pairs: int = 700, generations: int = 40, population: int = 40, seed: int = 0) -> dict:
        with self.lock:
            fb = self.feedback or generate_feedback(n_pairs, seed=seed + 7)
            x, y = fb["X"], fb["rating"]
            names = fb["feature_names"]
            tr, te = train_test_split(len(y), 0.25, seed)
            conflict = (y <= 2).astype(int)
            tree = DecisionTree(max_depth=4, min_samples_leaf=10).fit(x[tr], conflict[tr])
            forest = RandomForest(n_trees=40, seed=seed).fit(x[tr], conflict[tr])
            majority = int(conflict[tr].mean() >= 0.5)
            ga = genetic_tune(x[tr], y[tr], population=population, generations=generations, seed=seed)
            before = FuzzyCompatibility()
            after = FuzzyCompatibility(ga["params"])
            s_before, s_after = compatibility_from_rows(x[te], before), compatibility_from_rows(x[te], after)
            self.learn_result = {
                "n_pairs": int(len(y)), "train": int(len(tr)), "test": int(len(te)),
                "rating_distribution": np.bincount(y, minlength=6)[1:].tolist(),
                "conflict_rate": round(float(conflict.mean()), 3),
                "tree": {"metrics": classification_metrics(conflict[te], tree.predict(x[te])),
                         "importance": dict(zip(names, np.round(tree.importances_, 4).tolist())),
                         "structure": tree.export(names)},
                "forest": {"metrics": classification_metrics(conflict[te], forest.predict(x[te])),
                           "importance": dict(zip(names, np.round(forest.importances_, 4).tolist()))},
                "baseline": classification_metrics(conflict[te], np.full(len(te), majority)),
                "ga": {"history": ga["history"], "seconds": ga["seconds"],
                       "corr_before_train": round(pearson(compatibility_from_rows(x[tr], before), y[tr].astype(float)), 4),
                       "corr_after_train": round(ga["fitness"], 4),
                       "corr_before_test": round(pearson(s_before, y[te].astype(float)), 4),
                       "corr_after_test": round(pearson(s_after, y[te].astype(float)), 4),
                       "params_before": FuzzyParams().to_dict(), "params_after": ga["params"].to_dict(),
                       "scatter": [{"rating": int(r), "before": round(float(b), 1), "after": round(float(a), 1)}
                                   for r, b, a in zip(y[te][:150], s_before[:150], s_after[:150])]},
                "applied": False,
            }
            self._ga_params = ga["params"]
            return self.learn_result

    def apply_learned(self, iterations: int = 25_000) -> dict:
        with self.lock:
            if self.learn_result is None:
                raise ValueError("Run learning first")
            before = dict(self.last_run["metrics"])
            self.fuzzy = FuzzyCompatibility(self._ga_params)
            self.tuned = True
            self._rebuild(recluster=False)
            self.assign("fair_annealing", fairness=0.5, iterations=iterations)
            self.learn_result["applied"] = True
            return {"before": before, "after": self.last_run["metrics"]}

    def reset_fuzzy(self) -> dict:
        with self.lock:
            self.fuzzy = FuzzyCompatibility()
            self.tuned = False
            self._rebuild(recluster=False)
            self.assign("fair_annealing", fairness=0.5)
            return self.summary()

    def load_feedback_csv(self, text: str) -> dict:
        """Real feedback: CSV with columns = PAIR_FEATURES + rating."""
        rows = list(csv.DictReader(io.StringIO(text)))
        x = np.array([[float(r[f]) for f in PAIR_FEATURES] for r in rows])
        y = np.array([int(float(r["rating"])) for r in rows])
        self.feedback = {"X": x, "rating": np.clip(y, 1, 5), "feature_names": list(PAIR_FEATURES)}
        return {"pairs": len(rows)}

    # ------------------------------------------------------------- import/export
    def export_csv(self) -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["student_id", "name", "gender", "room", "floor", "type", "satisfaction"])
        scores = self._student_scores()
        for i, s in enumerate(self.students):
            room = self.dorm.rooms[int(self.room_of[i])]
            w.writerow([s.id, s.name, s.gender, room.id, room.floor,
                        self.cluster_names[int(self.labels[i])]["key"], round(float(scores[i]), 1)])
        return buf.getvalue()

    def import_students_csv(self, text: str) -> dict:
        rows = list(csv.DictReader(io.StringIO(text)))
        students = [Student.from_dict(r) for r in rows]
        n_f = sum(s.gender == "F" for s in students)
        dorm = build_dorm(n_female=n_f, n_male=len(students) - n_f)
        return self.load(students, dorm, synthetic=False)

