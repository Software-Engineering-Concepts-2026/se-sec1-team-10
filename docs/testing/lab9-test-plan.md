# Lab 9 Test Plan — Testing and CI

## Scope

This plan covers the Lab 9 artefacts in this repository: `calculate_net_calories` in the Stats Service and the FizzBuzz exercise.  The lecture's separate `calculate_discount` and email-validation exercises are not present in this project and are therefore not represented as completed work here.  They remain a chapter-exercise gap if the instructor requires every standalone lecture exercise in the same repository.

## Unit-test design: `calculate_net_calories`

The function accepts non-negative numeric calorie values and returns `calories_in - calories_out`. Negative values are invalid and raise `ValueError`.

| Inputs | Equivalence partition / boundary | Expected result |
| --- | --- | --- |
| `500`, `300` | normal valid values | `200` |
| `0`, `300` | `calories_in` at lower boundary | `-300` |
| `500`, `0` | `calories_out` at lower boundary | `500` |
| `0`, `0` | both lower boundaries | `0` |
| `125.5`, `25.25` | valid fractional partition | `100.25` |
| `-0.01`, `300` | immediately below `calories_in` boundary | `ValueError` |
| `500`, `-0.01` | immediately below `calories_out` boundary | `ValueError` |
| `-1`, `-1` | both inputs invalid | `ValueError` |

### Decision table

| `calories_in < 0` | `calories_out < 0` | Action |
| --- | --- | --- |
| no | no | return `calories_in - calories_out` |
| yes | no | raise `ValueError` |
| no | yes | raise `ValueError` |
| yes | yes | raise `ValueError` |

The API endpoint tests also verify the documented response from `/`, `/health`, and `/stats`. They keep the CI coverage target focused on code that is actually exposed by the Stats Service.

## FizzBuzz examples and properties

Example tests cover 1, 2, 3, 5, 7, 9, 15, and 30. Property tests use Hypothesis with at least 150 generated examples per property:

1. Multiples of 15 produce `FizzBuzz`.
2. Multiples of 3 that are not multiples of 5 produce `Fizz`.
3. Multiples of 5 that are not multiples of 3 produce `Buzz`.
4. Other positive integers return their decimal text.

FizzBuzz now explicitly accepts integers only. `bool` is rejected even though Python treats it as a subtype of `int`; that avoids treating `True` as the number 1. This is a new Lab 9 input contract, not a retrospective claim that the original kata required it.

## TDD evidence and limitation

The historical first RED commit is `8b7d2f0`, but the next historical commit `37a6286` combined implementation and several tests. That earlier sequence does not prove a complete Red-Green-Refactor cycle.

This branch adds one new, honest cycle for the boolean-input contract:

| Stage | Commit | Evidence |
| --- | --- | --- |
| Red | `53bbcd2` | `pytest src/tests/test_fizzbuzz.py -q` failed: expected `TypeError`, but no exception was raised. |
| Green | `17d8d1c` | the minimal input guard was added; the same command passed 9 tests. |
| Refactor | current Lab 9 test/documentation commit | tests were grouped into parameterized partitions and documented without changing the resulting behavior. |

## Local and CI command

```powershell
python -m pip install -r requirements-test.txt
python -m pytest src/tests -v --cov=src.fizzbuzz --cov=app --cov-branch --cov-report=term-missing --cov-fail-under=90
```

The GitHub Actions workflow runs the same command on pull requests and pushes to `main`. Branch protection that requires the `Tests` check is a GitHub repository setting and must be enabled by a repository administrator.
