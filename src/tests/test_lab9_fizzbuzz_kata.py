"""Fresh Lab 9 FizzBuzz kata; this does not replace src.fizzbuzz."""

import pytest

from src.lab9_fizzbuzz_kata import fizzbuzz_kata


@pytest.mark.parametrize(
    ("number", "expected"),
    [
        (1, "1"),
        (2, "2"),
    ],
)
def test_ordinary_numbers_are_returned_as_text(number, expected):
    assert fizzbuzz_kata(number) == expected


@pytest.mark.parametrize("number", [3, 6, 9])
def test_multiples_of_three_are_fizz(number):
    assert fizzbuzz_kata(number) == "Fizz"
