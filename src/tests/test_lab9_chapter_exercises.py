import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from src.lab9_exercises import calculate_discount, validate_email


@pytest.mark.parametrize(
    ("amount", "percentage", "expected"),
    [
        (100, 0, 100),          # percentage lower boundary
        (100, 100, 0),          # percentage upper boundary
        (0, 25, 0),             # amount lower boundary
        (80, 25, 60),           # ordinary valid partition
        (19.99, 15, 16.9915),   # fractional valid partition
    ],
)
def test_calculate_discount_valid_equivalence_partitions(amount, percentage, expected):
    assert calculate_discount(amount, percentage) == pytest.approx(expected)


@pytest.mark.parametrize(
    "amount, percentage",
    [
        (-0.01, 0),     # amount just below its lower boundary
        (-0.01, 50),    # both inputs otherwise valid
        (100, -0.01),   # percentage just below its lower boundary
        (100, 100.01),  # percentage just above its upper boundary
    ],
)
def test_calculate_discount_rejects_invalid_boundaries(amount, percentage):
    with pytest.raises(ValueError):
        calculate_discount(amount, percentage)


@pytest.mark.parametrize(
    "email",
    [
        "ada@example.com",
        "first.last@sub.example.co.th",
        "a@b.io",
    ],
)
def test_validate_email_accepts_valid_partitions(email):
    assert validate_email(email) is True


@pytest.mark.parametrize(
    "email",
    [
        "plainaddress",       # no at sign
        "a@b@c.com",          # more than one at sign
        "@example.com",       # empty local part
        "ada@",               # empty domain
        "ada@example",        # domain has no dot
        "ada@example.",       # empty top-level domain
        "ada@example.c",      # top-level domain is too short
    ],
)
def test_validate_email_rejects_invalid_partitions(email):
    assert validate_email(email) is False


@settings(max_examples=125)
@given(
    local=st.text(
        alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
        min_size=1,
        max_size=12,
    ),
    domain=st.text(
        alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
        min_size=1,
        max_size=12,
    ),
    tld=st.text(
        alphabet=st.characters(whitelist_categories=("Ll", "Lu")),
        min_size=2,
        max_size=6,
    ),
)
def test_generated_well_formed_emails_are_valid(local, domain, tld):
    assert validate_email(f"{local}@{domain}.{tld}") is True


@settings(max_examples=125)
@given(st.text(min_size=0, max_size=30).filter(lambda value: value.count("@") != 1))
def test_strings_without_exactly_one_at_sign_are_invalid(email):
    assert validate_email(email) is False


@settings(max_examples=125)
@given(
    local=st.from_regex(r"[A-Za-z0-9]{1,12}", fullmatch=True),
    domain=st.from_regex(r"[A-Za-z0-9]{1,12}", fullmatch=True),
    tld=st.from_regex(r"[A-Za-z]{2,6}", fullmatch=True),
)
def test_shortening_a_valid_tld_to_one_character_makes_email_invalid(
    local, domain, tld
):
    email = f"{local}@{domain}.{tld}"
    shortened_tld_email = f"{local}@{domain}.{tld[0]}"

    assert validate_email(email) is True
    assert validate_email(shortened_tld_email) is False
