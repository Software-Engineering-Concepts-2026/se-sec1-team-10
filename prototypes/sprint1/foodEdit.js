document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("foodEditForm");

    const imageInput = document.getElementById("imageInput");
    const foodImage = document.getElementById("foodImage");
    const imagePlaceholder = document.getElementById("imagePlaceholder");


    // =========================
    // เลือกรูปภาพจากเครื่อง
    // =========================

    if (imageInput) {

        imageInput.addEventListener("change", function () {

            const file = this.files[0];

            if (!file) {
                return;
            }

            // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
            if (!file.type.startsWith("image/")) {

                alert("กรุณาเลือกไฟล์รูปภาพ");

                this.value = "";

                return;
            }


            // แสดงรูปที่เลือก
            const imageURL = URL.createObjectURL(file);

            foodImage.src = imageURL;

            foodImage.style.display = "block";

            if (imagePlaceholder) {
                imagePlaceholder.style.display = "none";
            }

        });

    }


    // =========================
    // บันทึกข้อมูล
    // =========================

    if (form) {

        form.addEventListener("submit", function (event) {

            event.preventDefault();


            const foodName =
                document.getElementById("foodName");

            const quantity =
                document.getElementById("quantity");

            const calories =
                document.getElementById("calories");

            const carbs =
                document.getElementById("carbs");

            const protein =
                document.getElementById("protein");

            const fat =
                document.getElementById("fat");


            // ตรวจสอบชื่ออาหาร
            if (foodName.value.trim() === "") {

                alert("กรุณากรอกชื่ออาหาร");

                foodName.focus();

                return;
            }


            // ตรวจสอบปริมาณ
            if (quantity.value === "" || quantity.value < 0) {

                alert("กรุณากรอกปริมาณอาหารให้ถูกต้อง");

                quantity.focus();

                return;
            }


            // ตรวจสอบแคลอรี
            if (calories.value === "" || calories.value < 0) {

                alert("กรุณากรอกค่าแคลอรีให้ถูกต้อง");

                calories.focus();

                return;
            }


            // ตรวจสอบสารอาหาร
            if (
                carbs.value < 0 ||
                protein.value < 0 ||
                fat.value < 0
            ) {

                alert("ค่าสารอาหารต้องไม่ติดลบ");

                return;
            }


            alert("บันทึกการแก้ไขเรียบร้อยแล้ว");

        });

    }

});


// =========================
// เลือกมื้ออาหาร
// =========================

function selectMeal(button) {

    const buttons =
        document.querySelectorAll(".meal-button");

    buttons.forEach(function (item) {

        item.classList.remove("active");

    });

    button.classList.add("active");

}


// =========================
// แก้ไขรูปภาพ
// =========================

function editImage() {

    const imageInput =
        document.getElementById("imageInput");

    if (imageInput) {

        imageInput.click();

    }

}


// =========================
// ลบรายการอาหาร
// =========================

function deleteFood() {

    const confirmDelete = confirm(
        "ต้องการลบรายการอาหารนี้หรือไม่?"
    );


    if (confirmDelete) {

        alert("ลบรายการอาหารเรียบร้อยแล้ว");

    }

}