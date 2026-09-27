"""A fresh FizzBuzz kata used to preserve Lab 9 TDD evidence."""

_RULES = ((3, "Fizz"), (5, "Buzz"))


def fizzbuzz_kata(number: int) -> str:
    """Return the concatenated labels for applicable kata rules."""
    labels = "".join(label for divisor, label in _RULES if number % divisor == 0)
    return labels or str(number)
