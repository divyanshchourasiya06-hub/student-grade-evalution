# ACADEX 2.0
### Autonomous Academic Evaluation & Student Merit Management Platform
*Technical Name: Student Grade Evaluation System 2.0*  
*Curriculum Standard: B.Tech Semester I &middot; Autonomous Institute Scheme &middot; Madhav Institute of Technology & Science (MITS), Gwalior*

---

## 1. Brand Identity & Overview

- **Product Brand Name**: **ACADEX**
- **Tagline**: *Precision Academic Evaluation & Student Merit Platform*
- **Brand Monogram**: Geometric Navy Shield with Academic Apex & Golden Crest Dot
- **Design Tokens & Palette**:
  - Main Background: `#F8F9FA` (Soft neutral grey)
  - Card & Surface: `#FFFFFF` (Pure white)
  - Primary Accent: `#12355B` (Muted Navy Blue)
  - Secondary / Hover: `#0E2A49`
  - Accent Trim / Conferred Status: `#C68A1B` (Academic Ochre Gold)
  - Charcoal Typography: Primary `#1F2937`, Secondary `#5B6678`, Muted `#8E99A8`
  - Subtle Borders: `#E5E8ED`
  - Status Palette: Qualified/Pass `#17803D`, Remedial/Fail `#B42318`, Incomplete `#9A5B00`
- **Typography**: IBM Plex Sans (Core Interface) and IBM Plex Mono (Enrollment, Codes, Scores, SGPA)

---

## 2. Core Functional Modules

### A. Academic Dashboard
- Real-time aggregate metric cards: Total Enrolled Candidates, Evaluated Cohort, Class Aggregate Percentage, Cohort Qualification Rate, Top Ranker SGPA.
- Grade distribution meter across institutional 10-point scale.
- Subject-wise average performance breakdown.
- Top ranker merit leaderboard with instant status badges.

### B. Candidate Directory (Student Management)
- Unique enrollment number enforcement with validation.
- Name, section, branch, and email registration.
- Advanced table controls: Instant search debounce, section filter, column sorting, pagination.
- Add and edit modal dialogs with input validation.
- CSV directory export with formula injection protection.

### C. Curriculum & Course Papers (Subject Management)
- Course code, course title, category (Theory / Practical / Project), credit weighting, and maximum marks.
- Validation ensuring course credits &gt; 0 and maximum marks &gt; 0.
- Automatic synchronization with all student evaluation sheets upon course creation or modification.

### D. Marks Evaluation & Entry Register
- Candidate selector with live profile summary.
- Per-cell instant marks validation (prevents negative scores or scores exceeding maximum marks).
- Live calculation of course percentage, qualitative letter grade, grade point, and qualification status.
- Credit-weighted SGPA calculation: `SGPA = Σ(Grade Point × Credits) / Σ(Credits)`.
- Evaluation status handling: distinguishes between `Draft`, `Incomplete`, `Fail (Remedial)`, and `Pass (Qualified)`.

### E. Class Results & Merit Standings
- Official class register with rank generation.
- Tie-breaking logic: candidates with equal SGPA are resolved using aggregate percentage.
- Status and candidate search filtering.
- One-click individual scorecards and class-wide merit registers in PDF format.

### F. Dedicated Student Portal
- Role-based portal view customized specifically for students:
  - Personal candidate card with enrollment and program details.
  - Complete course breakdown showing scored marks, max marks, credit weights, letter grade, and grade points.
  - Overall SGPA, aggregate marks, and cumulative percentage.
  - Download official certified transcript (PDF).
  - All admin controls, delete options, and peer private data are securely hidden.

### G. Class Analytics
- Statistical summary per course: evaluated count, average %, highest score, lowest score, and pass rate.
- Cohort qualification distribution (Passed vs Remedial vs Evaluation Pending).
- Remedial action watchlist: identifies candidates scoring below 40% in any course.

### H. 10-Point Ordinance Scale Configuration
- Institutional grading scale table.
- Editable minimum percentage thresholds and descriptive remarks.
- Instant recalculation across all active students and merit ranks upon configuration save.

### I. Institutional Audit Trail
- Tamper-evident activity log tracking:
  - Candidate registration, updates, and removals.
  - Subject modifications and credit updates.
  - Marks evaluations recorded.
  - Results publication toggling.
  - Ordinance threshold changes.

### J. Examination Result Lifecycle (Draft vs Published)
- Official publication state management (`isPublished`).
- Administrative control to publish or reopen semester evaluations.
- Transcripts stamped with "CERTIFIED & OFFICIALLY PUBLISHED" when finalized.

---

## 3. Calculation Formulas

1. **Course Percentage**:
   $$\text{Percentage} = \left(\frac{\text{Marks Scored}}{\text{Maximum Marks}}\right) \times 100$$

2. **Letter Grade & Grade Point Allocation (Default 10-Point Ordinance)**:
   - $90\% - 100\% \implies \mathbf{A+}$ (Grade Point: $10$, Outstanding)
   - $80\% - 89.99\% \implies \mathbf{A}$ (Grade Point: $9$, Excellent)
   - $70\% - 79.99\% \implies \mathbf{B+}$ (Grade Point: $8$, Very Good)
   - $60\% - 69.99\% \implies \mathbf{B}$ (Grade Point: $7$, Good)
   - $50\% - 59.99\% \implies \mathbf{C+}$ (Grade Point: $6$, Above Average)
   - $45\% - 49.99\% \implies \mathbf{C}$ (Grade Point: $5$, Average)
   - $40\% - 44.99\% \implies \mathbf{D}$ (Grade Point: $4$, Pass)
   - $< 40\% \implies \mathbf{F}$ (Grade Point: $0$, Fail / Remedial)

3. **Semester Grade Point Average (SGPA)**:
   $$\text{SGPA} = \frac{\sum_{i=1}^{n} (\text{Grade Point}_i \times \text{Credits}_i)}{\sum_{i=1}^{n} \text{Credits}_i}$$

4. **Aggregate Percentage**:
   $$\text{Aggregate } \% = \left(\frac{\sum \text{Marks Scored}}{\sum \text{Maximum Marks}}\right) \times 100$$

---

## 4. File Structure

```
student/
├── index.html       # Complete Acadex 2.0 Web Application (Single-File / Zero-Dependency)
├── student.html     # Identical runnable copy for direct desktop launching
├── README.md        # This technical documentation and ordinance specification
├── backend/         # Complete Node.js + Express + Prisma + TypeScript full-stack backend
│   ├── prisma/schema.prisma
│   ├── src/index.ts
│   ├── src/services/gradingEngine.ts
│   ├── tests/gradingEngine.test.ts
│   └── package.json
└── frontend/        # Complete React 18 + Vite + Tailwind CSS frontend
    ├── src/App.tsx
    ├── src/pages/
    └── package.json
```

---

## 5. How to Run

1. **Direct Browser Execution**:
   Double click `student.html` or `index.html` on your Desktop. It runs in any web browser without server setup.

2. **Local HTTP Server**:
   ```bash
   # From Desktop/student
   python -m http.server 8080
   ```
   Open `http://localhost:8080/index.html` in Chrome, Firefox, Safari, or Edge.

---

## 6. Theme System & Ergonomics (Light, Dark, and System Default)

Acadex 2.0 features an integrated Theme Engine designed for low eye strain during long grading sessions:

### 1. Tri-State Mode Selector
Located in the top header navigation:
- **Light Mode (`light`)**: Clean, crisp academic register styling using high-contrast slate ink on `#F7F8FA` surfaces.
- **Dark Mode (`dark`)**: Subdued, low-glare dark palette using deep navy/slate tones (`#111318` background, `#171A21` sidebar, `#1B1F27` cards) with crisp `#E8EBF0` typography.
- **System Default (`system`)**: Synchronizes dynamically with the operating system preference via `window.matchMedia('(prefers-color-scheme: dark)')`. Listens in real-time to OS theme changes.

### 2. Zero-Flash Pre-Render Initialization
To eliminate unsightly white flashes (FOUC) when loading in dark mode, an inline script executes in `<head>` before the DOM renders:
```javascript
(function() {
  var stored = localStorage.getItem("acadex_theme") || "light";
  var dark = stored === "dark" || (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
})();
```

### 3. Theme-Aware Design Tokens
| CSS Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--bg` | `#F7F8FA` | `#111318` | Application Canvas |
| `--sidebar-bg` | `#FFFFFF` | `#171A21` | Institutional Navigation Sidebar |
| `--surface` | `#FFFFFF` | `#1B1F27` | Content Surface Cards & Panels |
| `--surface-alt` | `#F1F3F6` | `#222733` | Data Table Headers & Shaded Strips |
| `--border` | `#E5E8ED` | `#303642` | Hairline Structural Dividers |
| `--ink-primary` | `#202733` | `#E8EBF0` | Primary Headings & Bold Text |
| `--ink-secondary`| `#687386` | `#A0A8B7` | Subheadings & Analytical Labels |
| `--navy` | `#12355B` | `#5A85B8` | Primary Brand Blue & Focus Rings |
| `--ok` / `--bad` | `#17803D` / `#B42318` | `#38B264` / `#E55C52` | Qualified vs Remedial Badges |

---

*ACADEX &middot; Autonomous Grade Evaluation & Merit System 2.0*
