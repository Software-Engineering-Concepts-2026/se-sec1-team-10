from hypothesis import given, settings
from hypothesis import strategies as st

from src.fizzbuzz import fizzbuzz


@settings(max_examples=150)
@given(st.integers(min_value=1, max_value=1_000).map(lambda factor: factor * 15))
def test_multiples_of_fifteen_are_fizzbuzz(number):
    assert fizzbuzz(number) == "FizzBuzz"


@settings(max_examples=150)
@given(
    st.tuples(st.integers(min_value=0, max_value=65), st.sampled_from([1, 2, 3, 4]))
    .map(lambda parts: (parts[0] * 5 + parts[1]) * 3)
)
def test_multiples_of_three_only_are_fizz(number):
    assert fizzbuzz(number) == "Fizz"


@settings(max_examples=150)
@given(
    st.tuples(st.integers(min_value=0, max_value=110), st.sampled_from([1, 2]))
    .map(lambda parts: (parts[0] * 3 + parts[1]) * 5)
)
def test_multiples_of_five_only_are_buzz(number):
    assert fizzbuzz(number) == "Buzz"


@settings(max_examples=150)
@given(
    st.tuples(
        st.integers(min_value=0, max_value=66),
        st.sampled_from([1, 2, 4, 7, 8, 11, 13, 14]),
    ).map(lambda parts: parts[0] * 15 + parts[1])
)
def test_other_positive_integers_are_returned_as_text(number):
    assert fizzbuzz(number) == str(number)
