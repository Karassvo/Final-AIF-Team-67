# Demo video — voice-over script (≈2 min 55 s)

The video `RoomMatch_demo.mp4` has burnt-in captions and no sound. Record this text over it if you want a voice-over (e.g. in CapCut or Clipchamp). Times are approximate.

| Time | Say |
|---|---|
| 0:00 | RoomMatch assigns dormitory rooms by lifestyle, not by the alphabet. |
| 0:05 | This is the dorm: each tile is a room, and the colour shows how well its residents match. You are watching simulated annealing settle the rooms. The interface works in Kazakh, Russian and English. |
| 0:20 | A new student fills in the survey: one question per screen — bedtime, tidiness, noise, guests, and a few words about herself. TF-IDF understands hobbies in any of the three languages. |
| 0:50 | Her resident passport: K-means puts her in a lifestyle type, and the fuzzy score lists the people she would get along with, with reasons. She moves in mid-year without reshuffling anyone. |
| 1:05 | Her profile shows roommates, why they match, and a swap market of improving moves. |
| 1:15 | The dorm map. Constraint search guarantees every rule — gender floors, capacity, smokers only with smokers, friends together. Click a room to read why its residents were put together. |
| 1:30 | Compare: a random assignment turns many rooms red. Constraint search plus simulated annealing makes almost every room green. |
| 1:45 | Compare two shows the fuzzy reasoning for any pair: memberships, the rules that fired, and the centroid. |
| 2:00 | Resident types: five clusters from K-means++, with k chosen by the elbow and silhouette. |
| 2:10 | In the Lab we compare all methods: real satisfaction goes from 52 to 87 out of 100. Annealing accepts worse moves while hot to escape local optima, then cools down. |
| 2:30 | Finally the system learns from ratings: a random forest finds that bedtime and noise, not tidiness, cause conflicts, and a genetic algorithm retunes the fuzzy rules. |
| 2:50 | Four AI topics, all from scratch, tested and reproducible. Thank you. |
