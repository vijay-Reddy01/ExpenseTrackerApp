import sys
import json
import argparse
from collections import defaultdict

parser = argparse.ArgumentParser(description="Analyze expenses for a user")
parser.add_argument("--email", required=True, help="User email")
parser.add_argument("--period", choices=["week", "month"], required=True, help="Analysis period")
parser.add_argument("--salary", type=float, default=0, help="User salary")
args = parser.parse_args()

# Read expenses from stdin
try:
    raw = sys.stdin.read().strip()
    expenses = json.loads(raw) if raw else []
except Exception as e:
    print(json.dumps({"error": f"Failed to parse expenses JSON: {str(e)}"}))
    sys.exit(1)

# Aggregate totals by category
category_totals = defaultdict(float)
total_spend = 0.0

for exp in expenses:
    amt = float(exp.get("amount", 0) or 0)
    cat = exp.get("category", "Uncategorized") or "Uncategorized"
    category_totals[cat] += amt
    total_spend += amt

income = float(args.salary or 0)
remaining = income - total_spend

def pct_of_income(amount: float):
    if income <= 0:
        return None
    return round((amount / income) * 100, 1)

# Group categories by salary-per-category percent
low_items = []
medium_items = []
high_items = []

for cat, spend in category_totals.items():
    pct = pct_of_income(spend)
    item = {"category": cat, "spend": round(spend, 2), "pctOfIncome": pct}

    if pct is None:
        # Still show categories even if salary is not set
        low_items.append(item)
    else:
        if pct <= 10:
            low_items.append(item)
        elif pct <= 25:
            medium_items.append(item)
        else:
            high_items.append(item)

# Sort groups
low_items.sort(key=lambda x: x["spend"], reverse=True)
medium_items.sort(key=lambda x: x["spend"], reverse=True)
high_items.sort(key=lambda x: x["spend"], reverse=True)

# AI suggestion string (UI expects a single text)
suggestions = []
if income > 0:
    if total_spend > income:
        suggestions.append("Your total expenses exceed your salary. Consider budgeting more strictly.")

    if high_items:
        top = high_items[0]
        suggestions.append(
            f"High spending detected in {top['category']} (~{top['pctOfIncome']}% of salary). Try setting a category cap."
        )
    elif medium_items:
        top = medium_items[0]
        suggestions.append(
            f"Moderate spending on {top['category']} (~{top['pctOfIncome']}% of salary). Track it weekly to prevent overspending."
        )
    else:
        suggestions.append("Your spending is under control. Keep tracking regularly.")
else:
    suggestions.append("Add your monthly salary in Profile to unlock % based insights & AI suggestions.")

suggestion_text = " ".join(suggestions).strip()

result = {
    "totalSpend": round(total_spend, 2),
    "income": round(income, 2),
    "remaining": round(remaining, 2),
    "grouped": {
        "low": low_items,
        "medium": medium_items,
        "high": high_items
    },
    "suggestion": suggestion_text
}

print(json.dumps(result))
