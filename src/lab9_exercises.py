"""Small standalone functions used by the Lab 9 testing exercises."""


def calculate_discount(amount, percentage):
    """Return ``amount`` after applying a percentage discount.

    ``amount`` must be non-negative and ``percentage`` must be between 0 and
    100 inclusive.
    """
    if amount < 0 or not 0 <= percentage <= 100:
        raise ValueError("amount must be non-negative and percentage must be 0 through 100")

    return amount * (100 - percentage) / 100


def validate_email(email):
    """Return whether *email* meets the deliberately small Lab 9 specification."""
    if email.count("@") != 1:
        return False

    local, domain = email.split("@")
    if not local or not domain or "." not in domain:
        return False

    return len(domain.rsplit(".", 1)[1]) >= 2
