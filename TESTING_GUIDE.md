# Card Cash-Out Testing Guide

## 🚀 Server Status
✅ Frontend: http://localhost:3001
✅ Backend: http://localhost:8080 (should already be running)

## 📋 Complete Testing Checklist

### Pre-Testing Setup
1. Open browser: http://localhost:3001
2. Login to the system
3. Navigate to "💳 Card Cash-Out (Iran)" transaction type

---

## 🧪 Test Suite 1: Core Bug Fixes

### Test 1.1: Recent Recipients Hidden ✅
**Expected**: Recent Recipients section should NOT appear for Card Cash-Out
**Steps**:
1. Select transaction type: "💳 Card Cash-Out (Iran)"
2. Scroll down below sender phone field
3. Look for "Recent Recipients" section

**✅ Pass**: Section is completely hidden
**❌ Fail**: "Recent Recipients" buttons are visible

---

### Test 1.2: Card Currency Auto-Set to IRR ✅
**Expected**: Card currency automatically set to IRR, field hidden
**Steps**:
1. Select transaction type: "💳 Card Cash-Out (Iran)"
2. Scroll to "Amount and Currency" section
3. Look for "Card Currency" field

**✅ Pass**: 
- Only "Amount" field visible (no currency selector next to it)
- Card currency is IRR in the background
- Only "Cash Given Currency" selector is visible

**❌ Fail**: Two currency fields are visible

---

### Test 1.3: Correct Math (Division) ✅
**Expected**: 84,100 Toman ÷ 84,100 rate = 1.00 CAD

**Steps**:
1. Enter Card Amount: `84100` (or `84,100`)
2. Select Cash Given Currency: `CAD`
3. Enter Exchange Rate: `84100`
4. Check live preview below form
5. Click "Review Transaction" button
6. Check preview dialog

**✅ Pass**: Shows "Customer Receives: 1.00 CAD"
**❌ Fail**: Shows huge number like 7,076,810,000

**Additional Test Cases**:
- 168,200 ÷ 84,100 = 2.00 CAD ✅
- 42,050 ÷ 84,100 = 0.50 CAD ✅
- 10,000 ÷ 84,100 = 0.12 CAD ✅

---

### Test 1.4: Improved Field Labels ✅
**Expected**: Clear, contextual labels

**Steps**:
1. Look at form field labels
2. Check for helpful hints

**✅ Pass**:
- "Cardholder Name" (not "Sender Name")
- "Cardholder Phone"
- "Card Amount (Toman)" with emoji 💳
- Hint text: "Amount customer swiped on their Iranian card"
- "Cash Given Currency" (not confusing "Receiver Currency")

**❌ Fail**: Generic labels like "Sender" or "Amount"

---

## 🧪 Test Suite 2: New Features

### Test 2.1: Quick Rate Buttons ✅
**Expected**: One-click rate selection

**Steps**:
1. Select "Cash Given Currency": `CAD`
2. Scroll to "Exchange Rate" field
3. Look for quick rate buttons below input

**✅ Pass**:
- Buttons visible: 80,000 / 84,100 / 85,000 / 90,000
- Clicking button fills exchange rate field
- Label says "Quick rates:"

**Test Different Currencies**:
- USD: Should show 68,000 / 69,500 / 71,000
- EUR: Should show 75,000 / 77,000 / 79,000
- Other currencies: No quick buttons (or default CAD rates)

---

### Test 2.2: Auto-Load Last Used Rate ✅
**Expected**: Last rate automatically fills

**Steps**:
1. Complete a Card Cash-Out transaction with CAD at rate 84,100
2. Start a new Card Cash-Out transaction
3. Select "Cash Given Currency": `CAD`
4. Check if exchange rate field auto-fills

**✅ Pass**: Rate 84,100 appears automatically
**❌ Fail**: Rate field is empty

---

### Test 2.3: Duplicate Transaction Warning ⚠️
**Expected**: Warning appears for duplicate within 10 minutes

**Steps**:
1. Complete transaction: Customer "John Doe", amount 84,100 Toman
2. Immediately create another transaction
3. Search and select same customer "John Doe"
4. Enter same amount: 84,100
5. Look for yellow warning alert

**✅ Pass**: 
- Yellow alert appears
- Shows: "Duplicate Transaction Warning"
- Details: "John Doe, 84,100 Toman, X minutes ago"

**❌ Fail**: No warning appears

---

### Test 2.4: Max Transaction Limit Warning 💰
**Expected**: Orange alert for amounts > 100 million Toman

**Steps**:
1. Enter Card Amount: `150000000` (150 million)
2. Look for orange alert below transaction type

**✅ Pass**:
- Orange alert appears
- Text: "High Amount Alert"
- Message mentions 100M threshold and compliance

**Test Edge Cases**:
- 99,999,999 Toman: No alert ✅
- 100,000,001 Toman: Alert appears ✅

---

### Test 2.5: Auto-Focus Amount Field 🎯
**Expected**: Amount field focuses after customer selection

**Steps**:
1. Start typing in Cardholder Phone field
2. Select a customer from search results
3. Observe cursor position

**✅ Pass**: Cursor automatically moves to Card Amount field
**❌ Fail**: Cursor stays in phone field or goes nowhere

---

### Test 2.6: Rate Auto-Save to History 💾
**Expected**: Rates are saved and available in rate history

**Steps**:
1. Enter exchange rate: 85,000
2. Look for "Rate History" dropdown near exchange rate field
3. Complete transaction
4. Start new transaction
5. Check rate history dropdown

**✅ Pass**: 
- Rate 85,000 appears in history
- Can select from history
- Most recent rates at top

---

## 🧪 Test Suite 3: UI/UX Validation

### Test 3.1: Live Calculation Preview 📊
**Expected**: Real-time calculation display

**Steps**:
1. Enter Card Amount: 84,100
2. Enter Exchange Rate: 84,100
3. Select Cash Given Currency: CAD
4. Look at calculation preview area

**✅ Pass**:
- Shows "Card Swiped: 84,100 Toman" in purple box
- Shows "Cash Given: 1.00 CAD" in green box
- Rate displayed: "@ 84,100 = 1 CAD"

---

### Test 3.2: Form Spacing and Layout 📐
**Expected**: Clean, well-spaced form

**Visual Checklist**:
- [ ] Fields are well-aligned
- [ ] Labels are bold and easy to read
- [ ] Buttons have consistent spacing
- [ ] No overlapping elements
- [ ] Mobile responsive (if testing on smaller screen)

---

### Test 3.3: Keyboard Navigation ⌨️
**Expected**: Tab order makes sense

**Steps**:
1. Click Cardholder Name field
2. Press Tab repeatedly
3. Verify tab order

**Ideal Order**:
1. Cardholder Name
2. Cardholder Phone
3. (ID Type - optional)
4. (ID Number - optional)
5. Transaction Type
6. Card Amount
7. Cash Given Currency
8. Exchange Rate
9. Fees
10. Notes
11. Submit button

---

## 🧪 Test Suite 4: Regression Testing

### Test 4.1: Walk-In Exchange Still Works 💱
**Steps**:
1. Select transaction type: "💱 Walk-In Exchange"
2. Enter amount: 100 CAD
3. Enter rate: 1.35
4. Check calculation

**✅ Pass**: Shows 135 (multiplication, not division)

---

### Test 4.2: Send to Branch Still Works 📤
**Steps**:
1. Select transaction type: "📤 Send to Branch"
2. Check if recipient fields are visible
3. Check if Recent Recipients section appears

**✅ Pass**: 
- Recipient Name field visible
- Recipient Phone field visible
- Recent Recipients section visible

---

### Test 4.3: Bank Transfer Still Works 🏦
**Steps**:
1. Select transaction type: "🏦 Bank Transfer (Iran)"
2. Check for IBAN field
3. Check for recipient info fields

**✅ Pass**: All bank transfer specific fields visible

---

## 🧪 Test Suite 5: Error Handling

### Test 5.1: Empty Fields Validation
**Expected**: Cannot submit with empty required fields

**Steps**:
1. Leave Cardholder Name empty
2. Try to submit
3. Check for error message

**✅ Pass**: Browser validation or error toast appears

---

### Test 5.2: Invalid Phone Number
**Expected**: Validation for phone format

**Steps**:
1. Enter invalid phone: "123"
2. Try to submit
3. Check for error

**✅ Pass**: Error message about phone format

---

### Test 5.3: Zero or Negative Amounts
**Expected**: Cannot enter invalid amounts

**Steps**:
1. Try to enter: 0
2. Try to enter: -100

**✅ Pass**: Either prevented or validated with error

---

## 🧪 Test Suite 6: Complete Flow Test

### End-to-End Card Cash-Out Transaction 🎬

**Scenario**: Customer "Ahmad Rezaei" swipes 168,200 Toman, receives 2.00 CAD

**Steps**:
1. Navigate to Send Pickup page
2. Select transaction type: "💳 Card Cash-Out (Iran)"
3. Enter Cardholder Name: "Ahmad Rezaei"
4. Enter Cardholder Phone: "9123456789"
5. (Optional) Enter ID Type: Passport, ID Number: AB1234567
6. Enter Card Amount: 168200
7. Select Cash Given Currency: CAD
8. Click quick rate button: 84,100 (or enter manually)
9. Verify live preview shows: 2.00 CAD
10. Enter Fees: 0
11. Enter Notes: "Card cash-out test"
12. Click "Review Transaction"
13. Verify preview dialog:
    - Cardholder Name: Ahmad Rezaei
    - Cardholder Phone: 9123456789
    - Card Swiped: 168,200 Toman
    - Cash Given: 2.00 CAD
    - Rate: 84,100 Toman = 1 CAD
14. Click "Confirm & Create"
15. Wait for success message
16. Verify transaction appears in pending pickups

**✅ Complete Pass**: All steps work smoothly, correct calculation, transaction created

---

## 📊 Testing Results Template

```
Date: ___________
Tester: ___________
Browser: ___________ (Chrome/Safari/Firefox)

Test Suite 1: Bug Fixes
[  ] 1.1 Recent Recipients Hidden
[  ] 1.2 Card Currency Auto-Set
[  ] 1.3 Correct Math (Division)
[  ] 1.4 Improved Labels

Test Suite 2: New Features
[  ] 2.1 Quick Rate Buttons
[  ] 2.2 Auto-Load Last Rate
[  ] 2.3 Duplicate Warning
[  ] 2.4 Max Limit Warning
[  ] 2.5 Auto-Focus Amount
[  ] 2.6 Rate Auto-Save

Test Suite 3: UI/UX
[  ] 3.1 Live Preview
[  ] 3.2 Form Layout
[  ] 3.3 Keyboard Navigation

Test Suite 4: Regression
[  ] 4.1 Walk-In Exchange
[  ] 4.2 Send to Branch
[  ] 4.3 Bank Transfer

Test Suite 5: Error Handling
[  ] 5.1 Empty Fields
[  ] 5.2 Invalid Phone
[  ] 5.3 Invalid Amounts

Test Suite 6: End-to-End
[  ] 6.1 Complete Transaction

Overall Status: PASS / FAIL
Notes: ___________
```

---

## 🐛 Bug Report Template

If you find any issues:

```
**Bug Title**: [Short description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**: 

**Actual Result**: 

**Screenshot**: [Attach if possible]

**Browser**: Chrome/Safari/Firefox/Edge
**Version**: 

**Additional Notes**: 
```

---

## ✅ Quick Smoke Test (2 minutes)

Fastest way to verify core functionality:

1. ✅ Open http://localhost:3001
2. ✅ Login
3. ✅ Navigate to Card Cash-Out
4. ✅ Check: No "Recent Recipients"
5. ✅ Check: Only one currency field (amount)
6. ✅ Enter: 84,100 amount, 84,100 rate, CAD currency
7. ✅ Verify: Shows 1.00 CAD (not billions)
8. ✅ Check: Quick rate buttons visible
9. ✅ Complete: Submit transaction
10. ✅ Success: Transaction created

**All 10 steps pass? ✅ Implementation successful!**

---

## 📞 Support

For questions or issues:
- Check `CARD_SWAP_IMPROVEMENTS.md` for implementation details
- Review code comments in `frontend/app/(dashboard)/send-pickup/page.tsx`
- Console logs may provide debugging info (F12 Developer Tools)

Happy Testing! 🎉
