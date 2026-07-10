document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector("form");

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const inputs = form.querySelectorAll("input");

        // Check for empty fields
        for (const input of inputs) {
            if (input.value.trim() === "") {
                alert("Please fill in all fields.");
                return;
            }
        }

        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        alert("Registration successful! (This is a prototype)");
    });
});