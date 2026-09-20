function validateFoodData(food) {

    if (!food.name || food.name.trim() === "") {
        return false;
    }

    if (food.calories < 0) {
        return false;
    }

    if (food.carbs < 0) {
        return false;
    }

    if (food.protein < 0) {
        return false;
    }

    if (food.fat < 0) {
        return false;
    }

    return true;
}