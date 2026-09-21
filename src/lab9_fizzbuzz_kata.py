"""A fresh FizzBuzz kata used to preserve Lab 9 TDD evidence."""


def fizzbuzz_kata(number: int) -> str:
    """Return the first FizzBuzz kata rule that applies."""
    if number % 3 == 0:
        return "Fizz"

    return str(number)
