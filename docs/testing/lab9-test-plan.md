# Lab 9 Test Plan — Testing and CI

## Scope

This plan covers the Lab 9 production modules in this repository: `calculate_net_calories` in the Stats Service, FizzBuzz, and the chapter exercises in `src/lab9_exercises.py`. Coverage is measured only for these production modules, never for tests or temporary mutation files.

## Unit-test design: `calculate_discount`

`calculate_discount(amount, percentage)` returns `amount * (100 - percentage) / 100`. `amount` must be at least `0`; `percentage` must be from `0` through `100`, inclusive. Invalid inputs raise `ValueError`.

| Inputs | Equivalence partition / boundary | Expected result |
| --- | --- | --- |
| `100`, `0` | percentage lower boundary | `100` |
| `100`, `100` | percentage upper boundary | `0` |
| `0`, `25` | amount lower boundary | `0` |
| `80`, `25` | ordinary valid partition | `60` |
| `19.99`, `15` | fractional valid partition | `16.9915` |
| `-0.01`, `0` | amount immediately below boundary | `ValueError` |
| `100`, `-0.01` | percentage immediately below boundary | `ValueError` |
| `100`, `100.01` | percentage immediately above boundary | `ValueError` |

### Discount decision table

| Rule | `amount < 0` | `percentage < 0` | `percentage > 100` | Action |
| --- | --- | --- | --- | --- |
| 1 | no | no | no | calculate discounted amount |
| 2 | yes | either | either | raise `ValueError` |
| 3 | no | yes | no | raise `ValueError` |
| 4 | no | no | yes | raise `ValueError` |

## Email validation examples and properties

`validate_email` implements the deliberately small exercise specification: exactly one `@`; non-empty local and domain parts; a dot in the domain; and a top-level domain of at least two characters. It does not claim to implement the full email-address standard.

Example tests cover valid addresses, no or multiple `@` signs, empty local/domain parts, a missing dot, and empty or one-character TLDs. Three Hypothesis properties each use 125 generated examples:

1. Constructed addresses with non-empty local/domain labels and a two-or-more-character TLD are valid.
2. Strings with anything other than exactly one `@` are invalid.
3. Shortening a generated valid address's TLD to one character makes it invalid, exercising the TLD boundary through a transformation.

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

The chapter exercises have their own complete, reviewable cycle:

| Stage | Commit | Evidence |
| --- | --- | --- |
| Red | `5deff1a` | `pytest src/tests/test_lab9_chapter_exercises.py -q` failed at collection with `ModuleNotFoundError: No module named 'src.lab9_exercises'`. |
| Green | `fff2a57` | minimal discount and email implementations made the focused suite pass: `22 passed`. |
| Refactor | `f0b71f9` | email TLD validation was extracted into a named helper; the full suite remained green. |

## Saboteur and shrinking evidence

Temporary, uncommitted mutants were executed and removed before the final run. A discount mutant changed subtraction to addition, and the test for `(80, 25)` failed because it returned `100.0` rather than `60`. An email mutant accepted one-character TLDs; Hypothesis found and shrank the failing case to `0@0.A`. Neither mutant file is part of the branch.

## Local and CI command

```powershell
python -m pip install -r requirements-test.txt
python -m pytest src/tests -v --cov=src.fizzbuzz --cov=src.lab9_exercises --cov=app --cov-branch --cov-report=term-missing --cov-fail-under=90
```

The GitHub Actions workflow runs the same command on pull requests and pushes to `main`. Branch protection that requires the `Tests` check is a GitHub repository setting and must be enabled by a repository administrator.
