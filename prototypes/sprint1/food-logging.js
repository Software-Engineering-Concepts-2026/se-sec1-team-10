document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('foodImage');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  const photoContent = document.getElementById('photoContent');
  const ingredientList = document.querySelector('.ingredient-list');
  const addIngredientButton = document.querySelector('.add-ingredient');
  const mealSelect = document.getElementById('mealSelect');
  const mealInput = document.getElementById('mealType');
  const foodNameInput = document.getElementById('foodName');
  const macroInputs = ['carbs', 'sugar', 'protein', 'fat'].map((id) => document.getElementById(id));
  const calorieValue = document.getElementById('calorieValue');
  const saveButton = document.querySelector('.primary-button');

  function updateFormState() {
    const nameFilled = foodNameInput.value.trim().length > 0;
    const macroFilled = macroInputs.some((input) => Number(input.value || 0) > 0);
    const imageSelected = fileInput.files && fileInput.files.length > 0;
    saveButton.disabled = !(nameFilled && (macroFilled || imageSelected));
  }

  function updateNutritionSummary() {
    const [carbs, sugar, protein, fat] = macroInputs.map((input) => Number(input.value || 0));
    calorieValue.textContent = `${Math.round((carbs + sugar) * 4 + protein * 4 + fat * 9)} kcal`;
    updateFormState();
  }

  function createIngredientRow() {
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = '<input type="text" class="ingredient-input" placeholder="ชื่อวัตถุดิบ" /><input type="text" class="quantity-input" placeholder="กรัม" /><button type="button" class="remove-ingredient" aria-label="ลบ">×</button>';
    row.querySelector('.remove-ingredient').addEventListener('click', () => { row.remove(); updateFormState(); });
    ingredientList.appendChild(row);
    row.querySelector('.ingredient-input').focus();
  }

  mealSelect.addEventListener('change', () => { mealInput.value = mealSelect.value; });
  macroInputs.forEach((input) => input.addEventListener('input', updateNutritionSummary));
  foodNameInput.addEventListener('input', updateFormState);
  addIngredientButton.addEventListener('click', createIngredientRow);
  photoPlaceholder.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      photoPlaceholder.classList.remove('has-image');
      photoPlaceholder.style.backgroundImage = '';
      photoPlaceholder.style.borderStyle = 'dashed';
      photoContent.querySelector('.photo-card__label').textContent = 'แตะเพื่ออัปโหลดรูป';
      photoContent.querySelector('.photo-card__upload-button').textContent = '+ เลือกภาพ';
      updateFormState();
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      photoPlaceholder.style.backgroundImage = `url(${loadEvent.target.result})`;
      photoPlaceholder.style.backgroundSize = 'cover';
      photoPlaceholder.style.backgroundPosition = 'center';
      photoPlaceholder.style.borderStyle = 'solid';
      photoPlaceholder.classList.add('has-image');
      photoContent.querySelector('.photo-card__label').textContent = '';
      photoContent.querySelector('.photo-card__upload-button').textContent = '📷 เปลี่ยนรูป';
      updateFormState();
    };
    reader.readAsDataURL(file);
  });
  saveButton.addEventListener('click', () => alert(`บันทึกข้อมูล "${foodNameInput.value}" (${calorieValue.textContent}) เรียบร้อย!`));
  updateNutritionSummary();
});