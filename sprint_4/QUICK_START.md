# Sprint 4: Quick Start Guide
**Get Section 4 running in 5-10 minutes**

---

## ⚡ Prerequisites

Before starting, ensure you have:
- ✅ Sprint 0 (routing) completed
- ✅ Access to your project codebase
- ✅ ArcGIS WebMap with road data
- ✅ 10 minutes of time

---

## 🚀 Installation Steps

### Step 1: No New Dependencies! 🎉

Sprint 4 uses **only existing packages**. No `npm install` needed!

---

### Step 2: Create Directory Structure

```bash
# Navigate to your project root
cd your-project-root

# Create section4 directory
mkdir -p src/components/report/section4
```

---

### Step 3: Copy Component Files

Copy these 3 files to `src/components/report/section4/`:

1. **LAPerformanceTables.tsx** - Main tables component
2. **Section4.tsx** - Section container  
3. **index.ts** - Barrel exports

```bash
# From the sprint package
cp section4/*.tsx src/components/report/section4/
cp section4/index.ts src/components/report/section4/
```

---

### Step 4: Update Regional Report Page

Replace your `src/pages/RegionalReport2025/index.tsx` with the updated version from this package:

```bash
cp RegionalReport2025/index.tsx src/pages/RegionalReport2025/
```

**What this updates:**
- Adds Section 4 import
- Adds "Section 4: LA Performance" menu item
- Adds Section 4 to the render switch

---

### Step 5: Test the Integration

```bash
# Start your dev server
npm run dev

# Navigate to the report
# Open: http://localhost:5173/report-2025
```

**Testing checklist:**
- [ ] Report page loads without errors
- [ ] Section 4 appears in navigation menu
- [ ] Clicking Section 4 loads the tables
- [ ] Table 4.1 shows average values
- [ ] Tabs show condition class tables
- [ ] CSV export buttons work
- [ ] Tables are sortable

---

## 📊 What You Should See

### Table 4.1: Average Values
- 31 rows (one per Local Authority)
- 8 columns (LA name + 6 KPIs + Length)
- Sortable columns
- Export button

### Tables 4.2-4.6: Condition Classes
- Tabbed interface (IRI, Rut, PSCI, CSC, MPD)
- 31 rows per table
- 7 columns (LA name + 5 classes + Fair or Better)
- Sortable columns
- Export buttons

---

## 🐛 Troubleshooting

### Issue: Module not found errors

**Solution**: Check import paths match your project structure

```typescript
// Verify these imports work:
import { KPIKey, KPI_LABELS } from '@/config/kpiConfig';
import { getConditionClassName } from '@/utils/conditionClassHelpers';
```

---

### Issue: Tables show no data

**Possible causes:**
1. Road layer not loaded
2. Field names don't match your data
3. WebMap ID incorrect

**Solution**: Check browser console for errors and verify:
```typescript
// In your data, these fields should exist:
- AIRI_2025
- LRUT_2025
- CSC_2025
- MPD_2025
- ModeRating_2025
- LPV3_2025
- LA (Local Authority field)
```

---

### Issue: Slow loading times

**Expected**: 20-40 seconds for all tables  
**Acceptable**: Up to 60 seconds on slow networks

**If slower than 60 seconds:**
1. Check network connection
2. Verify ArcGIS service health
3. Consider implementing caching

---

### Issue: CSV export doesn't work

**Solution**: Check browser allows downloads and verify you're clicking the export button after data loads.

---

## 🎯 Verification Steps

Run through this checklist to confirm everything works:

### Navigation
- [ ] Report page loads
- [ ] Section 4 menu item visible
- [ ] Clicking Section 4 switches view

### Data Loading
- [ ] Loading spinner appears
- [ ] Tables populate with data
- [ ] All 31 LAs appear in each table

### Functionality
- [ ] Table 4.1 shows correct averages
- [ ] Tabs switch between KPI tables
- [ ] Column sorting works
- [ ] CSV export works for each table

### Performance
- [ ] Initial load < 60 seconds
- [ ] Tab switching is instant
- [ ] No console errors

---

## 🔧 Customization Options

### Change Table Styling

Edit `LAPerformanceTables.tsx`:

```typescript
// Change table size
size="small"  // Options: "small", "middle", "large"

// Change pagination
pagination={{ pageSize: 15 }}  // Adjust rows per page
```

---

### Modify Export Filename

Edit the `exportToCSV` function calls:

```typescript
exportToCSV(averageData, 'custom_name_2025.csv')
```

---

### Adjust Loading Message

Edit `Section4.tsx`:

```typescript
<Spin size="large" tip="Your custom message..." />
```

---

## 📈 Performance Tips

### For Faster Loading:

1. **Pre-calculate on server**: Have your GIS service pre-aggregate LA statistics
2. **Implement caching**: Cache results client-side for repeat views
3. **Add pagination**: For very large datasets (>100 LAs)

### Example Caching:

```typescript
// In LAPerformanceTables component
const [cachedData, setCachedData] = useState<{
  averages?: AverageByLA[];
  conditions?: Record<KPIKey, ConditionClassByLA[]>;
}>({});

// Check cache before fetching
if (cachedData.averages && cachedData.conditions) {
  setAverageData(cachedData.averages);
  setConditionData(cachedData.conditions);
  return;
}
```

---

## ✅ Success Criteria

Your integration is successful when:

- [x] No build errors
- [x] Section 4 navigates correctly
- [x] All 6 tables display data
- [x] Tables are sortable
- [x] CSV export works
- [x] Load time < 60 seconds

---

## 📚 Next Steps

After Sprint 4 is working:

1. **Test with real users**: Get feedback on table usefulness
2. **Monitor performance**: Track load times
3. **Consider enhancements**:
   - Add filtering by region
   - Add comparison mode
   - Add drill-down to route details
4. **Plan Sprint 5**: Next section implementation

---

## 🆘 Still Having Issues?

1. Check [README.md](README.md) for detailed docs
2. Review [FILE_STRUCTURE.md](FILE_STRUCTURE.md) for architecture
3. See [SPRINT_4_SUMMARY.md](SPRINT_4_SUMMARY.md) for overview
4. Verify prerequisites are met
5. Check browser console for errors

---

**Congratulations!** You've integrated Sprint 4: Local Authority Performance! 🎉

**Next**: Consider implementing Sprint 5 or enhancing existing sections.
