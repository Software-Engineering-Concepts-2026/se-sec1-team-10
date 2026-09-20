from hypothesis import given, strategies as st
from src.fizzbuzz import fizzbuzz


@given(st.integers(min_value=1, max_value=1000))
def test_fizzbuzz_property(number):
    result = fizzbuzz(number)

    if number % 15 == 0:
        assert result == "FizzBuzz"
    elif number % 5 == 0:
        assert result == "Buzz"
    elif number % 3 == 0:
        assert result == "Fizz"
    else:
        assert result == str(number)