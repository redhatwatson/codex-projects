# Feature Roadmap for Beili's Library

This document refines the next features around your real-world rotation workflow.

## 1) Keep this core feature

### Book cover scanner (title/author autofill)
- Use camera upload + OCR to read title/author from the cover.
- Show confidence score and let parent confirm/edit before saving.
- If multiple matches are found, show top 3 options.

---

## 2) Inventory model for rotation across zones

### Zones
- Play pen
- Bedroom
- Car
- Storage

### Book states
Each book should track:
- Current zone (`play_pen`, `bedroom`, `car`, `storage`)
- Last displayed date
- Last read date
- Read count
- Favorite flag (child-selected)
- Parent priority (optional pin)

### Rotation cadence
- Global cadence: weekly or monthly
- Optional per-zone cadence override
- One-click “Rotate now” (on-demand regardless of cadence)

---

## 3) Reading + favorites tracking

### Reading actions
- Quick "Mark as read" button increments read count.
- Optional mood reaction (Loved / Liked / Neutral).
- Track read history by date for trend charts.

### Favorites
- Favorite can be parent-marked and child-inferred:
  - parent toggle: immediate
  - inferred favorite: high reread count + positive reactions
- Add a “current favorites” shelf.

---

## 4) On-demand recommendation engine for rotation

When you click **Recommend rotation**, system should propose which books to place in each display zone.

### Inputs
- Target slots per zone (e.g., play pen 4, bedroom 3, car 2)
- Desired favorite ratio (e.g., 30%)
- Variety rule (minimum distinct genres/topics)
- Age appropriateness (2-year-old)

### Recommendation rules
1. **Guarantee comfort books**
   - Ensure at least 1 favorite appears in each active zone if available.
2. **Guarantee variety**
   - Prefer books with different genres/topics.
   - Avoid repeating the same title in consecutive rotations unless it is a favorite.
3. **Surface neglected books**
   - Prioritize books not displayed recently.
4. **Respect constraints**
   - Keep board-book durability preference for car/play pen.
   - Keep bedtime-appropriate titles for bedroom.

### Output
- A proposed shelf assignment by zone.
- “Why this pick” explanation (favorite, new genre, not shown recently, etc.).
- One-click apply to update zone assignments.

---

## 5) Suggested MVP implementation order

1. Add zone + cadence fields and rotation dashboard.
2. Add read tracking (`read_count`, `last_read_at`) and favorite toggle.
3. Add recommendation button with simple rules (favorite + variety + stale books).
4. Add scanner/OCR autofill.
5. Add analytics (coverage by genre, favorite retention, rotation freshness).
