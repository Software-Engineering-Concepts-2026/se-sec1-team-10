# Lab 12B Safety Net

## Selected function

`services/stats-service/app.py::calculate_net_calories` computes the difference between calories consumed and burned. It is a small, existing business rule with explicit valid and invalid input boundaries, so it is a focused target for equivalence-partition and boundary tests. Its behavior is unchanged.

## Test cases

| Class | Inputs `(calories_in, calories_out)` | Expected |
| --- | --- | --- |
| Happy: ordinary | `(500, 300)` | `200` |
| Happy: fractional | `(125.5, 25.25)` | `100.25` |
| Edge: `calories_in` zero | `(0, 300)` | `-300` |
| Edge: `calories_out` zero | `(500, 0)` | `500` |
| Edge: both zero | `(0, 0)` | `0` |
| Edge: equal positive | `(250, 250)` | `0` |
| Error: negative `calories_in` | `(-0.01, 300)` | `ValueError` |
| Error: negative `calories_out` | `(500, -0.01)` | `ValueError` |
| Error: both negative | `(-1, -1)` | `ValueError` |

The nine cases have stable pytest IDs, Arrange/Act/Assert sections, and an error-message check for invalid inputs.

## Coverage results

The full run completed 57 tests. Branch and statement coverage were:

| Production module | Statements covered | Branches covered | Coverage |
| --- | ---: | ---: | ---: |
| `services/stats-service/app.py` | 15/15 | 2/2 | 100% |
| `src/fizzbuzz.py` | 10/10 | 8/8 | 100% |
| `src/lab9_exercises.py` | 13/13 | 6/6 | 100% |
| `src/lab9_fizzbuzz_kata.py` | 4/4 | 0/0 | 100% |
| **Total** | **42/42** | **16/16** | **100%** |

The focused calorie run passed 9 tests and reported 82% for the entire Stats Service module because endpoint functions are outside that focused suite. The complete run includes endpoint tests. Ruff 0.16.9 passed. One upstream Starlette deprecation warning appeared during the full run.

## CI and protection evidence

`.github/workflows/ci.yml` defines `lint` and `test` jobs for pull requests and pushes to `main`. Lint runs Ruff 0.16.9; tests enforce at least 90% combined statement/branch coverage across the four modules and upload `coverage.xml`.

On 2026-09-27, commit `73b920e` intentionally changed the expected result of `500 - 300` from `200` to `201`. [GitHub CI recorded test failure and lint success](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/36262569061). The following commit restores `200`; see [PR #58 checks](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/pull/58/checks) for the latest verification. No production code was changed during the experiment.

The main branch API reports `protected: true`, but required status checks have `enforcement_level: off` and an empty checks list. The PR page explicitly requires one approving review. Detailed protection settings return HTTP 404 with this account. CI failure detection is demonstrated; **CI-enforced merge blocking is not yet demonstrated**. Draft state and the missing approval also block this PR and must not be presented as evidence that a failing test blocks merging. Administrator verification is needed if required checks remain unconfigured.

## Lessons (AI draft for team review)

The tests show that zero inputs can produce a negative net result while still being valid, and that either negative input is rejected. The full suite exercises both the calculation and its API routes. Team members should review this draft and add their own Lab 12 post-quiz reflection; no quiz answers are supplied here.
