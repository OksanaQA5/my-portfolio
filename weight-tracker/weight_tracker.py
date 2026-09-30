#!/usr/bin/env python3
"""
weight_tracker.py — CLI-версія трекера ваги, жиру та кроків.

Дані зберігаються у двох CSV-файлах поряд зі скриптом:
  weights.csv  — date,time,weight,fat,fat_source
  steps.csv    — date,steps

Приклади використання:
  python weight_tracker.py add --date 2026-09-06 --weight 69.5
  python weight_tracker.py add --date 2026-09-06 --time 08:15 --weight 69.5 --fat 35.0
  python weight_tracker.py steps --date 2026-09-06 --steps 8500
  python weight_tracker.py list
  python weight_tracker.py chart
  python weight_tracker.py chart --from 2026-08-01 --to 2026-09-30 --out august.png
"""

import argparse
import csv
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_FILE = os.path.join(BASE_DIR, "weights.csv")
STEPS_FILE = os.path.join(BASE_DIR, "steps.csv")
STEPS_START_DATE = "2026-09-06"  # кроки ведуться лише починаючи з цієї дати

WEIGHTS_HEADER = ["date", "time", "weight", "fat", "fat_source"]
STEPS_HEADER = ["date", "steps"]


def ensure_files():
    if not os.path.exists(WEIGHTS_FILE):
        with open(WEIGHTS_FILE, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(WEIGHTS_HEADER)
    if not os.path.exists(STEPS_FILE):
        with open(STEPS_FILE, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(STEPS_HEADER)


def read_weights():
    ensure_files()
    rows = []
    with open(WEIGHTS_FILE, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append({
                "date": r["date"],
                "time": r["time"] or "00:00",
                "weight": float(r["weight"]),
                "fat": float(r["fat"]) if r["fat"] not in ("", None) else None,
                "fat_source": r["fat_source"] or "measured",
            })
    rows.sort(key=lambda r: (r["date"], r["time"]))
    return rows


def read_steps():
    ensure_files()
    rows = []
    with open(STEPS_FILE, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append({"date": r["date"], "steps": int(r["steps"])})
    rows.sort(key=lambda r: r["date"])
    return rows


def write_weights(rows):
    with open(WEIGHTS_FILE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=WEIGHTS_HEADER)
        w.writeheader()
        for r in rows:
            w.writerow({
                "date": r["date"], "time": r["time"], "weight": r["weight"],
                "fat": "" if r["fat"] is None else r["fat"],
                "fat_source": r["fat_source"],
            })


def write_steps(rows):
    with open(STEPS_FILE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=STEPS_HEADER)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def estimate_fat(weight, measured_rows):
    """Проста лінійна регресія fat = a*weight + b за виміряними точками."""
    pts = [(r["weight"], r["fat"]) for r in measured_rows if r["fat"] is not None and r["fat_source"] == "measured"]
    if len(pts) < 2:
        return None
    n = len(pts)
    sx = sum(p[0] for p in pts)
    sy = sum(p[1] for p in pts)
    sxy = sum(p[0]*p[1] for p in pts)
    sxx = sum(p[0]*p[0] for p in pts)
    denom = (n*sxx - sx*sx)
    if denom == 0:
        return None
    a = (n*sxy - sx*sy) / denom
    b = (sy - a*sx) / n
    return round(a*weight + b, 1)


def cmd_add(args):
    rows = read_weights()
    fat = args.fat
    fat_source = "measured"
    if fat is None:
        fat = estimate_fat(args.weight, rows)
        fat_source = "estimated" if fat is not None else "measured"
    rows.append({
        "date": args.date, "time": args.time or "00:00",
        "weight": args.weight, "fat": fat, "fat_source": fat_source,
    })
    write_weights(rows)
    label = f"{fat}% (оцінка)" if fat_source == "estimated" else (f"{fat}%" if fat is not None else "—")
    print(f"Додано: {args.date} {args.time or '00:00'} — {args.weight} кг, жир {label}")


def cmd_steps(args):
    if args.date < STEPS_START_DATE:
        print(f"Увага: кроки ведуться з {STEPS_START_DATE}. Запис все одно буде збережено.")
    rows = read_steps()
    rows = [r for r in rows if r["date"] != args.date]  # replace same-day entry
    rows.append({"date": args.date, "steps": args.steps})
    write_steps(rows)
    print(f"Збережено кроки: {args.date} — {args.steps}")


def cmd_list(args):
    rows = read_weights()
    if not rows:
        print("Записів ще немає.")
        return
    prev = None
    for r in rows:
        dw = "" if prev is None else f" ({'+' if r['weight']-prev['weight']>=0 else ''}{round(r['weight']-prev['weight'],2)})"
        fat_str = "—" if r["fat"] is None else f"{r['fat']}%"
        est = " [оцінка]" if r["fat_source"] == "estimated" else ""
        print(f"{r['date']} {r['time']:>5}  {r['weight']:>6} кг{dw:<8}  жир {fat_str}{est}")
        prev = r


def cmd_chart(args):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.dates as mdates
    except ImportError:
        print("Потрібен matplotlib: pip install -r requirements.txt")
        return

    rows = read_weights()
    if args.from_date:
        rows = [r for r in rows if r["date"] >= args.from_date]
    if args.to_date:
        rows = [r for r in rows if r["date"] <= args.to_date]
    if len(rows) < 2:
        print("Потрібно щонайменше два записи ваги для побудови графіка у вибраному діапазоні.")
        return

    dates = [datetime.strptime(f"{r['date']} {r['time']}", "%Y-%m-%d %H:%M") for r in rows]
    weights = [r["weight"] for r in rows]
    fat_rows = [(d, r["fat"], r["fat_source"]) for d, r in zip(dates, rows) if r["fat"] is not None]

    steps_rows = [r for r in read_steps() if r["date"] >= STEPS_START_DATE]
    if args.from_date:
        steps_rows = [r for r in steps_rows if r["date"] >= args.from_date]
    if args.to_date:
        steps_rows = [r for r in steps_rows if r["date"] <= args.to_date]

    fig, ax1 = plt.subplots(figsize=(10, 5), facecolor="white")
    ax1.set_facecolor("white")

    # Excel-style horizontal gridlines only
    ax1.grid(axis="y", color="#D9D9D9", linewidth=1, zorder=0)
    for spine in ["top", "right"]:
        ax1.spines[spine].set_visible(False)
    for spine in ["left", "bottom"]:
        ax1.spines[spine].set_color("#BFBFBF")

    ax1.plot(dates, weights, color="#2F6F62", linewidth=2.2, marker="o",
              markerfacecolor="white", markeredgecolor="#2F6F62", markersize=5, label="Вага, кг", zorder=3)
    ax1.set_ylabel("Вага, кг", color="#2F6F62")
    ax1.tick_params(axis="y", labelcolor="#2F6F62")

    if fat_rows:
        ax2 = ax1.twinx()
        ax2.spines["top"].set_visible(False)
        fd = [r[0] for r in fat_rows]
        fv = [r[1] for r in fat_rows]
        fs = [r[2] for r in fat_rows]
        ax2.plot(fd, fv, color="#B8843A", linewidth=2.2, zorder=3, label="Жир, %")
        for d, v, src in zip(fd, fv, fs):
            face = "white" if src == "estimated" else "#B8843A"
            ax2.plot(d, v, marker="o", markerfacecolor=face, markeredgecolor="#B8843A", markersize=5, zorder=4)
        ax2.set_ylabel("Жир, %", color="#B8843A")
        ax2.tick_params(axis="y", labelcolor="#B8843A")

    if steps_rows:
        sd = [datetime.strptime(r["date"], "%Y-%m-%d") for r in steps_rows]
        sv = [r["steps"] for r in steps_rows]
        ax3 = ax1.twinx()
        ax3.spines["right"].set_position(("outward", 60))
        ax3.spines["top"].set_visible(False)
        ax3.bar(sd, sv, width=0.6, color="#8FAECF", alpha=0.55, zorder=1, label="Кроки")
        ax3.set_ylabel("Кроки", color="#5B7DA0")
        ax3.tick_params(axis="y", labelcolor="#5B7DA0")

    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%d.%m"))
    fig.autofmt_xdate()
    ax1.set_title("Діаграма змін по датах", loc="left", color="#1B2B29", fontsize=13, fontweight="bold")

    lines, labels = ax1.get_legend_handles_labels()
    if fat_rows:
        l2, la2 = ax2.get_legend_handles_labels()
        lines += l2; labels += la2
    ax1.legend(lines, labels, loc="upper left", frameon=False, fontsize=9)

    fig.tight_layout()
    out = args.out or "chart.png"
    fig.savefig(out, dpi=150)
    print(f"Графік збережено: {out}")


def main():
    parser = argparse.ArgumentParser(description="Трекер ваги, жиру та кроків (CLI)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser("add", help="Додати запис ваги")
    p_add.add_argument("--date", required=True, help="YYYY-MM-DD")
    p_add.add_argument("--time", default=None, help="HH:MM (за замовчуванням 00:00)")
    p_add.add_argument("--weight", required=True, type=float)
    p_add.add_argument("--fat", type=float, default=None, help="Якщо не вказано — розраховується автоматично")
    p_add.set_defaults(func=cmd_add)

    p_steps = sub.add_parser("steps", help="Додати кроки за день")
    p_steps.add_argument("--date", required=True, help="YYYY-MM-DD")
    p_steps.add_argument("--steps", required=True, type=int)
    p_steps.set_defaults(func=cmd_steps)

    p_list = sub.add_parser("list", help="Показати історію записів")
    p_list.set_defaults(func=cmd_list)

    p_chart = sub.add_parser("chart", help="Побудувати графік (PNG)")
    p_chart.add_argument("--from", dest="from_date", default=None, help="YYYY-MM-DD")
    p_chart.add_argument("--to", dest="to_date", default=None, help="YYYY-MM-DD")
    p_chart.add_argument("--out", default=None, help="Шлях до файлу PNG (за замовчуванням chart.png)")
    p_chart.set_defaults(func=cmd_chart)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
