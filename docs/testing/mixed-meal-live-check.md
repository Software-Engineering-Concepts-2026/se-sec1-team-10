> **รายงานย้อนหลัง:** เก็บผลและขอบเขตของรอบเดิมไว้ ดูหลักฐาน CI/CD ล่าสุดที่บันทึกใน [คู่มือ CD](../deployment/continuous-deployment.md) โดยผลเก่าด้านล่างไม่ใช่การทดสอบรุ่นปัจจุบันซ้ำ

# Mixed meal live AI check

**Result: passed with one provider request. Original run date was not recorded in the safe result metadata; this is historical evidence, not a current provider check.** The test used a resized 768 × 576 version of a Wikimedia Commons photo showing chicken over rice. The original is [Home-cooked Hainanese chicken rice.jpg](https://commons.wikimedia.org/wiki/File:Home-cooked_Hainanese_chicken_rice.jpg), by Kcdtsg (David), released into the public domain. The resized JPEG was 108,411 characters as a data URL. The provider returned HTTP 200 and reported 5,556 prompt, 1,550 completion, and 7,106 total tokens.

The model classified the meal as `ข้าวราดไก่ต้ม` and returned three components:

- Cooked white rice, 300 g: exact USDA SR28 match, 130 kcal per 100 g; 390 kcal for the portion.
- Boiled chicken with bone, 180 g: AI estimate, 310 kcal; no exact catalog match.
- Chicken sauce, 25 g: AI estimate, 20 kcal; no exact catalog match.

The saved meal totaled 720 kcal. Halving only the rice from 300 g to 150 g kept the other portions unchanged and produced 525 kcal. The workflow checked all five nutrient values against each ingredient's own reference. It then removed the rice component, explicitly selected the cooked rice catalog item at 100 g, and saved a 460 kcal meal. Reloaded history contained the saved portions. Temporary user and meal records were cleaned up.

These amounts and calories are estimates, not measurements. A single photo cannot establish the edible chicken weight, bone fraction, cooking method, or sauce and fat recipe. Only the rice component had a catalog reference; the chicken and sauce retained AI estimates. Machine-readable safe evidence, including component references, match statuses, totals, and provider usage, is in `.local/mixed-meal-live-result.json`; the captured analysis is in `.local/mixed-meal-analysis.json`. The photo and live harness are kept under ignored `.local/`.

The focused catalog matcher suite passed: 11 tests across 2 files.
