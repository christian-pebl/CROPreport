# Blade Count Plot Implementation Plan

## 🎯 **Objective**
Implement full chart rendering functionality for the blade count analysis feature with professional visualization and interactivity.

## 📊 **Current Status**
- ✅ UI Controls: Two dropdowns with correct enabling/disabling logic
- ✅ Generate button: Activates when valid selections are made
- ✅ Basic infrastructure: CSV file loading foundation
- ❌ **Missing**: Actual data processing and chart rendering

---

## 🏗️ **Phase 1: Data Loading & Processing (Foundation)**

### **1.1 Enhance CSV File Detection**
**File**: `script.js` → `loadBladeCountData()` method
**Goal**: Better integration with existing file system

```javascript
async loadBladeCountData() {
    // First, check csvManager's loaded files
    let individFile = null;

    if (csvManager && csvManager.workingDirFiles) {
        individFile = csvManager.workingDirFiles.find(file =>
            file.name.includes('Crop_ALGA_2503_Indiv.csv') ||
            file.name.includes('Indiv.csv')
        );
    }

    if (!individFile) {
        // Show helpful error message about loading files
        throw new Error('Please load the Crop_ALGA_2503_Indiv.csv file using the "Select CSV Files" button first.');
    }

    return this.parseCSVFile(individFile);
}
```

### **1.2 Robust CSV Parsing**
**File**: `script.js` → `parseCSVFile()` method
**Goal**: Handle edge cases (empty cells, different delimiters, encoding)

```javascript
async parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;

                // Handle different line endings
                const lines = text.split(/\r\n|\n|\r/);

                // Parse header row
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

                const data = [];
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim()) {
                        // Handle quoted CSV values
                        const values = this.parseCSVLine(lines[i]);
                        const row = {};
                        headers.forEach((header, index) => {
                            row[header] = values[index] ? values[index].trim() : '';
                        });
                        data.push(row);
                    }
                }

                console.log(`Parsed ${data.length} rows from ${file.name}`);
                resolve(data);
            } catch (error) {
                reject(new Error(`Failed to parse CSV: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Helper method for proper CSV line parsing
parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}
```

---

## 🔄 **Phase 2: Data Aggregation Engine**

### **2.1 Enhanced Data Cleaning**
**File**: `script.js` → `cleanBladeCountData()` method
**Goal**: Handle real-world data messiness

```javascript
cleanBladeCountData(data) {
    console.log(`Starting with ${data.length} total rows`);

    const cleaned = data.filter(row => {
        // Drop summary rows (where subset is empty/NaN/null)
        if (!row.subset ||
            row.subset.trim() === '' ||
            row.subset.toLowerCase() === 'nan' ||
            row.subset.toLowerCase() === 'null') {
            return false;
        }

        // Keep only small/large subset values
        const subset = row.subset.toString().toLowerCase().trim();
        const isValidSubset = subset === 'small' || subset === 'large';

        // Also check that we have a valid sample ID
        const sampleId = row['sample ID'] || row.sampleId || row.sample_id;
        const hasValidSampleId = sampleId && sampleId.trim() !== '';

        return isValidSubset && hasValidSampleId;
    });

    console.log(`After cleaning: ${cleaned.length} blade records`);
    console.log(`Subset distribution:`, {
        small: cleaned.filter(r => r.subset.toLowerCase().trim() === 'small').length,
        large: cleaned.filter(r => r.subset.toLowerCase().trim() === 'large').length
    });

    return cleaned;
}
```

### **2.2 Robust Aggregation with Validation**
**File**: `script.js` → `aggregateBladeCountData()` method
**Goal**: Group by station and count blades per size class

```javascript
aggregateBladeCountData(data) {
    const grouped = {};
    const stationSet = new Set();

    // Group and count
    data.forEach(row => {
        const sampleId = row['sample ID'] || row.sampleId || row.sample_id;
        const subset = row.subset.toString().toLowerCase().trim();

        if (!sampleId) return;

        stationSet.add(sampleId);
        const key = `${sampleId}_${subset}`;
        grouped[key] = (grouped[key] || 0) + 1;
    });

    // Convert to structured format
    const stations = Array.from(stationSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const result = stations.map(station => {
        const smallCount = grouped[`${station}_small`] || 0;
        const largeCount = grouped[`${station}_large`] || 0;

        return {
            station: station,
            smallBlades: smallCount,
            largeBlades: largeCount,
            total: smallCount + largeCount
        };
    });

    console.log('Aggregated data:', result);
    return result;
}
```

---

## 🎨 **Phase 3: Professional Chart Rendering**

### **3.1 Enhanced Canvas Chart**
**File**: `script.js` → `renderBladeCountChart()` method
**Goal**: Create professional chart with download/export features

Replace the current placeholder `generateBladeCountChart()` method with full implementation.

---

## ⏱️ **Implementation Timeline**

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1** | 2-3 hours | ✅ Enhance CSV detection & parsing |
| **Phase 2** | 2 hours | ✅ Data cleaning & aggregation |
| **Phase 3** | 3-4 hours | ✅ Professional chart rendering |
| **Phase 4** | 1-2 hours | ✅ Interactivity & UX features |
| **Phase 5** | 1 hour | ✅ Error handling & polish |

**Total: 9-12 hours**

---

## 🧪 **Testing Checklist**

### **Data Validation Tests**
- [ ] Test with actual `Crop_ALGA_2503_Indiv.csv` file
- [ ] Test with missing/empty CSV data
- [ ] Test with malformed CSV (missing headers, wrong format)
- [ ] Verify counts match expected values from manual inspection

### **UI Flow Tests**
- [ ] Test Data Source dropdown: Indiv/Summary/Both
- [ ] Test Parameter dropdown enabling/disabling
- [ ] Test Generate button activation logic
- [ ] Test error messages and loading states

### **Chart Functionality Tests**
- [ ] Verify stacked bar chart renders correctly
- [ ] Test hover tooltips show correct data
- [ ] Test download PNG functionality
- [ ] Test export CSV functionality
- [ ] Verify chart matches specification (colors, grid, labels)

---

## 🚀 **Ready to Implement**

**Current Status**: UI Complete ✅
**Next Step**: Choose a phase to begin implementation
**Estimated Completion**: 1-2 development sessions

**Files to Modify**:
- `script.js` - Add/enhance methods
- `styles.css` - Add chart styling
- Test with your CSV files in `/CROPreport/` directory

---

*Generated by Claude Code - Ready for implementation when you are!*
