import numpy as np
import pytest

from roommatch.algorithms import assignment as asg
from roommatch.algorithms.clustering import (Standardizer, adjusted_rand_index, choose_k, kmeans,
                                             pca_2d, silhouette_score)
from roommatch.algorithms.fuzzy import (FuzzyCompatibility, FuzzyParams, compatibility_matrix,
                                        input_memberships)
from roommatch.algorithms.learning import (DecisionTree, RandomForest, classification_metrics,
                                           genetic_tune, pearson)
from roommatch.algorithms.text import TfidfModel, extract_interests, shared_interests, tokenize
from roommatch.data.generator import generate_students, generate_world
from roommatch.data.ground_truth import generate_feedback
from roommatch.features import pairwise_feature_tensors
from roommatch.models import Student


def _x(**kw):
    base = dict(sleep_diff=0.0, clean_diff=0.0, noise_conflict=0.0, social_diff=0.0)
    base.update(kw)
    return {k: np.array([v], dtype=float) for k, v in base.items()}


# --------------------------------------------------------------- fuzzy logic
class TestFuzzy:
    def test_memberships_form_partition(self):
        x = np.linspace(0, 6, 61)
        m = input_memberships(x, 0.5, 1.75, 3.5)
        assert np.allclose(m["small"] + m["medium"] + m["large"], 1.0)
        assert m["small"][0] == 1.0 and m["large"][-1] == 1.0

    def test_identical_pair_scores_high(self):
        f = FuzzyCompatibility()
        assert f.evaluate(_x())[0] > 75

    @pytest.mark.parametrize("name,umax", [("sleep_diff", 6), ("clean_diff", 4),
                                           ("noise_conflict", 4), ("social_diff", 4)])
    @pytest.mark.parametrize("base", [0.0, 1.0, 2.0])
    def test_approximately_monotone(self, name, umax, base):
        """Bigger differences should never make a pair noticeably MORE
        compatible (small centroid artefacts of < 3 points are tolerated)."""
        f = FuzzyCompatibility()
        xs = np.linspace(0, umax, 41)
        inp = {k: np.full(41, base) for k in ("sleep_diff", "clean_diff", "noise_conflict", "social_diff")}
        inp[name] = xs
        v = f.evaluate(inp)
        assert np.max(np.diff(v)) < 3.0
        assert v[0] >= v[-1]

    def test_worst_pair_scores_low(self):
        f = FuzzyCompatibility()
        assert f.evaluate(_x(sleep_diff=6, clean_diff=4, noise_conflict=4, social_diff=4))[0] < 30

    def test_explain_trace(self):
        e = FuzzyCompatibility().explain({"sleep_diff": 1, "clean_diff": 1, "noise_conflict": 0.5,
                                          "social_diff": 1})
        assert e["fired_rules"] and 0 <= e["score"] <= 100
        assert e["fired_rules"][0]["strength"] >= e["fired_rules"][-1]["strength"]

    def test_genome_roundtrip(self):
        p = FuzzyParams()
        q = FuzzyParams.from_vector(p.to_vector())
        assert q.mf == p.mf and np.allclose(q.weights, p.weights)

    def test_compat_matrix_symmetric(self):
        students = generate_students(40, seed=1)
        sim = np.eye(40)
        m = compatibility_matrix(pairwise_feature_tensors(students, sim), FuzzyCompatibility())
        assert np.allclose(m, m.T) and m.min() >= 0 and m.max() <= 100


# --------------------------------------------------------------- text / tf-idf
class TestText:
    def test_multilingual_normalisation(self):
        assert extract_interests("Люблю шахматы и аниме") == ["chess", "anime"]
        assert extract_interests("Маған шахмат пен кітап ұнайды") == ["chess", "reading"]
        assert extract_interests("I love chess and books") == ["chess", "reading"]

    def test_inflected_forms(self):
        assert "chess" in tokenize("увлекаюсь шахматами")

    def test_shared_interests_cross_language(self):
        assert shared_interests("I love chess and anime", "Люблю шахматы") == ["chess"]

    def test_tfidf_rows_normalised(self):
        m = TfidfModel().fit_transform(["chess anime", "football gym", "chess football"])
        assert np.allclose(np.linalg.norm(m, axis=1), 1.0)


# --------------------------------------------------------------- clustering
class TestClustering:
    def test_kmeans_recovers_blobs(self):
        rng = np.random.default_rng(0)
        centers = np.array([[0, 0], [8, 8], [0, 8]])
        x = np.vstack([c + rng.normal(0, 0.5, (50, 2)) for c in centers])
        truth = np.repeat([0, 1, 2], 50)
        r = kmeans(x, 3)
        assert adjusted_rand_index(r.labels, truth) > 0.95
        assert silhouette_score(x, r.labels) > 0.7

    def test_recovers_synthetic_archetypes(self):
        students = generate_students(300, seed=3)
        z = Standardizer().fit(np.array([s.lifestyle_vector() for s in students]))
        x = z.transform(np.array([s.lifestyle_vector() for s in students]))
        r = kmeans(x, 5)
        assert adjusted_rand_index(r.labels, np.array([s.archetype for s in students])) > 0.8
        assert choose_k(x)["elbow_k"] in (4, 5, 6)

    def test_pca_shapes(self):
        p, var = pca_2d(np.random.default_rng(0).normal(size=(30, 7)))
        assert p.shape == (30, 2) and var.sum() <= 1.0


# ---------------------------------------------------------- CSP + annealing
@pytest.fixture(scope="module")
def world():
    students, dorm = generate_world(150, seed=5)
    tf = TfidfModel().fit_transform([s.about for s in students])
    compat = compatibility_matrix(pairwise_feature_tensors(students, tf @ tf.T), FuzzyCompatibility())
    return students, dorm, compat


class TestAssignment:
    @pytest.mark.parametrize("value_order", ["compat", "random"])
    def test_csp_respects_hard_constraints(self, world, value_order):
        students, dorm, compat = world
        res = asg.AssignmentCSP(students, dorm, compat, value_order=value_order).solve()
        assert res.success
        assert asg.check_constraints(res.room_of, students, dorm) == []

    def test_csp_detects_insufficient_capacity(self, world):
        students, dorm, compat = world
        from roommatch.models import Dorm
        tiny = Dorm(name="tiny", rooms=dorm.rooms[:3])
        assert not asg.AssignmentCSP(students, tiny, compat).solve().success

    def test_annealing_improves_and_stays_valid(self, world):
        students, dorm, compat = world
        start = asg.AssignmentCSP(students, dorm, compat, value_order="random").solve().room_of
        sa = asg.anneal(start, students, dorm, compat, iterations=8000, seed=1)
        before = asg.evaluate(start, compat, len(dorm.rooms))["mean_score"]
        after = asg.evaluate(sa.room_of, compat, len(dorm.rooms))["mean_score"]
        assert after > before + 5
        assert asg.check_constraints(sa.room_of, students, dorm) == []

    def test_fairness_raises_worst_off(self, world):
        students, dorm, compat = world
        start = asg.AssignmentCSP(students, dorm, compat).solve().room_of
        plain = asg.anneal(start, students, dorm, compat, iterations=10000, fairness=0.0, seed=2)
        fair = asg.anneal(start, students, dorm, compat, iterations=10000, fairness=3.0, seed=2)
        w = lambda r: asg.evaluate(r, compat, len(dorm.rooms))["worst10_score"]  # noqa: E731
        assert w(fair.room_of) >= w(plain.room_of) - 1.0


# ------------------------------------------------------------------ learning
class TestLearning:
    def test_tree_learns_simple_rule(self):
        rng = np.random.default_rng(0)
        x = rng.uniform(0, 1, (400, 3))
        y = (x[:, 1] > 0.6).astype(int)
        t = DecisionTree(max_depth=3).fit(x, y)
        assert classification_metrics(y, t.predict(x))["accuracy"] > 0.97
        assert np.argmax(t.importances_) == 1

    def test_forest_beats_majority_on_feedback(self):
        fb = generate_feedback(400, seed=3)
        y = (fb["rating"] <= 2).astype(int)
        rf = RandomForest(n_trees=15).fit(fb["X"][:300], y[:300])
        acc = classification_metrics(y[300:], rf.predict(fb["X"][300:]))["accuracy"]
        assert acc > max(y[300:].mean(), 1 - y[300:].mean()) + 0.1

    def test_ga_improves_correlation(self):
        fb = generate_feedback(300, seed=4)
        res = genetic_tune(fb["X"], fb["rating"], population=16, generations=8, seed=0)
        assert res["history"][-1]["best"] >= res["history"][0]["best"]

    def test_pearson(self):
        a = np.arange(10.0)
        assert pearson(a, 2 * a + 1) == pytest.approx(1.0)


def test_student_from_dict_clips_values():
    s = Student.from_dict(dict(id="3", name="X", gender="F", year="2", faculty="IT", bedtime=30,
                               wake_time=7, cleanliness=9, noise_tolerance=3, guests=3,
                               study_in_room=3, social=3, smoker="", language="kk", friend_id=""))
    assert s.bedtime == 27 and s.cleanliness == 5 and s.friend_id is None and s.smoker is False
