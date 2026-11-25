"""Reproducible experiments for the technical report.

    python experiments/run_experiments.py            # full run (~2-4 min)
    python experiments/run_experiments.py --quick    # smoke run (~30 s)

Writes CSV tables, PNG charts and a Markdown summary to experiments/results/.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from roommatch.algorithms import assignment as asg  # noqa: E402
from roommatch.algorithms.clustering import (Standardizer, adjusted_rand_index, choose_k,  # noqa: E402
                                             kmeans)
from roommatch.algorithms.fuzzy import FuzzyCompatibility, compatibility_matrix  # noqa: E402
from roommatch.algorithms.text import TfidfModel, cosine_similarity_matrix  # noqa: E402
from roommatch.data.generator import generate_world  # noqa: E402
from roommatch.data.ground_truth import true_satisfaction_matrix  # noqa: E402
from roommatch.engine import METHODS, RoomMatchEngine  # noqa: E402
from roommatch.features import PAIR_FEATURES, pairwise_feature_tensors  # noqa: E402

OUT = Path(__file__).resolve().parent / "results"
INK, MUTED, GRID = "#1f2430", "#6b7280", "#e5e7eb"
PALETTE = ["#9ca3af", "#60a5fa", "#6366f1", "#14b8a6", "#f59e0b", "#ef4444"]
LABELS = {"random": "Random (valid)", "greedy": "CSP greedy", "annealing": "CSP + SA",
          "fair_annealing": "CSP + SA + fairness"}

plt.rcParams.update({
    "figure.dpi": 140, "savefig.bbox": "tight", "font.size": 10, "axes.edgecolor": GRID,
    "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.8, "axes.spines.top": False, "axes.spines.right": False,
    "axes.axisbelow": True, "axes.grid.axis": "y", "axes.titleweight": "bold", "axes.titlesize": 11, "legend.frameon": False,
})


def save_csv(name: str, rows: list[dict]) -> None:
    with open(OUT / f"{name}.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def md_table(rows: list[dict], cols: list[str]) -> str:
    head = "| " + " | ".join(cols) + " |\n|" + "---|" * len(cols) + "\n"
    return head + "\n".join("| " + " | ".join(str(r[c]) for c in cols) + " |" for r in rows) + "\n"


def build(n: int, seed: int):
    students, dorm = generate_world(n, seed)
    t0 = time.perf_counter()
    tf = TfidfModel().fit_transform([s.about for s in students])
    feats = pairwise_feature_tensors(students, cosine_similarity_matrix(tf))
    compat = compatibility_matrix(feats, FuzzyCompatibility())
    t_compat = time.perf_counter() - t0
    return students, dorm, compat, true_satisfaction_matrix(feats), t_compat


# --------------------------------------------------------------------------
def exp_methods(seeds: list[int], iters: int, report: list[str]) -> None:
    eng = RoomMatchEngine(240, seed=42)
    rows = []
    for m in METHODS:
        runs = [eng.run_method(m, 0.5, iters, seed=s) for s in seeds]
        r = {"method": LABELS[m]}
        for k in ("mean_score", "worst10_score", "conflict_rate", "true_mean", "true_worst10",
                  "true_conflict_rate", "seconds"):
            vals = [x["metrics"].get(k, x.get(k)) if k != "seconds" else x["seconds"] for x in runs]
            r[k] = f"{np.mean(vals):.2f} ± {np.std(vals):.2f}"
            r[k + "_mean"] = float(np.mean(vals))
        r["violations"] = sum(len(x["violations"]) for x in runs)
        rows.append(r)
    save_csv("methods", rows)
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.6))
    for ax, (k, title) in zip(axes, [("true_mean_mean", "Real satisfaction, mean (↑)"),
                                     ("true_worst10_mean", "Real satisfaction, worst 10% (↑)"),
                                     ("true_conflict_rate_mean", "Residents in conflict, % (↓)")]):
        vals = [r[k] for r in rows]
        bars = ax.bar([r["method"] for r in rows], vals, color=PALETTE[:4])
        ax.set_title(title)
        ax.tick_params(axis="x", rotation=20)
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v, f"{v:.1f}", ha="center", va="bottom", fontsize=9, color=INK)
    fig.suptitle(f"Assignment methods, 240 students, {len(seeds)} seeds", fontweight="bold", y=1.05)
    fig.savefig(OUT / "methods.png")
    plt.close(fig)
    report.append("## 1. Assignment methods (240 students)\n\n"
                  "*Model* columns use the fuzzy score the algorithm optimises; *real* columns use the hidden "
                  "ground-truth satisfaction model that the algorithms never see.\n\n" +
                  md_table(rows, ["method", "mean_score", "worst10_score", "conflict_rate", "true_mean",
                                  "true_worst10", "true_conflict_rate", "seconds", "violations"]) +
                  "\n![methods](methods.png)\n")

    # SA convergence
    run = eng.run_method("fair_annealing", 0.5, iters, seed=0)
    h = run["history"]
    fig, ax = plt.subplots(figsize=(7, 3.4))
    ax.plot([p["iter"] for p in h], [p["mean"] for p in h], color=PALETTE[2], label="mean satisfaction")
    ax.plot([p["iter"] for p in h], [p["worst10"] for p in h], color=PALETTE[3], label="worst-off 10%")
    ax2 = ax.twinx()
    ax2.plot([p["iter"] for p in h], [p["temperature"] for p in h], color=PALETTE[4], ls="--", lw=1, label="temperature")
    ax2.set_ylabel("temperature", color=MUTED)
    ax2.grid(False)
    ax.set_xlabel("iteration")
    ax.set_ylabel("satisfaction (model)")
    ax.set_title("Simulated Annealing convergence")
    ax.legend(loc="lower right")
    fig.savefig(OUT / "sa_convergence.png")
    plt.close(fig)
    report.append("![sa](sa_convergence.png)\n")


def exp_fairness(lambdas: list[float], iters: int, report: list[str]) -> None:
    eng = RoomMatchEngine(240, seed=42)
    start = eng._csp("compat").room_of
    rows = []
    for lam in lambdas:
        ms = [asg.evaluate(asg.anneal(start, eng.students, eng.dorm, eng.compat, iterations=iters,
                                      fairness=lam, seed=s).room_of, eng.compat, len(eng.dorm.rooms),
                           eng.true_matrix) for s in (0, 1, 2)]
        avg = lambda k: round(float(np.mean([m[k] for m in ms])), 2)  # noqa: E731
        rows.append({"lambda": lam, "mean": avg("mean_score"), "worst10": avg("worst10_score"),
                     "min": avg("min_score"), "conflict_rate": avg("conflict_rate")})
    save_csv("fairness", rows)
    fig, ax = plt.subplots(figsize=(5.5, 3.6))
    ax.plot([r["mean"] for r in rows], [r["worst10"] for r in rows], "-o", color=PALETTE[2])
    for r in rows:
        ax.annotate(f"λ={r['lambda']}", (r["mean"], r["worst10"]), textcoords="offset points",
                    xytext=(6, 4), fontsize=8, color=MUTED)
    ax.set_xlabel("mean satisfaction")
    ax.set_ylabel("worst-off 10% satisfaction")
    ax.set_title("Fairness trade-off")
    fig.savefig(OUT / "fairness.png")
    plt.close(fig)
    report.append("## 2. Fairness trade-off (λ sweep, mean of 3 seeds)\n\n" +
                  md_table(rows, ["lambda", "mean", "worst10", "min", "conflict_rate"]) +
                  "\n![fairness](fairness.png)\n")


def exp_csp_ablation(seeds: list[int], report: list[str]) -> None:
    students, dorm, compat, _, _ = build(240, 42)
    rows = []
    for var in ("static", "mrv"):
        for fc in (False, True):
            res = [asg.AssignmentCSP(students, dorm, compat, var_order=var, value_order="random",
                                     forward_checking=fc, max_nodes=3_000, seed=s).solve() for s in seeds]
            rows.append({"variable_order": var.upper(), "forward_checking": "on" if fc else "off",
                         "solved": f"{sum(r.success for r in res)}/{len(res)}",
                         "nodes": int(np.mean([r.nodes for r in res])),
                         "backtracks": int(np.mean([r.backtracks for r in res])),
                         "seconds": round(float(np.mean([r.seconds for r in res])), 3)})
    save_csv("csp_ablation", rows)
    report.append("## 3. CSP ablation (random value order, node limit 3 000)\n\n"
                  "Forward checking includes the global bed-counting constraint.\n\n" +
                  md_table(rows, ["variable_order", "forward_checking", "solved", "nodes", "backtracks", "seconds"]))


def exp_scalability(sizes: list[int], iters_per_student: int, report: list[str]) -> None:
    rows = []
    for n in sizes:
        students, dorm, compat, true_m, t_compat = build(n, 7)
        raw = np.array([s.lifestyle_vector() for s in students])
        z = Standardizer().fit(raw).transform(raw)
        t0 = time.perf_counter()
        km = kmeans(z, 5)
        t_km = time.perf_counter() - t0
        csp = asg.AssignmentCSP(students, dorm, compat, km.labels).solve()
        sa = asg.anneal(csp.room_of, students, dorm, compat, iterations=iters_per_student * n, fairness=0.5)
        m0 = asg.evaluate(csp.room_of, compat, len(dorm.rooms), true_m)
        m1 = asg.evaluate(sa.room_of, compat, len(dorm.rooms), true_m)
        rows.append({"students": n, "rooms": len(dorm.rooms), "fuzzy_matrix_s": round(t_compat, 3),
                     "kmeans_s": round(t_km, 3), "csp_s": round(csp.seconds, 3), "sa_s": round(sa.seconds, 3),
                     "greedy_true_mean": m0["true_mean"], "sa_true_mean": m1["true_mean"],
                     "ari": round(adjusted_rand_index(km.labels, np.array([s.archetype for s in students])), 3)})
    save_csv("scalability", rows)
    fig, ax = plt.subplots(figsize=(6, 3.6))
    for k, c, lab in [("fuzzy_matrix_s", PALETTE[1], "fuzzy matrix"), ("kmeans_s", PALETTE[3], "K-means"),
                      ("csp_s", PALETTE[2], "CSP"), ("sa_s", PALETTE[4], f"SA ({iters_per_student}·n it.)")]:
        ax.plot([r["students"] for r in rows], [r[k] for r in rows], "-o", color=c, label=lab)
    ax.set_xlabel("students")
    ax.set_ylabel("seconds")
    ax.set_title("Running time vs. problem size")
    ax.legend()
    fig.savefig(OUT / "scalability.png")
    plt.close(fig)
    report.append("## 4. Scalability\n\n" + md_table(rows, list(rows[0].keys())) + "\n![scal](scalability.png)\n")


def exp_clustering(report: list[str]) -> None:
    students, _ = generate_world(400, 3)
    raw = np.array([s.lifestyle_vector() for s in students])
    z = Standardizer().fit(raw).transform(raw)
    ck = choose_k(z)
    truth = np.array([s.archetype for s in students])
    aris = [round(adjusted_rand_index(kmeans(z, k).labels, truth), 3) for k in ck["k_values"]]
    rows = [{"k": k, "inertia": i, "silhouette": s, "ARI_vs_truth": a}
            for k, i, s, a in zip(ck["k_values"], ck["inertia"], ck["silhouette"], aris)]
    save_csv("clustering", rows)
    fig, ax = plt.subplots(1, 2, figsize=(10, 3.4))
    ax[0].plot(ck["k_values"], ck["inertia"], "-o", color=PALETTE[2])
    ax[0].axvline(ck["elbow_k"], color=PALETTE[4], ls="--", lw=1)
    ax[0].set_title(f"Elbow method (knee at k={ck['elbow_k']})")
    ax[0].set_xlabel("k")
    ax[0].set_ylabel("inertia")
    ax[1].plot(ck["k_values"], ck["silhouette"], "-o", color=PALETTE[3], label="silhouette")
    ax[1].plot(ck["k_values"], aris, "-s", color=PALETTE[2], label="ARI vs true archetypes")
    ax[1].set_title("Silhouette & agreement with ground truth")
    ax[1].set_xlabel("k")
    ax[1].legend()
    fig.savefig(OUT / "clustering.png")
    plt.close(fig)
    report.append("## 5. Clustering (400 students)\n\n" + md_table(rows, ["k", "inertia", "silhouette", "ARI_vs_truth"]) +
                  f"\nElbow picks k = {ck['elbow_k']}; silhouette alone would pick k = {ck['silhouette_k']} "
                  "(it rewards the coarse early-vs-late split). Agreement with the hidden archetypes peaks at "
                  f"k = {ck['k_values'][int(np.argmax(aris))]} (ARI {max(aris):.2f}).\n"
                  "\n![clustering](clustering.png)\n")


def exp_learning(generations: int, report: list[str]) -> None:
    eng = RoomMatchEngine(240, seed=42)
    r = eng.learn(generations=generations)
    rows = []
    for name, d in [("Majority baseline", r["baseline"]), ("Decision tree (CART)", r["tree"]["metrics"]),
                    ("Random forest", r["forest"]["metrics"])]:
        rows.append({"model": name, **{k: d[k] for k in ("accuracy", "precision", "recall", "f1")}})
    save_csv("conflict_prediction", rows)
    imp = r["forest"]["importance"]
    fig, ax = plt.subplots(1, 2, figsize=(11, 3.6))
    names = sorted(imp, key=imp.get)
    ax[0].barh(names, [imp[n] for n in names], color=PALETTE[2])
    ax[0].set_title("What causes conflicts? (forest importance)")
    h = r["ga"]["history"]
    ax[1].plot([p["generation"] for p in h], [p["best"] for p in h], color=PALETTE[2], label="best")
    ax[1].plot([p["generation"] for p in h], [p["mean"] for p in h], color=PALETTE[3], label="population mean")
    ax[1].axhline(r["ga"]["corr_before_train"], color=PALETTE[0], ls="--", lw=1, label="hand-written rules")
    ax[1].set_xlabel("generation")
    ax[1].set_ylabel("Pearson r (score vs rating)")
    ax[1].set_title("Genetic algorithm tuning the fuzzy system")
    ax[1].legend()
    fig.savefig(OUT / "learning.png")
    plt.close(fig)
    applied = eng.apply_learned()
    report.append(
        "## 6. Learning from feedback\n\n"
        f"{r['n_pairs']} simulated rated pairs ({r['train']} train / {r['test']} test); "
        f"conflict = rating ≤ 2 ({r['conflict_rate'] * 100:.0f}% of pairs).\n\n" + md_table(rows, list(rows[0].keys())) +
        f"\nFuzzy score ↔ rating correlation on the **test** set: "
        f"{r['ga']['corr_before_test']:.3f} (hand-written) → **{r['ga']['corr_after_test']:.3f}** (GA-tuned).\n\n"
        "Effect of re-assigning with the tuned fuzzy system (real satisfaction):\n\n" +
        md_table([{"": "before", **{k: applied["before"][k] for k in ("true_mean", "true_worst10", "true_conflict_rate")}},
                  {"": "after", **{k: applied["after"][k] for k in ("true_mean", "true_worst10", "true_conflict_rate")}}],
                 ["", "true_mean", "true_worst10", "true_conflict_rate"]) +
        "\n![learning](learning.png)\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    q = args.quick
    report = ["# RoomMatch — experiment results\n",
              f"Generated {time.strftime('%Y-%m-%d %H:%M')}. Features used: {', '.join(PAIR_FEATURES)}.\n"]
    steps = [
        ("methods", lambda: exp_methods([0, 1] if q else [0, 1, 2, 3, 4], 8000 if q else 25000, report)),
        ("fairness", lambda: exp_fairness([0, 1, 3] if q else [0, 0.25, 0.5, 1, 2, 4], 8000 if q else 25000, report)),
        ("csp", lambda: exp_csp_ablation([0] if q else [0, 1, 2], report)),
        ("scalability", lambda: exp_scalability([100, 250] if q else [100, 250, 500, 1000], 30 if q else 100, report)),
        ("clustering", lambda: exp_clustering(report)),
        ("learning", lambda: exp_learning(10 if q else 40, report)),
    ]
    for name, fn in steps:
        t0 = time.perf_counter()
        fn()
        print(f"[{name}] done in {time.perf_counter() - t0:.1f}s")
    (OUT / "RESULTS.md").write_text("\n".join(report), encoding="utf-8")
    print(f"Results written to {OUT}")


if __name__ == "__main__":
    main()
