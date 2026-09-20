import sys
from pathlib import Path

# เพิ่ม path ของ stats-service
service_path = Path(__file__).resolve().parents[2] / "services" / "stats-service"
sys.path.insert(0, str(service_path))

from app import calculate_net_calories


def test_calories_are_valid():
    # Arrange
    calories_in = 500
    calories_out = 300

    # Act
    result = calculate_net_calories(calories_in, calories_out)

    # Assert
    assert result == 200


def test_calories_in_is_zero():
    # Arrange
    calories_in = 0
    calories_out = 300

    # Act
    result = calculate_net_calories(calories_in, calories_out)

    # Assert
    assert result == -300


def test_calories_out_is_zero():
    # Arrange
    calories_in = 500
    calories_out = 0

    # Act
    result = calculate_net_calories(calories_in, calories_out)

    # Assert
    assert result == 500


def test_calories_in_is_negative():
    # Arrange
    calories_in = -1
    calories_out = 300

    # Act & Assert
    try:
        calculate_net_calories(calories_in, calories_out)
        assert False
    except ValueError:
        assert True


def test_calories_out_is_negative():
    # Arrange
    calories_in = 500
    calories_out = -1

    # Act & Assert
    try:
        calculate_net_calories(calories_in, calories_out)
        assert False
    except ValueError:
        assert True