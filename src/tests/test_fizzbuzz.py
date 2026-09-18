from src.fizzbuzz import fizzbuzz


def test_fizzbuzz_3():
    # Arrange
    number = 3

    # Act
    result = fizzbuzz(number)

    # Assert
    assert result == "Fizz"