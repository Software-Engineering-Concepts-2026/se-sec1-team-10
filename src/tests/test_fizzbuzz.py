from src.fizzbuzz import fizzbuzz


def test_fizzbuzz_3():
    # Arrange
    number = 3

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "Fizz"

def test_fizzbuzz_5():
    # Arrange
    number = 5

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "Buzz"

def test_fizzbuzz_15():
    # Arrange
    number = 15

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "FizzBuzz"

def test_fizzbuzz_7():
    # Arrange
    number = 7

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "7"

def test_fizzbuzz_1():
    # Arrange
    number = 1

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "1"

def test_fizzbuzz_2():
    # Arrange
    number = 2

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "2"

def test_fizzbuzz_9():
    # Arrange
    number = 9

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "Fizz"

def test_fizzbuzz_30():
    # Arrange
    number = 30

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "FizzBuzz"