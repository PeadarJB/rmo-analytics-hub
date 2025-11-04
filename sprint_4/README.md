# Sprint 4: Local Authority Performance - Complete Documentation

**Section 4: Local Authority Performance Tables**  
**Package Version**: 1.0  
**Status**: ✅ Production Ready  
**Date**: November 4, 2025

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Component Reference](#component-reference)
6. [Data Flow](#data-flow)
7. [Customization](#customization)
8. [Performance](#performance)
9. [Troubleshooting](#troubleshooting)
10. [Testing](#testing)

---

## 🎯 Overview

Sprint 4 implements **Section 4: Local Authority Performance** from the 2018 Regional Road Report. This section provides comprehensive performance analysis at the Local Authority level, showing both average values and condition class distributions for all key performance indicators.

### What's Included

**6 Performance Tables:**
- **Table 4.1**: Average condition parameters for all 6 KPIs by LA
- **Table 4.2**: IRI condition class distribution (% in each class)
- **Table 4.3**: Rut Depth condition class distribution
- **Table 4.4**: PSCI condition class distribution
- **Table 4.5**: CSC condition class distribution
- **Table 4.6**: MPD condition class distribution

### Key Features

✅ Sortable tables with 31 Local Authorities  
✅ CSV export for external analysis  
✅ Tabbed interface for easy navigation  
✅ Parallel data fetching for performance  
✅ Responsive design with horizontal scrolling  
✅ Complete documentation and examples

---

## 🌟 Features

### Table 4.1: Average Values

**Displays:**
- Local Authority name
- Average IRI (International Roughness Index)
- Average Rut Depth
- Average CSC (SCRIM Coefficient)
- Average MPD (Mean Profile Depth)
- Average PSCI (Pavement Surface Condition Index)
- Average LPV3 (Longitudinal Profile Variance)
- Total road length surveyed

**Functionality:**
- Sort by any column
- View all 31 LAs
- Export to CSV
- Pagination (15 rows per page)

### Tables 4.2-4.6: Condition Class Distributions

**Displays (for each KPI):**
- Local Authority name
- % in Very Good condition
- % in Good condition
- % in Fair condition
- % in Poor condition
- % in Very Poor condition
- % Fair or Better (combined metric)

**Functionality:**
- Tabbed interface for each KPI
- Sort by any column
- Export each table to CSV
- Instant tab switching (data pre-loaded)

---

## 🏗️ Architecture

### Component Hierarchy

```
Section4 (Container)
└── LAPerformanceTables
    ├── Table 4.1: Average Values
    └── Tabs (4.2-4.6)
        ├── IRI Conditions
        ├── Rut Conditions
        ├── PSCI Conditions
        ├── CSC Conditions
        └── MPD Conditions
```

### File Structure

```
src/components/report/section4/
├── Section4.tsx                  # Container component (~100 LOC)
├── LAPerformanceTables.tsx       # Tables component (~450 LOC)
└── index.ts                      # Barrel exports

src/pages/RegionalReport2025/
└── index.tsx                     # Updated report page
```

### Data Flow

```
1. User navigates to Section 4
   ↓
2. Section4 component renders
   ↓
3. LAPerformanceTables receives roadLayer
   ↓
4. Parallel data fetching:
   - fetchAveragesByLA()
   - fetchConditionClassesByLA()
   ↓
5. Data processing:
   - Group by Local Authority
   - Calculate averages/percentages
   - Sort alphabetically
   ↓
6. Render tables with data
   ↓
7. User can sort, export, navigate tabs
```

---

## 📦 Installation

### Prerequisites

- Node.js 16+
- React 18+
- TypeScript 4.5+
- Ant Design 5+
- ArcGIS Maps SDK for JavaScript 4.28+

### Dependencies

**No new dependencies required!** Sprint 4 uses only existing packages.

### Installation Steps

1. **Create directory:**
```bash
mkdir -p src/components/report/section4
```

2. **Copy component files:**
```bash
cp section4/*.tsx src/components/report/section4/
cp section4/index.ts src/components/report/section4/
```

3. **Update report page:**
```bash
cp RegionalReport2025/index.tsx src/pages/RegionalReport2025/
```

4. **Verify integration:**
```bash
npm run dev
```

---

## 📖 Component Reference

### Section4 Component

**Purpose**: Container component for Section 4 with header, context, and tables

**Props:**
```typescript
interface Section4Props {
  roadLayer: __esri.FeatureLayer | null;
}
```

**Usage:**
```typescript
import { Section4 } from '@/components/report/section4';

<Section4 roadLayer={roadLayer} />
```

**Features:**
- Section header with title and description
- Key metrics overview
- Performance variation alert
- Integrated LAPerformanceTables component

---

### LAPerformanceTables Component

**Purpose**: Fetches and displays all 6 performance tables

**Props:**
```typescript
interface LAPerformanceTablesProps {
  roadLayer: __esri.FeatureLayer | null;
}
```

**State:**
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [averageData, setAverageData] = useState<AverageByLA[]>([]);
const [conditionData, setConditionData] = useState<Record<KPIKey, ConditionClassByLA[]>>({...});
```

**Key Methods:**

```typescript
// Fetch all data in parallel
fetchAllData(): Promise<void>

// Fetch average values
fetchAveragesByLA(): Promise<AverageByLA[]>

// Fetch condition class distributions
fetchConditionClassesByLA(): Promise<Record<KPIKey, ConditionClassByLA[]>>

// Fetch for single KPI
fetchConditionClassForKPI(kpi, fieldName): Promise<ConditionClassByLA[]>

// Export to CSV
exportToCSV(data, filename): void

// Render tables
renderAverageTable(): JSX.Element
renderConditionTable(kpi, tableNumber): JSX.Element
```

---

## 🔄 Data Flow

### Query Strategy

**Optimization**: Parallel execution minimizes total load time

```typescript
// Single Promise.all for both data sets
const [avgData, condData] = await Promise.all([
  fetchAveragesByLA(),      // ~5 seconds
  fetchConditionClassesByLA() // ~25 seconds (5 KPIs × 5s each)
]);
// Total: ~25 seconds (not 30!)
```

### Field Mapping

**Required fields in shapefile:**
- `LA` - Local Authority name
- `AIRI_2025` - IRI values
- `LRUT_2025` - Rut Depth values
- `CSC_2025` - SCRIM Coefficient values
- `MPD_2025` - Mean Profile Depth values
- `ModeRating_2025` - PSCI values
- `LPV3_2025` - LPV3 values
- `Shape_Length` - Segment length (for weighting)

### Calculation Methods

**Average Values (Table 4.1):**
```typescript
// Simple arithmetic mean
average = sum(values) / count(values)

// Weighted by segment length
totalLength = sum(Shape_Length) / 1000  // Convert to km
```

**Condition Class Percentages (Tables 4.2-4.6):**
```typescript
// Group segments by condition class
veryGoodLength = sum(lengths where class == 'Very Good')

// Calculate percentage
veryGoodPercent = (veryGoodLength / totalLength) * 100

// Fair or Better
fairOrBetter = veryGood + good + fair
```

---

## 🎨 Customization

### Styling

**Change table appearance:**
```typescript
// In LAPerformanceTables.tsx
<Table
  size="middle"              // "small", "middle", "large"
  bordered={false}           // Remove borders
  pagination={{ pageSize: 20 }} // More rows
/>
```

**Custom colors:**
```typescript
// In Section4.tsx
<Alert
  type="info"               // "success", "warning", "error"
  style={{ background: '#e6f7ff' }}
/>
```

### Content

**Modify descriptions:**
```typescript
// In Section4.tsx
const kpiDescriptions = {
  iri: 'Your custom description here...',
  rut: 'Your custom description here...',
  // ...
};
```

**Change table titles:**
```typescript
// In LAPerformanceTables.tsx
title="Table 4.1: Your Custom Title"
```

### Functionality

**Add filtering:**
```typescript
// In LAPerformanceTables.tsx, add to Table props
filters={[
  { text: 'Dublin Region', value: 'Dublin' },
  { text: 'Cork Region', value: 'Cork' }
]}
onFilter={(value, record) => 
  record.localAuthority.includes(value as string)
}
```

**Add row highlighting:**
```typescript
// Highlight rows with poor performance
onRow={(record) => ({
  style: {
    background: record.iri > 5 ? '#fff1f0' : undefined
  }
})}
```

---

## ⚡ Performance

### Load Times

**Expected performance** (based on ~3,500 road segments, 31 LAs):

| Operation | Time | Queries |
|-----------|------|---------|
| Fetch averages | 5-10s | 1 query |
| Fetch condition classes | 15-30s | 5 queries |
| **Total initial load** | **20-40s** | **6 queries** |
| Tab switching | Instant | 0 queries |
| Sorting | Instant | 0 queries |
| CSV export | <1s | 0 queries |

### Optimization Strategies

**1. Server-side pre-aggregation:**
```typescript
// Instead of client-side grouping, query pre-aggregated data
query.outStatistics = [{
  statisticType: 'avg',
  onStatisticField: 'AIRI_2025',
  outStatisticFieldName: 'avg_iri'
}];
query.groupByFieldsForStatistics = ['LA'];
```

**2. Client-side caching:**
```typescript
// Cache results in component state
const [cache, setCache] = useState<Cache>({});

if (cache.averages) {
  return cache.averages; // Return immediately
}
```

**3. Progressive loading:**
```typescript
// Load Table 4.1 first, then others
useEffect(() => {
  fetchAveragesByLA().then(setAverageData);
}, []);

useEffect(() => {
  // Load condition tables after averages
  if (averageData.length > 0) {
    fetchConditionClassesByLA().then(setConditionData);
  }
}, [averageData]);
```

### Query Optimization

**Current approach** (client-side grouping):
```typescript
// Single query, get all features, group in memory
query.where = 'AIRI_2025 IS NOT NULL';
query.outFields = ['LA', 'AIRI_2025', 'Shape_Length'];
// Returns ~3,500 features, groups to 31 LAs
```

**Optimized approach** (server-side grouping):
```typescript
// Statistical query, get aggregated results directly
query.outStatistics = [{
  statisticType: 'avg',
  onStatisticField: 'AIRI_2025',
  outStatisticFieldName: 'avg_iri'
}];
query.groupByFieldsForStatistics = ['LA'];
// Returns 31 features directly
```

---

## 🐛 Troubleshooting

### Issue: Tables show no data

**Symptoms:**
- Tables render but show "No data"
- Loading completes without errors

**Causes:**
1. Road layer not loaded
2. Field names don't match
3. No data for 2025

**Solutions:**
```typescript
// 1. Verify layer loaded
console.log('Road layer:', roadLayer);

// 2. Check field names
const query = roadLayer.createQuery();
query.where = '1=1';
query.outFields = ['*'];
query.num = 1;
const result = await roadLayer.queryFeatures(query);
console.log('Fields:', Object.keys(result.features[0].attributes));

// 3. Verify 2025 data exists
query.where = 'AIRI_2025 IS NOT NULL';
const count = await roadLayer.queryFeatureCount(query);
console.log('Features with 2025 data:', count);
```

---

### Issue: Slow loading (>60 seconds)

**Causes:**
1. Slow network connection
2. Large dataset
3. ArcGIS service issues

**Solutions:**
```typescript
// 1. Implement caching
const cachedData = localStorage.getItem('la-performance');
if (cachedData) {
  return JSON.parse(cachedData);
}

// 2. Add timeout handling
const timeout = setTimeout(() => {
  setError('Data loading is taking longer than expected...');
}, 30000); // 30 second warning

// 3. Add retry logic
let retries = 0;
while (retries < 3) {
  try {
    return await fetchData();
  } catch (err) {
    retries++;
    await new Promise(r => setTimeout(r, 1000 * retries));
  }
}
```

---

### Issue: Incorrect percentages

**Symptoms:**
- Percentages don't add up to 100%
- Negative percentages

**Causes:**
1. Rounding errors
2. Missing data
3. Incorrect length calculations

**Solution:**
```typescript
// Verify calculations
const total = data.veryGood + data.good + data.fair + data.poor + data.veryPoor;
console.log('Total percentage:', total); // Should be ~100

// Check for missing segments
const totalLength = data.total;
const summedLength = data.veryGood + data.good + data.fair + 
                     data.poor + data.veryPoor;
console.log('Length match:', totalLength === summedLength);
```

---

### Issue: CSV export fails

**Symptoms:**
- Button clicks but no download
- Console errors

**Solutions:**
```typescript
// 1. Check browser settings
// Ensure pop-ups and downloads allowed

// 2. Add error handling
const exportToCSV = (data, filename) => {
  try {
    const csvContent = /* ... */;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    // ...download logic
  } catch (err) {
    console.error('Export failed:', err);
    message.error('Failed to export CSV');
  }
};

// 3. Verify data exists
if (data.length === 0) {
  message.warning('No data to export');
  return;
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
// Test average calculations
describe('fetchAveragesByLA', () => {
  it('should calculate correct averages', async () => {
    const mockLayer = createMockLayer([
      { LA: 'Dublin', AIRI_2025: 3.0, Shape_Length: 100 },
      { LA: 'Dublin', AIRI_2025: 5.0, Shape_Length: 100 }
    ]);
    
    const result = await fetchAveragesByLA(mockLayer);
    
    expect(result[0].iri).toBe(4.0); // (3.0 + 5.0) / 2
  });
});

// Test condition class calculation
describe('fetchConditionClassForKPI', () => {
  it('should calculate correct percentages', async () => {
    const mockLayer = createMockLayer([
      { LA: 'Dublin', AIRI_2025: 2.5, Shape_Length: 100 }, // Very Good
      { LA: 'Dublin', AIRI_2025: 3.5, Shape_Length: 100 }  // Good
    ]);
    
    const result = await fetchConditionClassForKPI('iri', 'AIRI_2025');
    
    expect(result[0].veryGood).toBe(50);
    expect(result[0].good).toBe(50);
  });
});
```

### Integration Tests

```typescript
// Test full component rendering
describe('Section4', () => {
  it('should render all tables', async () => {
    const { getByText, getAllByRole } = render(
      <Section4 roadLayer={mockRoadLayer} />
    );
    
    await waitFor(() => {
      expect(getByText('Table 4.1')).toBeInTheDocument();
      expect(getByText('Table 4.2')).toBeInTheDocument();
    });
    
    const tables = getAllByRole('table');
    expect(tables).toHaveLength(6); // 1 average + 5 condition tables
  });
});
```

### Manual Testing Checklist

**Data Loading:**
- [ ] Loading spinner appears
- [ ] Data loads within 60 seconds
- [ ] No console errors
- [ ] All 31 LAs appear

**Table 4.1:**
- [ ] Shows 8 columns
- [ ] All columns sortable
- [ ] Values appear reasonable
- [ ] CSV export works

**Tables 4.2-4.6:**
- [ ] 5 tabs appear
- [ ] Tab switching is instant
- [ ] Each table shows 31 LAs
- [ ] Percentages are reasonable
- [ ] "Fair or Better" column correct
- [ ] CSV export works for each

**Functionality:**
- [ ] Column sorting works
- [ ] Pagination works
- [ ] Responsive on different screens
- [ ] No memory leaks on repeated use

---

## 📊 Data Validation

### Sanity Checks

Run these checks to verify data accuracy:

**1. Percentage sum:**
```typescript
// Each row should sum to ~100%
const sum = row.veryGood + row.good + row.fair + row.poor + row.veryPoor;
assert(sum >= 99 && sum <= 101, 'Percentages should sum to 100');
```

**2. Fair or Better:**
```typescript
// Should equal sum of top 3 classes
const calculated = row.veryGood + row.good + row.fair;
assert(row.fairOrBetter === calculated, 'Fair or Better mismatch');
```

**3. Value ranges:**
```typescript
// IRI typically 2.5 - 6.0 for most LAs
assert(row.iri >= 2.0 && row.iri <= 8.0, 'IRI out of expected range');

// Rut typically 4 - 15 mm
assert(row.rut >= 2.0 && row.rut <= 20.0, 'Rut out of expected range');

// PSCI typically 6.0 - 8.5
assert(row.psci >= 4.0 && row.psci <= 10.0, 'PSCI out of expected range');
```

---

## 📚 Additional Resources

### Related Documentation
- [Sprint 0: Setup & Routing](../sprint0/README.md)
- [Sprint 1: Network Overview](../sprint1/README.md)
- [Sprint 2: Methodology](../sprint2/README.md)
- [Sprint 3: National Results](../sprint3/README.md)

### External Resources
- [Ant Design Table Component](https://ant.design/components/table/)
- [ArcGIS JS API QueryFeatures](https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-FeatureLayer.html#queryFeatures)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

---

## 📝 Changelog

### Version 1.0 (November 4, 2025)
- ✅ Initial release
- ✅ Implements all 6 tables (4.1-4.6)
- ✅ Parallel data fetching
- ✅ CSV export functionality
- ✅ Comprehensive documentation

---

## 🎓 Best Practices

### Code Organization
- Keep data fetching separate from rendering
- Use TypeScript interfaces for type safety
- Implement error boundaries
- Add loading states

### Performance
- Fetch data in parallel when possible
- Cache results to avoid re-fetching
- Use pagination for large datasets
- Implement virtualization for very large tables

### User Experience
- Show loading indicators
- Provide clear error messages
- Enable keyboard navigation
- Make tables accessible (ARIA labels)

---

**Sprint 4 Complete!** You now have comprehensive Local Authority performance analysis integrated into your report. 🎉
