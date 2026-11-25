# How RoomMatch works — the four AI techniques

All algorithms are implemented **from scratch with NumPy** (no scikit-learn, no fuzzy or optimisation libraries).
Each section lists the file, the idea, the exact formulas we use and the design decisions you may be asked about.

```
 survey answers ──► pairwise features ──► (1) FUZZY LOGIC ──► compatibility matrix C (n×n, 0..100)
       │                                         ▲                         │
       ├──► (2) K-MEANS++ ──► resident types     │                         ▼
       └──► (2) TF-IDF ──► shared interests ─────┘          (3) CSP ──► valid assignment
                                                                           │
                                                              (3) SIMULATED ANNEALING ──► final rooms
                                                                           │
 residents' ratings ──► (4) DECISION TREE / RANDOM FOREST (what causes conflicts)
                    └─► (4) GENETIC ALGORITHM ──► retuned fuzzy parameters ──► back to (1)
```

---

## 1. Fuzzy logic — compatibility of a pair
**File:** `backend/roommatch/algorithms/fuzzy.py`

**Why fuzzy?** "Goes to bed at 23:30" vs "at 00:00" is *almost the same*; 23:30 vs 03:00 is *very different*.
A crisp threshold ("difference > 1 h = bad") treats 59 and 61 minutes completely differently. Fuzzy sets
let a 1-hour gap be partly "small" and partly "medium".

**Inputs** (crisp values computed from two questionnaires, `features.py`):

| input | meaning | range |
|---|---|---|
| `sleep_diff` | \|bedtime A − bedtime B\| in hours | 0–6 |
| `clean_diff` | \|tidiness A − tidiness B\| | 0–4 |
| `noise_conflict` | max over directions of (guests of one − noise tolerance of other, +0.5 if the other studies in the room) | 0–4 |
| `social_diff` | \|sociability A − sociability B\| | 0–4 |

**Membership functions.** Each input has three terms *small / medium / large*, defined by three numbers `a < m < b`
(a Ruspini partition — memberships always sum to 1):

```
small(x)  = clip((m − x)/(m − a), 0, 1)
large(x)  = clip((x − m)/(b − m), 0, 1)
medium(x) = 1 − small(x) − large(x)
```
Output *compatibility* (0–100) has five terms: very low, low, medium, high, very high (trapezoids at the ends, triangles inside).

**Rule base** — 17 Mamdani rules such as
`IF sleep_diff is small AND clean_diff is small AND noise_conflict is small THEN compatibility is very high`
and `IF clean_diff is large THEN compatibility is very low`.

**Inference (Mamdani):**
1. *Fuzzification* — compute memberships of every input.
2. *Rule evaluation* — AND = `min`; each rule has a weight `w ∈ [0,1]`: `strength = w · min(...)`.
3. *Implication* — clip the consequent set at the rule strength (`min`).
4. *Aggregation* — `max` over all clipped sets.
5. *Defuzzification* — centroid `y* = Σ y·μ(y) / Σ μ(y)` over 101 points.

**Final score** = `0.82 × fuzzy (stretched to 0–100) + 10·same_language + 8·interest_similarity − 25·smoker_mismatch`.

The whole n×n matrix is computed in a vectorised way (≈0.2 s for 240 students, 2.7 s for 1 000).
The UI page *Compare two* shows the full trace: memberships, fired rules with strengths and the aggregated output with the centroid.

**Tests:** memberships form a partition; identical students score high; the output is (approximately) monotone in every input; the matrix is symmetric.

---

## 2. Unsupervised learning — resident types and shared interests
**Files:** `algorithms/clustering.py`, `algorithms/text.py`

### K-means++
* Features: the 7 lifestyle answers, **standardised** (z-scores) so that bedtime in hours and Likert answers weigh equally.
* Initialisation **k-means++**: first centre at random, each next centre sampled with probability ∝ D(x)² (distance to the nearest chosen centre). Avoids bad starts.
* Lloyd's algorithm: assignment step (nearest centre) ↔ update step (mean of members) until centres move < 1e-6. Best of 8 restarts by inertia.
* **Choosing k:** inertia curve + "kneedle" elbow detection (point farthest from the line between the first and last point), silhouette `s(i) = (b − a)/max(a, b)` as a second opinion. On our data silhouette prefers k = 2 (a coarse early-vs-late split), the elbow gives k = 4–5, and agreement with the hidden archetypes (ARI) peaks at k = 5 — a good example of why one metric is not enough.
* **Naming clusters:** each centroid is matched one-to-one (greedy, by distance) to five persona prototypes — Quiet scholar 📚, Night owl 🦉, Early bird 🌅, Social butterfly 🦋, Easygoing 🌿.
* **Visualisation:** PCA via SVD projects the 7-D data to 2-D (≈75 % of variance).
* **Use in matching:** the CSP value ordering gives a small bonus to rooms where most residents share the student's type.

### TF-IDF + cosine similarity
* Students write "About me" in Kazakh, Russian or English. Tokens are normalised to canonical interests with a trilingual dictionary plus light suffix stripping (`шахматами → шахмат → chess`), so *шахмат*, *шахматы* and *chess* match.
* `tf(t,d) = count/len(d)`, `idf(t) = ln((1+N)/(1+df(t))) + 1`, rows L2-normalised → cosine similarity = dot product.
* Similarity adds up to +8 points to the compatibility; shared interests are listed in explanations.

---

## 3. Search — constraint satisfaction + simulated annealing
**File:** `algorithms/assignment.py`

### CSP (hard constraints)
* **Variables:** students. **Domains:** rooms on floors of the student's gender.
* **Constraints:** room capacity; smokers only with smokers; mutual friend requests → same room (the solver keeps a bed free for the friend).
* **Backtracking search** with
  * **MRV** (minimum remaining values) variable ordering, tie-break by degree (friend constraint) and smokers first;
  * **forward checking**: after each assignment remove full rooms and rooms with the wrong smoking status from other domains; a friend's domain shrinks to the chosen room;
  * a **global bed-counting constraint**: for every gender, free beds in "smoking", "non-smoking" and still-unclaimed rooms must suffice for the remaining smokers and non-smokers. Without it, random value ordering dead-ends almost every time (see experiments).
  * **Value ordering:** rooms sorted by average compatibility with current occupants (+ type bonus); an empty room has a neutral value 58.
* Greedy CSP alone already gives a decent, always-valid solution in < 0.1 s.

### Simulated annealing (soft objective)
* **State:** an assignment. **Moves:** swap two residents of the same gender (75 %) or move one resident to a free bed (25 %). Moves that would break the smoking rule are skipped; friends are locked together.
* **Objective:** every student's satisfaction = mean compatibility with roommates (alone = 50).
  `J = (mean + λ · mean of worst-off 10 %) / (1 + λ)` — λ is the **fairness** knob.
* **Metropolis rule:** accept if ΔJ ≥ 0, otherwise with probability `exp(ΔJ / T)`.
* **Temperature:** `T0` is **auto-calibrated** so that an average worsening move is accepted with probability 0.5 (`T0 = −avg_worse / ln 0.5`); geometric cooling to `T0/1000`. The best state seen is returned, so SA never ends worse than its start.
* Incremental evaluation: only the two affected rooms are recomputed per move → 25 000 iterations ≈ 1.7 s.

---

## 4. Learning from feedback — decision tree, random forest, genetic algorithm
**File:** `algorithms/learning.py`

After a month residents rate their roommate 1–5. Rating ≤ 2 = **conflict**.
(In the demo, ratings come from a hidden simulator `data/ground_truth.py`; the CSV upload accepts real ratings.)

### CART decision tree and random forest
* Binary splits on thresholds, impurity = **Gini** `1 − p² − (1 − p)²`, best split = largest impurity decrease; depth ≤ 4, ≥ 10 samples per leaf.
* **Feature importance** = total weighted impurity decrease per feature.
* **Random forest:** 40 trees on bootstrap samples, 3 random features per split, probabilities averaged.
* Result: F1 0.81 (tree) and 0.86 (forest) vs 0.0 for the majority baseline. Importance shows **bedtime difference and noise** cause conflicts, while tidiness — which the hand-written fuzzy rules emphasised — matters little.

### Genetic algorithm — tuning the fuzzy system
* **Genome:** 12 membership parameters (a, m, b for 4 inputs) + 17 rule weights = 29 real numbers.
* **Fitness:** Pearson correlation between the fuzzy score and real ratings on the training pairs.
* **Operators:** tournament selection (size 3), BLX-α crossover (α = 0.3), Gaussian mutation (rate 0.15), elitism (2), 40 individuals × 40 generations.
* Test-set correlation rises from ≈0.83 to ≈0.87; re-assigning with the tuned rules raises the real satisfaction of the worst-off 10 % by ≈8 points.

---

## Evaluation methodology
Because we can't move real students in and out, the demo uses a **hidden ground-truth satisfaction model** (deliberately different from the hand-written fuzzy rules). The algorithms never see it; it is only used to measure "real" satisfaction of an assignment. All numbers in `backend/experiments/results/RESULTS.md` are reproducible with `python experiments/run_experiments.py`.
For a real deployment, collect ratings with `data/feedback_template.csv` and upload them in the Lab.
