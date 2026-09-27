import sys
from pathlib import Path

import pytest

# เพิ่ม path ของ stats-service
service_path = Path(__file__).resolve().parents[2] / "services" / "stats-service"
sys.path.insert(0, str(service_path))

from app import calculate_net_calories


@pytest.mark.parametrize(
    ("calories_in", "calories_out", "expected"),
    [
        (500, 300, 200),       # normal positive values
        (0, 300, -300),        # lower boundary of calories_in
        (500, 0, 500),         # lower boundary of calories_out
        (0, 0, 0),             # both boundaries together
        (125.5, 25.25, 100.25),  # valid fractional values
    ],
)
def test_calculate_net_calories_for_valid_partitions(
    calories_in, calories_out, expected
):
    # Arrange / Act
    result = calculate_net_calories(calories_in, calories_out)

    # Assert
    assert result == expected


@pytest.mark.parametrize(
    ("calories_in", "calories_out"),
    [
        (-0.01, 300),  # just below lower boundary for calories_in
        (500, -0.01),  # just below lower boundary for calories_out
        (-1, -1),      # both inputs in the invalid partition
    ],
)
def test_calculate_net_calories_rejects_negative_values(calories_in, calories_out):
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_net_calories(calories_in, calories_out)
