def fizzbuzz(number):
    if isinstance(number, bool) or not isinstance(number, int):
        raise TypeError("number must be an integer")

    if number % 15 == 0:
        return "FizzBuzz"

    if number % 5 == 0:
        return "Buzz"

    if number % 3 == 0:
        return "Fizz"

    return str(number)
