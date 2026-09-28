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
        pytest.param(500, 300, 200, id="ordinary-calorie-totals"),
        pytest.param(125.5, 25.25, 100.25, id="fractional-calories"),
        pytest.param(0, 300, -300, id="zero-calories-in"),
        pytest.param(500, 0, 500, id="zero-calories-out"),
        pytest.param(0, 0, 0, id="both-inputs-at-zero"),
        pytest.param(250, 250, 0, id="equal-positive-inputs"),
    ],
)
def test_calculate_net_calories_for_valid_partitions(
    calories_in, calories_out, expected
):
    """Subtract non-negative calorie totals, including boundary values."""
    # Arrange
    totals = (calories_in, calories_out)

    # Act
    result = calculate_net_calories(*totals)

    # Assert
    assert result == expected


@pytest.mark.parametrize(
    ("calories_in", "calories_out"),
    [
        pytest.param(-0.01, 300, id="negative-calories-in"),
        pytest.param(500, -0.01, id="negative-calories-out"),
        pytest.param(-1, -1, id="both-inputs-negative"),
    ],
)
def test_calculate_net_calories_rejects_negative_values(calories_in, calories_out):
    """Reject negative inputs regardless of which total is invalid."""
    # Arrange
    totals = (calories_in, calories_out)

    # Act / Assert
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_net_calories(*totals)
