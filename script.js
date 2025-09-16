class CSVManager {
    constructor() {
        this.csvData = [];
        this.headers = [];
        this.fileName = '';
        this.workingDirFiles = [];
        this.fileInfos = new Map(); // Map of baseName -> {original, std, hr24}
        this.showWorkingDirModal = true;
        
        this.initializeEventListeners();
        this.initializeWorkingDirModal();
    }

    initializeEventListeners() {
        const exportBtn = document.getElementById('exportBtn');

        // Export functionality
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportCSV();
            });
        }

        // File info toggle functionality
        const fileInfoToggle = document.getElementById('fileInfoToggle');
        if (fileInfoToggle) {
            fileInfoToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('fileInfoDropdown');
                dropdown.classList.toggle('hidden');
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('fileInfoDropdown');
            const toggle = document.getElementById('fileInfoToggle');
            
            if (dropdown && !dropdown.contains(e.target) && !toggle.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Change working directory button
        const changeWorkingDirBtn = document.getElementById('changeWorkingDirBtn');
        if (changeWorkingDirBtn) {
            changeWorkingDirBtn.addEventListener('click', () => {
                this.showWorkingDirModal = true;
                const modal = document.getElementById('workingDirModal');
                modal.classList.remove('hidden');
            });
        }

        // Add file button
        const addFileBtn = document.getElementById('addFileBtn');
        const csvFileInput = document.getElementById('csvFile');
        if (addFileBtn && csvFileInput) {
            addFileBtn.addEventListener('click', () => {
                csvFileInput.click();
            });
            
            csvFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileUpload(file);
                    // Clear the input so the same file can be selected again
                    e.target.value = '';
                }
            });
        }

        // Toggle view button functionality (table ↔ plot)
        const toggleViewBtn = document.getElementById('toggleViewBtn');
        const toggleTableBtn = document.getElementById('toggleTableBtn');
        
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', () => {
                const plotSection = document.getElementById('plotSection');
                const tableSection = document.getElementById('tableSection');
                const confirmSavePlotBtn = document.getElementById('confirmSavePlotBtn');
                
                // Switch from table to plot
                this.renderPlotWithVariableSelection();
                toggleViewBtn.textContent = '📄 Show Table';
                
                // Show confirm save button in plot section if we have pending conversion
                if (this.pendingConversion) {
                    confirmSavePlotBtn.style.display = 'inline-block';
                }
            });
        }
        
        if (toggleTableBtn) {
            toggleTableBtn.addEventListener('click', () => {
                const confirmSaveBtn = document.getElementById('confirmSaveBtn');
                const toggleViewBtn = document.getElementById('toggleViewBtn');
                
                // Switch from plot to table
                this.renderTable();
                toggleViewBtn.textContent = '📊 Show Plot';
                
                // Show confirm save button in table section if we have pending conversion
                if (this.pendingConversion) {
                    confirmSaveBtn.style.display = 'inline-block';
                }
            });
        }

        // Confirm save button functionality
        const confirmSaveBtn = document.getElementById('confirmSaveBtn');
        const confirmSavePlotBtn = document.getElementById('confirmSavePlotBtn');
        
        const handleConfirmSave = () => {
            if (!this.pendingConversion) return;
            
            const { fileName, suffix, baseName, fileInfo } = this.pendingConversion;
            
            // Show confirmation dialog with directory guidance
            this.showDirectorySaveConfirmation(fileName, suffix, baseName, fileInfo, () => {
                // Save the file
                this.autoSaveConvertedFile(fileName, suffix);
                
                // Create a mock file object and add to fileInfo
                const mockFile = this.createMockFileFromCurrentData(fileName);
                fileInfo.versions.set(suffix, mockFile);
                
                // Add the new file to working directory files for plot page
                if (this.workingDirFiles && !this.workingDirFiles.find(f => f.name === fileName)) {
                    this.workingDirFiles.push(mockFile);
                    console.log(`Added ${fileName} to working directory files`);
                }
                
                // Update UI
                this.renderFileBrowser();
                this.showSuccess(`Saved ${fileName} successfully! Remember to save in your original CSV directory.`);
                
                // Update plot page if navigation manager exists
                if (typeof navigationManager !== 'undefined' && navigationManager.updatePlotPageFileInfo) {
                    // Fire and forget - don't await to avoid blocking the UI
                    navigationManager.updatePlotPageFileInfo().catch(console.error);
                    console.log('Updated plot page file info after creating new file');
                }
                
                // Hide buttons and clear pending conversion
                confirmSaveBtn.style.display = 'none';
                confirmSavePlotBtn.style.display = 'none';
                document.getElementById('toggleViewBtn').style.display = 'none';
                this.pendingConversion = null;
                
                // Reset title
                document.getElementById('dataTitle').textContent = this.fileName || 'CSV Data';
            });
        };
        
        if (confirmSaveBtn) {
            confirmSaveBtn.addEventListener('click', handleConfirmSave);
        }
        
        if (confirmSavePlotBtn) {
            confirmSavePlotBtn.addEventListener('click', handleConfirmSave);
        }
    }

    initializeWorkingDirModal() {
        const modal = document.getElementById('workingDirModal');
        const selectFilesBtn = document.getElementById('selectFilesBtn');
        const skipDirBtn = document.getElementById('skipDirBtn');
        const csvFilesInput = document.getElementById('csvFilesInput');

        // Show modal on startup
        if (this.showWorkingDirModal) {
            modal.classList.remove('hidden');
        }

        // Select CSV files button
        selectFilesBtn.addEventListener('click', () => {
            csvFilesInput.click();
        });

        // Skip button
        skipDirBtn.addEventListener('click', () => {
            this.hideWorkingDirModal();
        });

        // CSV files selection
        csvFilesInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFileSelection(e.target.files, 'files');
            }
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideWorkingDirModal();
            }
        });
    }

    hideWorkingDirModal() {
        const modal = document.getElementById('workingDirModal');
        modal.classList.add('hidden');
        this.showWorkingDirModal = false;
    }

    handleFileSelection(files, selectionType) {
        if (!files || files.length === 0) return;

        // Filter to only CSV files
        this.workingDirFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.csv'));
        
        if (this.workingDirFiles.length === 0) {
            this.showError('No CSV files found in the selected location. Please try again.');
            return;
        }

        this.analyzeWorkingDirFiles();
        this.hideWorkingDirModal();
        this.renderFileBrowser();
        
        // Auto-load the first CSV file found
        if (this.workingDirFiles.length > 0) {
            const firstFile = this.workingDirFiles[0];
            this.handleFileUpload(firstFile);
        }
        
        // Show success message
        const message = `Successfully loaded ${this.workingDirFiles.length} CSV file${this.workingDirFiles.length !== 1 ? 's' : ''}.`;
        this.showSuccess(message);
    }

    analyzeWorkingDirFiles() {
        this.fileInfos.clear();
        
        this.workingDirFiles.forEach(file => {
            if (!file.name.toLowerCase().endsWith('.csv')) return;
            
            const fileName = file.name.replace('.csv', '');
            let baseName, suffix;
            
            // Check for any _suffix pattern
            const suffixMatch = fileName.match(/^(.+)_([^_]+)$/);
            if (suffixMatch) {
                baseName = suffixMatch[1];
                suffix = suffixMatch[2].toLowerCase();
            } else {
                baseName = fileName;
                suffix = 'original';
            }
            
            if (!this.fileInfos.has(baseName)) {
                this.fileInfos.set(baseName, {
                    baseName,
                    versions: new Map()
                });
            }
            
            const fileInfo = this.fileInfos.get(baseName);
            fileInfo.versions.set(suffix, file);
        });
        
        console.log('Analyzed files:', this.fileInfos);
    }

    renderFileBrowser() {
        const fileBrowser = document.getElementById('fileBrowser');
        const fileList = document.getElementById('fileList');
        const fileCount = document.getElementById('fileCount');

        if (this.fileInfos.size === 0) {
            fileBrowser.style.display = 'none';
            return;
        }

        // Show file browser
        fileBrowser.style.display = 'block';
        
        // Update file count
        fileCount.textContent = `${this.fileInfos.size} file groups`;

        // Clear existing content
        fileList.innerHTML = '';

        // Render each file group
        this.fileInfos.forEach(fileInfo => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            // Create version badges
            const versionBadges = Array.from(fileInfo.versions.keys()).map(suffix => {
                const displaySuffix = suffix === 'original' ? 'BASE' : suffix.toUpperCase();
                const colorClass = this.getSuffixColorClass(suffix);
                return `<span class="version-indicator ${colorClass}">${displaySuffix}</span>`;
            }).join('');

            // Create aligned table and plot button pairs
            const buttonPairs = [];
            
            Array.from(fileInfo.versions.keys()).forEach(suffix => {
                const tableDisplayName = suffix === 'original' ? '📄 Table' : `📄 ${suffix.toUpperCase()}`;
                const tableButton = `<button class="btn-small btn-load" onclick="csvManager.loadFileFromBrowser('${fileInfo.baseName}', '${suffix}')">${tableDisplayName}</button>`;
                
                let plotButton = '';
                if (suffix === 'std' || suffix === '24hr') {
                    const plotDisplayName = `📊 ${suffix.toUpperCase()}`;
                    plotButton = `<button class="btn-small btn-plot" onclick="csvManager.loadPlotFromBrowser('${fileInfo.baseName}', '${suffix}')">${plotDisplayName}</button>`;
                }
                
                buttonPairs.push({ table: tableButton, plot: plotButton });
            });
            
            const loadTableButtons = buttonPairs.map(pair => pair.table).join('');
            const loadPlotButtons = buttonPairs.map(pair => pair.plot).join('');

            // Create convert buttons with progressive logic
            const hasRaw = fileInfo.versions.has('raw') || fileInfo.versions.has('original');
            const hasStd = fileInfo.versions.has('std');
            const has24hr = fileInfo.versions.has('24hr');
            const canConvert = fileInfo.versions.size > 0; // Has at least one version to convert from

            let convertButtons = '';
            if (canConvert) {
                // Only show STD conversion if we have raw but no STD
                if (hasRaw && !hasStd) {
                    convertButtons += `<button class="btn-small btn-convert" onclick="csvManager.generateStdFromBrowser('${fileInfo.baseName}')">⚡ STD</button>`;
                }
                // Only show 24HR conversion if we have STD but no 24HR
                if (hasStd && !has24hr) {
                    convertButtons += `<button class="btn-small btn-convert" onclick="csvManager.generate24hrFromBrowser('${fileInfo.baseName}')">⚡ 24HR</button>`;
                }
            }

            fileItem.innerHTML = `
                <div class="file-info-left">
                    <div class="file-name">${fileInfo.baseName}</div>
                    <div class="file-versions">${versionBadges}</div>
                </div>
                <div class="file-actions">
                    <div class="action-columns">
                        ${buttonPairs.map(pair => `
                            <div class="button-column">
                                ${pair.table}
                                ${pair.plot}
                            </div>
                        `).join('')}
                        <div class="convert-buttons">
                            ${convertButtons}
                        </div>
                    </div>
                </div>
            `;

            fileList.appendChild(fileItem);
        });
    }

    getSuffixColorClass(suffix) {
        const colorMap = {
            'original': 'version-original',
            'raw': 'version-raw',
            'std': 'version-std',
            '24hr': 'version-24hr',
            'processed': 'version-processed',
            'filtered': 'version-filtered',
            'clean': 'version-clean'
        };
        return colorMap[suffix] || 'version-default';
    }

    loadFileFromBrowser(baseName, suffix) {
        console.log('=== LOADING FILE FROM BROWSER ===');
        console.log('Base name:', baseName);
        console.log('Suffix:', suffix);
        
        const fileInfo = this.fileInfos.get(baseName);
        if (!fileInfo) {
            console.error('No file info found for base name:', baseName);
            return;
        }
        
        if (!fileInfo.versions.has(suffix)) {
            console.error('No version found for suffix:', suffix);
            console.log('Available versions:', Array.from(fileInfo.versions.keys()));
            return;
        }

        const file = fileInfo.versions.get(suffix);
        console.log('Found file:', {
            name: file.name,
            size: file.size,
            type: file.type,
            constructor: file.constructor.name
        });
        
        this.handleFileUpload(file);
        this.showSuccess(`Loaded ${file.name}`);
    }

    async loadPlotFromBrowser(baseName, suffix) {
        const fileInfo = this.fileInfos.get(baseName);
        if (!fileInfo || !fileInfo.versions.has(suffix)) return;

        const file = fileInfo.versions.get(suffix);
        
        try {
            const text = await this.readFileAsText(file);
            this.parseCSV(text);
            this.fileName = file.name;
            
            // Show plot section instead of table
            this.renderPlot();
            this.displayFileInfo(file);
            
            this.showSuccess(`Loaded ${file.name} for plotting`);
        } catch (error) {
            this.showError(`Error loading file for plot: ${error.message}`);
        }
    }

    generateStdFromBrowser(baseName) {
        const fileInfo = this.fileInfos.get(baseName);
        if (!fileInfo || fileInfo.versions.size === 0) return;

        // Always use the raw file for conversion
        let rawFile = fileInfo.versions.get('raw') || fileInfo.versions.get('original');
        if (!rawFile) {
            // If no raw file, use first available as fallback
            rawFile = Array.from(fileInfo.versions.values())[0];
        }
        
        // Load the raw file first
        this.handleFileUpload(rawFile);
        
        // Then convert it to STD
        setTimeout(() => {
            this.convertToStdFormat();
            
            // Show converted data with preview controls
            const convertedFileName = `${baseName}_std.csv`;
            this.showConvertedDataPreview(convertedFileName, 'std', baseName, fileInfo);
        }, 500);
    }

    generate24hrFromBrowser(baseName) {
        const fileInfo = this.fileInfos.get(baseName);
        if (!fileInfo || fileInfo.versions.size === 0) return;

        // Always use the STD file for 24HR conversion (not raw)
        let stdFile = fileInfo.versions.get('std');
        if (!stdFile) {
            this.showError('STD file must be created first before generating 24HR averages.');
            return;
        }
        
        console.log('Using STD file for 24HR conversion:', stdFile.name);
        
        // Load the STD file first
        this.handleFileUpload(stdFile);
        
        // Then convert it to 24hr average
        setTimeout(() => {
            this.convertTo24hrAverage();
            
            // Show converted data with preview controls
            const convertedFileName = `${baseName}_24hr.csv`;
            this.showConvertedDataPreview(convertedFileName, '24hr', baseName, fileInfo);
        }, 500);
    }

    showConvertedDataPreview(fileName, suffix, baseName, fileInfo) {
        // Update the table title to show the converted file name
        const dataTitle = document.getElementById('dataTitle');
        dataTitle.textContent = fileName;
        
        // Show the table with converted data
        this.renderTable();
        this.displayFileInfo({ name: fileName, size: 0, lastModified: Date.now() });
        
        // Show toggle and confirm buttons
        const toggleViewBtn = document.getElementById('toggleViewBtn');
        const confirmSaveBtn = document.getElementById('confirmSaveBtn');
        const confirmSavePlotBtn = document.getElementById('confirmSavePlotBtn');
        
        toggleViewBtn.style.display = 'inline-block';
        confirmSaveBtn.style.display = 'inline-block';
        
        // Store conversion details for later saving
        this.pendingConversion = {
            fileName,
            suffix,
            baseName,
            fileInfo,
            data: [...this.csvData],
            headers: [...this.headers]
        };
        
        this.showSuccess(`Converted to ${suffix.toUpperCase()} format! Review the data and click "Confirm & Save" to save the file.`);
    }

    showSaveConfirmation(fileName, suffix, baseName, fileInfo) {
        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px;">
                <div class="modal-header">
                    <h2>💾 Confirm Save</h2>
                    <p>Review the converted data and confirm to save as <strong>${fileName}</strong></p>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px;">
                        <strong>Preview:</strong> ${this.csvData.length} records, ${this.headers.length} columns
                    </div>
                    <div class="save-instructions" style="background-color: #e8f4fd; border: 1px solid #bee5eb; border-radius: 6px; padding: 12px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 8px 0; color: #0c5460;">📁 Save Location Recommendation</h4>
                        <p style="margin: 0; color: #0c5460; font-size: 14px;">
                            <strong>Please save this file in the same directory/folder where you originally loaded your CSV files.</strong><br>
                            This keeps all related files (raw, _std, _24hr) organized together for easy access in the Plot page.
                        </p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" id="confirmSaveBtn">✅ Confirm & Save to Original Directory</button>
                        <button class="btn-secondary" id="cancelSaveBtn">❌ Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        const confirmBtn = modal.querySelector('#confirmSaveBtn');
        const cancelBtn = modal.querySelector('#cancelSaveBtn');
        
        confirmBtn.addEventListener('click', () => {
            // Save the file
            this.autoSaveConvertedFile(fileName, suffix);
            
            // Create a mock file object for the converted data and add to fileInfo
            const mockFile = this.createMockFileFromCurrentData(fileName);
            fileInfo.versions.set(suffix, mockFile);
            
            // Add the new file to working directory files for plot page
            if (this.workingDirFiles && !this.workingDirFiles.find(f => f.name === fileName)) {
                this.workingDirFiles.push(mockFile);
                console.log(`Added ${fileName} to working directory files`);
            }
            
            // Update UI
            this.renderFileBrowser();
            this.showSuccess(`Generated and saved ${fileName}! Remember to save in your original CSV directory.`);
            
            // Update plot page if navigation manager exists
            if (typeof navigationManager !== 'undefined' && navigationManager.updatePlotPageFileInfo) {
                // Fire and forget - don't await to avoid blocking the UI
                navigationManager.updatePlotPageFileInfo().catch(console.error);
                console.log('Updated plot page file info after creating new file');
            }
            
            // Remove modal
            document.body.removeChild(modal);
        });
        
        cancelBtn.addEventListener('click', () => {
            // Just remove modal without saving
            document.body.removeChild(modal);
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showDirectorySaveConfirmation(fileName, suffix, baseName, fileInfo, onConfirm) {
        // Create compact confirmation dialog
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header">
                    <h2>💾 Save ${fileName}</h2>
                </div>
                <div class="modal-body">
                    <div class="save-instructions" style="background-color: #e8f4fd; border: 1px solid #bee5eb; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #0c5460;">📁 Important: Save Location</h4>
                        <p style="margin: 0 0 10px 0; color: #0c5460; font-size: 14px;">
                            <strong>Please save this file in the same directory/folder where you loaded your original CSV files.</strong>
                        </p>
                        <p style="margin: 0; color: #0c5460; font-size: 13px; font-style: italic;">
                            This keeps all related files (raw, _std, _24hr) organized together for easy access when plotting.
                        </p>
                    </div>
                    <div style="text-align: center; margin-bottom: 15px; color: #666; font-size: 14px;">
                        File: <strong>${fileName}</strong> • ${this.csvData.length} records, ${this.headers.length} columns
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" id="confirmDirectorySaveBtn" style="min-width: 180px;">✅ Save to Original Directory</button>
                        <button class="btn-secondary" id="cancelDirectorySaveBtn">❌ Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        const confirmBtn = modal.querySelector('#confirmDirectorySaveBtn');
        const cancelBtn = modal.querySelector('#cancelDirectorySaveBtn');
        
        confirmBtn.addEventListener('click', () => {
            onConfirm();
            document.body.removeChild(modal);
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    autoSaveConvertedFile(fileName, suffix) {
        if (this.csvData.length === 0) return;

        // Create CSV content from current data
        const csvContent = this.createCSVContent();
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    createCSVContent() {
        console.log('=== CREATING CSV CONTENT ===');
        console.log('Headers:', this.headers);
        console.log('Data rows:', this.csvData.length);
        
        if (this.csvData.length === 0) {
            console.log('No data to create CSV content');
            return '';
        }
        
        // Create header row
        const headerRow = this.headers.join(',');
        console.log('Header row:', headerRow);
        
        // Create data rows - csvData is an array of arrays, not objects
        const dataRows = this.csvData.map((row, rowIndex) => {
            const csvRow = row.map((value, colIndex) => {
                // Handle values that contain commas by wrapping in quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    // Escape quotes by doubling them and wrap in quotes
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value !== undefined && value !== null ? value : '';
            }).join(',');
            
            if (rowIndex < 3) {
                console.log(`Row ${rowIndex}:`, csvRow);
            }
            
            return csvRow;
        });
        
        const csvContent = [headerRow, ...dataRows].join('\n');
        console.log('Total CSV content length:', csvContent.length);
        
        return csvContent;
    }

    createMockFileFromCurrentData(fileName) {
        console.log('=== CREATING MOCK FILE ===');
        console.log('File name:', fileName);
        console.log('Current headers:', this.headers);
        console.log('Current data rows:', this.csvData.length);
        console.log('Sample data:', this.csvData.slice(0, 2));
        
        const csvContent = this.createCSVContent();
        console.log('Generated CSV content length:', csvContent.length);
        console.log('CSV content preview:', csvContent.substring(0, 200));
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        
        // Create a File-like object
        const mockFile = new File([blob], fileName, { 
            type: 'text/csv',
            lastModified: Date.now()
        });
        
        console.log('Created mock file:', {
            name: mockFile.name,
            size: mockFile.size,
            type: mockFile.type,
            lastModified: mockFile.lastModified
        });
        
        return mockFile;
    }

    handleFileUpload(file) {
        console.log('=== HANDLE FILE UPLOAD ===');
        console.log('File received:', file);
        
        if (!file) {
            console.error('No file provided');
            return;
        }

        console.log('File details:', {
            name: file.name,
            size: file.size,
            type: file.type,
            constructor: file.constructor.name,
            lastModified: file.lastModified
        });

        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            console.error('Invalid file type:', file.type, 'name:', file.name);
            this.showError('Please select a CSV file.');
            return;
        }

        this.fileName = file.name;
        const reader = new FileReader();

        reader.onload = (e) => {
            const csvContent = e.target.result;
            console.log('File read successfully, content length:', csvContent.length);
            console.log('Content preview:', csvContent.substring(0, 200));
            
            this.parseCSV(csvContent);
            console.log('After parsing - Headers:', this.headers.length, 'Data rows:', this.csvData.length);
            
            this.displayFileInfo(file);
            this.renderTable();
        };

        reader.onerror = (e) => {
            console.error('File read error:', e);
            this.showError('Error reading the file. Please try again.');
        };

        reader.readAsText(file);
    }

    async readFileAsText(file) {
        console.log('=== READ FILE AS TEXT ===');
        console.log('File:', file.name, 'Size:', file.size);
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const content = e.target.result;
                console.log('File content read, length:', content.length);
                console.log('Content preview:', content.substring(0, 200));
                resolve(content);
            };
            
            reader.onerror = (e) => {
                console.error('Error reading file:', e);
                reject(new Error('Failed to read file: ' + file.name));
            };
            
            reader.readAsText(file);
        });
    }

    parseCSV(csvContent) {
        console.log('=== PARSING CSV ===');
        console.log('CSV content length:', csvContent.length);
        
        const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
        console.log('Total lines after filtering:', lines.length);
        
        if (lines.length === 0) {
            this.showError('The CSV file appears to be empty.');
            return;
        }

        // Parse headers
        this.headers = this.parseCSVLine(lines[0]);
        
        // Parse data rows
        this.csvData = [];
        for (let i = 1; i < lines.length; i++) {
            const row = this.parseCSVLine(lines[i]);
            if (row.length > 0) {
                // Ensure row has same number of columns as headers
                while (row.length < this.headers.length) {
                    row.push('');
                }
                this.csvData.push(row);
            }
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add the last field
        result.push(current.trim());
        
        return result;
    }

    displayFileInfo(file) {
        const fileInfoCompact = document.getElementById('fileInfoCompact');
        const fileDetails = document.getElementById('fileDetails');
        
        const fileSize = (file.size / 1024).toFixed(2);
        const recordCount = this.csvData.length;
        const columnCount = this.headers.length;
        
        fileDetails.innerHTML = `
            <div class="file-detail">
                <strong>File Name</strong>
                ${file.name}
            </div>
            <div class="file-detail">
                <strong>File Size</strong>
                ${fileSize} KB
            </div>
            <div class="file-detail">
                <strong>Records</strong>
                ${recordCount}
            </div>
            <div class="file-detail">
                <strong>Columns</strong>
                ${columnCount}
            </div>
            <div class="file-detail">
                <strong>Last Modified</strong>
                ${new Date(file.lastModified).toLocaleString()}
            </div>
        `;
        
        fileInfoCompact.style.display = 'block';
    }

    renderPlot() {
        const plotSection = document.getElementById('plotSection');
        const tableSection = document.getElementById('tableSection');
        const plotInfo = document.getElementById('plotInfo');
        const plotTitle = document.getElementById('plotTitle');
        
        // Hide table section and show plot section
        tableSection.style.display = 'none';
        plotSection.style.display = 'block';
        
        if (this.csvData.length === 0) {
            this.showError('No data available for plotting.');
            return;
        }
        
        // Update plot info and title
        plotInfo.textContent = `${this.csvData.length} records`;
        if (this.fileName) {
            plotTitle.textContent = `${this.fileName} - Time Series Plot`;
        }
        
        // Draw the time series plot
        this.drawTimeSeries();
    }

    renderPlotWithVariableSelection() {
        const plotSection = document.getElementById('plotSection');
        const tableSection = document.getElementById('tableSection');
        const plotInfo = document.getElementById('plotInfo');
        const variableControls = document.getElementById('variableControls');
        const variableCheckboxes = document.getElementById('variableCheckboxes');
        const plotTitle = document.getElementById('plotTitle');
        
        // Hide table section and show plot section
        tableSection.style.display = 'none';
        plotSection.style.display = 'block';
        variableControls.style.display = 'block';
        
        if (this.csvData.length === 0) {
            this.showError('No data available for plotting.');
            return;
        }
        
        // Update plot info and title
        plotInfo.textContent = `${this.csvData.length} records`;
        if (this.pendingConversion) {
            plotTitle.textContent = `${this.pendingConversion.fileName} - Time Series Plot`;
        } else if (this.fileName) {
            plotTitle.textContent = `${this.fileName} - Time Series Plot`;
        }
        
        // Find time column
        let timeColumnIndex = 0;
        const timeColumnCandidate = this.headers.findIndex(header => {
            const lowerHeader = header.toLowerCase();
            return (lowerHeader.includes('time') || lowerHeader.includes('date')) && 
                   !lowerHeader.includes('%') && 
                   !lowerHeader.includes('lost') &&
                   !lowerHeader.includes('percent');
        });
        if (timeColumnCandidate !== -1) {
            timeColumnIndex = timeColumnCandidate;
        }
        
        // Get numeric columns for plotting (exclude time column)
        const numericColumns = this.headers
            .map((header, index) => ({ header, index }))
            .filter(col => col.index !== timeColumnIndex)
            .filter(col => this.isNumericColumn(col.index));
        
        // Create variable selection checkboxes
        variableCheckboxes.innerHTML = '';
        this.selectedVariables = this.selectedVariables || numericColumns.map(col => col.header);
        
        numericColumns.forEach(col => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'variable-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `var_${col.index}`;
            checkbox.checked = this.selectedVariables.includes(col.header);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!this.selectedVariables.includes(col.header)) {
                        this.selectedVariables.push(col.header);
                    }
                } else {
                    this.selectedVariables = this.selectedVariables.filter(v => v !== col.header);
                }
                this.drawTimeSeriesWithSelection();
            });
            
            const label = document.createElement('label');
            label.htmlFor = `var_${col.index}`;
            label.textContent = col.header;
            
            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(label);
            variableCheckboxes.appendChild(checkboxDiv);
        });
        
        // Draw the time series plot with selected variables
        this.drawTimeSeriesWithSelection();
    }

    drawTimeSeries() {
        const canvas = document.getElementById('plotCanvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size for high DPI displays
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (this.csvData.length === 0 || this.headers.length === 0) return;
        
        // Find time column (assume first column or column with 'time' in name)
        let timeColumnIndex = 0;
        const timeColumnCandidate = this.headers.findIndex(header => 
            header.toLowerCase().includes('time') || 
            header.toLowerCase().includes('date')
        );
        if (timeColumnCandidate !== -1) {
            timeColumnIndex = timeColumnCandidate;
        }
        
        // Get numeric columns for plotting (exclude time column)
        const numericColumns = this.headers
            .map((header, index) => ({ header, index }))
            .filter(col => col.index !== timeColumnIndex)
            .filter(col => this.isNumericColumn(col.index));
        
        if (numericColumns.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '18px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No numeric columns found for plotting', canvas.width/2, canvas.height/2);
            return;
        }
        
        // Parse time data and prepare for plotting
        const plotData = this.prepareTimeSeriesData(timeColumnIndex, numericColumns);
        
        if (plotData.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '18px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No valid data for plotting', canvas.width/2, canvas.height/2);
            return;
        }
        
        this.drawTimeSeriesChart(ctx, canvas, plotData, numericColumns);
    }

    drawTimeSeriesWithSelection() {
        const canvas = document.getElementById('plotCanvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size for high DPI displays
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (this.csvData.length === 0 || this.headers.length === 0) return;
        
        // Find time column
        let timeColumnIndex = 0;
        const timeColumnCandidate = this.headers.findIndex(header => {
            const lowerHeader = header.toLowerCase();
            return (lowerHeader.includes('time') || lowerHeader.includes('date')) && 
                   !lowerHeader.includes('%') && 
                   !lowerHeader.includes('lost') &&
                   !lowerHeader.includes('percent');
        });
        if (timeColumnCandidate !== -1) {
            timeColumnIndex = timeColumnCandidate;
        }
        
        // Get selected numeric columns for plotting
        const selectedColumns = this.headers
            .map((header, index) => ({ header, index }))
            .filter(col => col.index !== timeColumnIndex)
            .filter(col => this.selectedVariables.includes(col.header))
            .filter(col => this.isNumericColumn(col.index));
        
        if (selectedColumns.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '18px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No variables selected for plotting', canvas.width/(2*window.devicePixelRatio), canvas.height/(2*window.devicePixelRatio));
            return;
        }
        
        // Parse time data and prepare for plotting
        const plotData = this.prepareTimeSeriesData(timeColumnIndex, selectedColumns);
        
        if (plotData.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '18px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No valid data for plotting', canvas.width/(2*window.devicePixelRatio), canvas.height/(2*window.devicePixelRatio));
            return;
        }
        
        this.drawTimeSeriesChart(ctx, canvas, plotData, selectedColumns);
    }

    isNumericColumn(columnIndex) {
        // Check if most values in the column are numeric
        let numericCount = 0;
        const sampleSize = Math.min(100, this.csvData.length);
        
        for (let i = 0; i < sampleSize; i++) {
            const value = this.csvData[i][columnIndex];
            if (value !== null && value !== undefined && value !== '' && !isNaN(parseFloat(value))) {
                numericCount++;
            }
        }
        
        return numericCount > sampleSize * 0.7; // 70% numeric threshold
    }

    prepareTimeSeriesData(timeColumnIndex, numericColumns) {
        console.log("=== DEBUG: prepareTimeSeriesData ===");
        console.log("Input - timeColumnIndex:", timeColumnIndex, "numericColumns:", numericColumns.map(c => c.header));
        console.log("CSV data length:", this.csvData.length);
        console.log("CSV data sample:", this.csvData.slice(0, 3));
        const plotData = [];
        
        for (let rowIndex = 0; rowIndex < this.csvData.length; rowIndex++) {
            const row = this.csvData[rowIndex];
            const timeValue = row[timeColumnIndex];
            
            // Try to parse time
            let time;
            if (!isNaN(Date.parse(timeValue))) {
                time = new Date(timeValue);
            } else if (!isNaN(parseFloat(timeValue))) {
                // Assume it's a numeric time (hours, minutes, etc.)
                time = parseFloat(timeValue);
            } else {
                continue; // Skip invalid time values
            }
            
            const dataPoint = { time, values: {} };
            
            // Extract numeric values
            for (const col of numericColumns) {
                console.log("DEBUG: Processing column", col.header, "for row", rowIndex);
                const rawValue = row[col.index];
                console.log("Raw value:", rawValue, "Type:", typeof rawValue);
                const value = parseFloat(row[col.index]);
                console.log("Parsed float value:", value, "isNaN:", isNaN(value));
                if (!isNaN(value)) {
                    console.log("Valid numeric value:", value, "for column:", col.header);
                    dataPoint.values[col.header] = value;
                }
            }
            
            plotData.push(dataPoint);
        }
        
        // Sort by time
        plotData.sort((a, b) => {
            if (a.time instanceof Date && b.time instanceof Date) {
                return a.time - b.time;
            } else {
                return a.time - b.time;
            }
        });
        
        console.log("=== DEBUG: prepareTimeSeriesData Output ===");
        console.log("plotData length:", plotData.length);
        console.log("plotData sample:", plotData.slice(0, 5));
        console.log("Time range in data:", plotData.length > 0 ? {min: Math.min(...plotData.map(p => p.time)), max: Math.max(...plotData.map(p => p.time))} : "no data");
        return plotData;
    }

    drawTimeSeriesChart(ctx, canvas, plotData, numericColumns) {
        const margin = 60;
        const titleHeight = 40; // Space for title
        const plotWidth = canvas.width / window.devicePixelRatio - 2 * margin;
        const plotHeight = canvas.height / window.devicePixelRatio - 2 * margin - titleHeight;

        // Colors for different series
        const colors = ['#007aff', '#34c759', '#ff3b30', '#ff9500', '#af52de', '#00c7be', '#ff2d92'];

        // File name truncation function (2nd to 4th underscore)
        const truncateFileName = (fileName) => {
            const parts = fileName.split('_');
            if (parts.length >= 4) {
                return parts.slice(2, 4).join('_');
            }
            return fileName; // Return original if not enough underscores
        };

        // Determine chart title based on data context
        let chartTitle = '';
        if (numericColumns.length === 1) {
            // Single column selected - use column name as title
            chartTitle = numericColumns[0].header;
        } else if (this.fileName) {
            // Multiple columns or file-based view - use truncated filename
            chartTitle = truncateFileName(this.fileName);
        }

        // Separate std and non-std columns
        const stdColumns = numericColumns.filter(col =>
            col.header.toLowerCase().includes('std') ||
            this.fileName.toLowerCase().includes('_std')
        );
        const nonStdColumns = numericColumns.filter(col =>
            !col.header.toLowerCase().includes('std') &&
            !this.fileName.toLowerCase().includes('_std')
        );

        console.log('Chart data context:', {
            fileName: this.fileName,
            numericColumns: numericColumns.map(c => c.header),
            stdColumns: stdColumns.map(c => c.header),
            nonStdColumns: nonStdColumns.map(c => c.header)
        });

        // Find min/max for each series
        const seriesStats = {};
        numericColumns.forEach(col => {
            const values = plotData.map(d => d.values[col.header]).filter(v => v !== undefined);
            if (values.length > 0) {
                seriesStats[col.header] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            }
        });

        // Find global min/max for std and non-std series separately
        let globalStdMin = Infinity, globalStdMax = -Infinity;
        let globalNonStdMin = Infinity, globalNonStdMax = -Infinity;

        stdColumns.forEach(col => {
            if (seriesStats[col.header]) {
                globalStdMin = Math.min(globalStdMin, seriesStats[col.header].min);
                globalStdMax = Math.max(globalStdMax, seriesStats[col.header].max);
            }
        });

        nonStdColumns.forEach(col => {
            if (seriesStats[col.header]) {
                globalNonStdMin = Math.min(globalNonStdMin, seriesStats[col.header].min);
                globalNonStdMax = Math.max(globalNonStdMax, seriesStats[col.header].max);
            }
        });

        // If we have both std and non-std data, scale std down to match non-std range
        const stdScaleFactor = (nonStdColumns.length > 0 && stdColumns.length > 0) ?
            (globalNonStdMax - globalNonStdMin) / (globalStdMax - globalStdMin) * 0.05 : 1;

        console.log('Scaling calculation:', {
            globalStdMin, globalStdMax,
            globalNonStdMin, globalNonStdMax,
            stdScaleFactor,
            hasStdColumns: stdColumns.length > 0,
            hasNonStdColumns: nonStdColumns.length > 0
        });

        // Find time range
        console.log("=== DEBUG: Time Range Calculation ===");
        console.log("plotData length:", plotData.length);
        console.log("plotData sample:", plotData.slice(0, 3));
        console.log("All plotData times:", plotData.map(p => ({time: p.time, values: Object.keys(p.values)})));
        let timeMin = Infinity;
        let timeMax = -Infinity;

        plotData.forEach(point => {
                console.log("Processing point - time:", point.time, "value for", col.header, ":", point.values[col.header]);
            if (point.time < timeMin) timeMin = point.time;
            if (point.time > timeMax) timeMax = point.time;
        });

        // Fallback for empty data
        console.log("Initial time range - Min:", timeMin, "Max:", timeMax);
        console.log("Time range span:", timeMax - timeMin);
        if (timeMin === Infinity || timeMax === -Infinity) {
            timeMin = plotData[0]?.time || new Date();
            timeMax = plotData[plotData.length - 1]?.time || new Date();
        }

        // Draw chart title (left-aligned)
        if (chartTitle) {
            ctx.font = 'bold 18px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            ctx.fillStyle = '#1d1d1f';
            ctx.textAlign = 'left';
            ctx.fillText(chartTitle, margin, margin - 10);
        }

        // Draw axes (adjusted for title space)
        ctx.strokeStyle = '#d1d1d6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, margin + titleHeight);
        ctx.lineTo(margin, margin + titleHeight + plotHeight);
        ctx.lineTo(margin + plotWidth, margin + titleHeight + plotHeight);
        ctx.stroke();
        
        // Draw time series
        console.log("=== DEBUG: Drawing Time Series ===");
        console.log("numericColumns:", numericColumns.map(c => c.header));
        console.log("seriesStats:", seriesStats);
        numericColumns.forEach((col, seriesIndex) => {
            if (!seriesStats[col.header]) return;

            const color = colors[seriesIndex % colors.length];
            const isStdSeries = stdColumns.includes(col);

            // Use global scaling for better comparison
            let globalMin, globalMax;
            if (isStdSeries) {
                globalMin = globalStdMin;
                globalMax = globalStdMax;
            } else {
                globalMin = globalNonStdMin;
                globalMax = globalNonStdMax;
            }

            const range = globalMax - globalMin;
            if (range === 0) return; // Skip constant series

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            let firstPoint = true;
            console.log("=== DEBUG: Drawing series", col.header, "===");
            console.log("Series color:", color, "isStdSeries:", isStdSeries);
            console.log("Global min/max:", globalMin, globalMax, "Range:", range);
            plotData.forEach(point => {
                console.log("Processing point - time:", point.time, "value for", col.header, ":", point.values[col.header]);
                const value = point.values[col.header];
                if (value === undefined || value === null) return;
                console.log("Point accepted - value:", value, "will plot at time:", point.time);

                let x, y;

                // Calculate x position based on time
                if (point.time instanceof Date) {
                    const timeRange = timeMax - timeMin;
                    x = margin + (point.time - timeMin) / timeRange * plotWidth;
                } else {
                    const timeRange = timeMax - timeMin;
                    x = margin + (point.time - timeMin) / timeRange * plotWidth;
                }

                // Calculate y position with scaling for std series
                let scaledValue = value;
                let scaledMin = globalMin;

                if (isStdSeries && stdScaleFactor !== 1) {
                    // Scale down std values to be comparable with non-std values
                    scaledValue = (value - globalMin) * stdScaleFactor + globalNonStdMin;
                    scaledMin = globalNonStdMin;
                    const scaledRange = (globalMax - globalMin) * stdScaleFactor;
                    y = margin + titleHeight + plotHeight - ((scaledValue - scaledMin) / (globalNonStdMax - globalNonStdMin)) * plotHeight;
                } else {
                    y = margin + titleHeight + plotHeight - ((value - globalMin) / range) * plotHeight;
                }

                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        });
        
        // Draw legend
        ctx.font = '14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        const legendY = 20;
        let legendX = margin;

        numericColumns.forEach((col, seriesIndex) => {
            if (!seriesStats[col.header]) return;

            const color = colors[seriesIndex % colors.length];
            const isStdSeries = stdColumns.includes(col);

            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, 12, 12);

            ctx.fillStyle = '#1d1d1f';

            // Determine legend text based on context
            let legendText;
            if (numericColumns.length === 1) {
                // Single column selected (column first) - show truncated file name
                legendText = truncateFileName(this.fileName);
            } else {
                // Multiple columns or file-based view (file first) - show column header
                legendText = col.header;
            }

            if (isStdSeries && stdScaleFactor !== 1) {
                legendText += ' (scaled)';
            }

            ctx.fillText(legendText, legendX + 18, legendY + 9);

            legendX += ctx.measureText(legendText).width + 40;
        });
    }

    renderTable() {
        const tableSection = document.getElementById('tableSection');
        const plotSection = document.getElementById('plotSection');
        const tableHead = document.getElementById('tableHead');
        const tableBody = document.getElementById('tableBody');
        const recordCount = document.getElementById('recordCount');
        const dataTitle = document.getElementById('dataTitle');
        
        // Hide plot section and show table section
        plotSection.style.display = 'none';
        tableSection.style.display = 'block';
        
        // Update table title with filename
        if (this.fileName) {
            dataTitle.textContent = this.fileName;
        }
        
        // Add or update processing log interface
        this.createProcessingLogInterface();

        // Clear existing content
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        // Create header row
        const headerRow = document.createElement('tr');
        this.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header || 'Unnamed Column';
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        // Create data rows
        this.csvData.forEach((row, index) => {
            const tr = document.createElement('tr');
            row.forEach((cell, cellIndex) => {
                const td = document.createElement('td');
                td.textContent = cell || '';
                
                // Add title attribute for long content
                if (cell && cell.length > 50) {
                    td.title = cell;
                    td.textContent = cell.substring(0, 50) + '...';
                }
                
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });

        // Update record count
        recordCount.textContent = `${this.csvData.length} records`;

        // Show table section
        tableSection.style.display = 'block';
        
        // Scroll to table
        tableSection.scrollIntoView({ behavior: 'smooth' });
    }

    createProcessingLogInterface() {
        // Check if processing log already exists
        let logContainer = document.getElementById('processingLogContainer');
        
        if (!logContainer) {
            // Create the collapsible log interface
            logContainer = document.createElement('div');
            logContainer.id = 'processingLogContainer';
            logContainer.style.cssText = `
                margin: 10px 0;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                background: #f9fafb;
            `;
            
            const logHeader = document.createElement('div');
            logHeader.style.cssText = `
                padding: 8px 12px;
                background: #f3f4f6;
                border-bottom: 1px solid #d1d5db;
                cursor: pointer;
                display: flex;
                align-items: center;
                font-size: 0.9rem;
                font-weight: 500;
                color: #374151;
            `;
            
            const toggleIcon = document.createElement('span');
            toggleIcon.id = 'logToggleIcon';
            toggleIcon.textContent = '▶';
            toggleIcon.style.cssText = `
                margin-right: 8px;
                transition: transform 0.2s;
                font-size: 0.8rem;
            `;
            
            const logTitle = document.createElement('span');
            logTitle.textContent = 'Processing Log (Click to expand/collapse)';
            
            logHeader.appendChild(toggleIcon);
            logHeader.appendChild(logTitle);
            
            const logContent = document.createElement('div');
            logContent.id = 'processingLogContent';
            logContent.style.cssText = `
                display: none;
                padding: 12px;
                max-height: 300px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 0.8rem;
                background: #ffffff;
                color: #1f2937;
                line-height: 1.4;
            `;
            
            logHeader.addEventListener('click', () => {
                const isHidden = logContent.style.display === 'none';
                logContent.style.display = isHidden ? 'block' : 'none';
                toggleIcon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
            });
            
            logContainer.appendChild(logHeader);
            logContainer.appendChild(logContent);
            
            // Insert after the table controls but before the table wrapper
            const tableControls = document.querySelector('.table-controls');
            const tableWrapper = document.querySelector('.table-wrapper');
            tableControls.parentNode.insertBefore(logContainer, tableWrapper);
        }
    }

    addToProcessingLog(message, type = 'info') {
        if (!this.processingLogs) {
            this.processingLogs = [];
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.processingLogs.push(logEntry);
        
        // Update the log display
        const logContent = document.getElementById('processingLogContent');
        if (logContent) {
            const logLine = document.createElement('div');
            logLine.style.marginBottom = '2px';
            
            // Style based on type
            switch (type) {
                case 'error':
                    logLine.style.color = '#dc2626';
                    logLine.textContent = `❌ ${logEntry}`;
                    break;
                case 'success':
                    logLine.style.color = '#059669';
                    logLine.textContent = `✅ ${logEntry}`;
                    break;
                case 'warning':
                    logLine.style.color = '#d97706';
                    logLine.textContent = `⚠️ ${logEntry}`;
                    break;
                default:
                    logLine.style.color = '#374151';
                    logLine.textContent = `ℹ️ ${logEntry}`;
            }
            
            logContent.appendChild(logLine);
            // Auto scroll to bottom
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    clearProcessingLog() {
        this.processingLogs = [];
        const logContent = document.getElementById('processingLogContent');
        if (logContent) {
            logContent.innerHTML = '';
        }
    }

    exportCSV() {
        if (this.csvData.length === 0) return;

        let csvContent = this.headers.map(header => this.escapeCSVField(header)).join(',') + '\n';
        
        this.csvData.forEach(row => {
            const escapedRow = row.map(field => this.escapeCSVField(field)).join(',');
            csvContent += escapedRow + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `processed_${this.fileName}`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    escapeCSVField(field) {
        if (field == null) return '';
        
        const stringField = String(field);
        
        if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
            return '"' + stringField.replace(/"/g, '""') + '"';
        }
        
        return stringField;
    }

    convertToStdFormat() {
        // Clear previous logs and start fresh
        this.clearProcessingLog();
        this.addToProcessingLog('=== STARTING STD CONVERSION ===');
        this.addToProcessingLog(`Current filename: ${this.fileName}`);
        this.addToProcessingLog(`Headers available: ${this.headers.length} columns`);
        this.addToProcessingLog(`Data rows: ${this.csvData.length}`);
        
        console.log('=== STARTING STD CONVERSION ===');
        console.log('Current filename:', this.fileName);
        console.log('Headers available:', this.headers);
        console.log('Data rows:', this.csvData.length);
        
        if (this.csvData.length === 0) {
            this.addToProcessingLog('❌ No data to convert', 'error');
            this.showError('No data to convert. Please upload a CSV file first.');
            return;
        }

        try {
            this.addToProcessingLog('🔄 Starting STD format processing...');
            console.log('Calling processToStdFormat...');
            const stdData = this.processToStdFormat();
            
            this.addToProcessingLog('✅ STD processing completed successfully', 'success');
            this.addToProcessingLog(`Result headers: ${stdData.headers.join(', ')}`);
            this.addToProcessingLog(`Result data rows: ${stdData.data.length}`);
            
            console.log('✅ STD processing completed successfully');
            console.log('Result headers:', stdData.headers);
            console.log('Result data rows:', stdData.data.length);
            
            // Update the current view with converted data for preview
            this.displayConvertedData(stdData);
            
            this.showSuccess(`Successfully converted to _std format! File: ${this.fileName} - Preview the data and use the export button to download.`);
        } catch (error) {
            this.showError(`Conversion failed: ${error.message}`);
        }
    }

    displayConvertedData(stdData) {
        console.log('=== DISPLAYING CONVERTED DATA ===');
        
        // Update the internal data structure
        this.headers = stdData.headers;
        this.csvData = stdData.data;
        
        // Update the filename according to specification:
        // "If the original file has a '_raw' suffix then directly replace this with _std"
        console.log('Original filename:', this.fileName);
        
        if (this.fileName.toLowerCase().includes('_raw')) {
            // Replace _raw with _std
            this.fileName = this.fileName.replace(/_raw/gi, '_std');
            console.log('Replaced _raw with _std:', this.fileName);
        } else if (!this.fileName.toLowerCase().includes('_std')) {
            // Add _std suffix before extension
            const baseName = this.fileName.replace(/\.csv$/i, '');
            this.fileName = `${baseName}_std.csv`;
            console.log('Added _std suffix:', this.fileName);
        }
        
        console.log('Final filename for display:', this.fileName);
        
        // Re-render the table with converted data
        // This will show the new filename with _std suffix above the table
        this.renderTable();
        
        // Update file info to show conversion details
        this.updateFileInfoForConversion(stdData);
    }

    updateFileInfoForConversion(stdData) {
        const fileDetails = document.getElementById('fileDetails');
        
        const recordCount = stdData.data.length;
        const columnCount = stdData.headers.length;
        
        // Create conversion details
        const conversionInfo = document.createElement('div');
        conversionInfo.className = 'conversion-info';
        conversionInfo.style.cssText = `
            margin-top: 15px;
            padding: 15px;
            background: #e6f3ff;
            border-radius: 8px;
            border-left: 4px solid #007aff;
        `;
        
        conversionInfo.innerHTML = `
            <div style="font-weight: 600; color: #007aff; margin-bottom: 10px;">
                ✓ Converted to _std format
            </div>
            <div style="font-size: 0.9rem; color: #1d1d1f;">
                <strong>Processed:</strong> ${recordCount} records, ${columnCount} columns<br>
                <strong>Columns found:</strong> ${stdData.headers.slice(1).join(', ')}
            </div>
        `;
        
        // Remove existing conversion info if present
        const existingInfo = document.querySelector('.conversion-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        fileDetails.appendChild(conversionInfo);
    }

    processToStdFormat() {
        console.log('=== PROCESS TO STD FORMAT START ===');
        console.log('Following specification requirements step by step...');
        
        // Step 1: Find date and time columns dynamically
        this.addToProcessingLog('STEP 1: Finding date and time columns...');
        console.log('STEP 1: Finding date and time columns...');
        const { dateColIndex, timeColIndex, isCombined } = this.findDateTimeColumns();
        
        this.addToProcessingLog(`Date-time detection results:`);
        this.addToProcessingLog(`- dateColIndex: ${dateColIndex}`);
        this.addToProcessingLog(`- timeColIndex: ${timeColIndex}`);
        this.addToProcessingLog(`- isCombined: ${isCombined}`);
        
        console.log('Date-time detection results:');
        console.log('- dateColIndex:', dateColIndex);
        console.log('- timeColIndex:', timeColIndex); 
        console.log('- isCombined:', isCombined);
        
        if (dateColIndex === -1 || timeColIndex === -1) {
            const errorMsg = `Could not find valid date and time columns in the CSV. Found: dateColIndex=${dateColIndex}, timeColIndex=${timeColIndex}`;
            this.addToProcessingLog(`❌ ${errorMsg}`, 'error');
            throw new Error(errorMsg);
        }

        // Step 2: Extract and reformat timestamps into ISO 8601 format: YYYY-MM-DDTHH:MM:SS.000Z
        this.addToProcessingLog('STEP 2: Extracting timestamps and reformatting to ISO 8601...');
        console.log('STEP 2: Extracting timestamps and reformatting to ISO 8601...');
        const timestamps = this.extractTimestamps(dateColIndex, timeColIndex, isCombined);
        
        this.addToProcessingLog(`Extracted ${timestamps.length} timestamps`);
        this.addToProcessingLog(`Sample timestamps: ${timestamps.slice(0, 3).join(', ')}`);
        
        console.log(`Extracted ${timestamps.length} timestamps`);
        console.log('Sample timestamps:', timestamps.slice(0, 3));

        // Step 3: Extract data columns according to specification
        this.addToProcessingLog('STEP 3: Extracting and renaming data columns per specification...');
        console.log('STEP 3: Extracting and renaming data columns per specification...');
        const columnMappings = [
            { patterns: ['Harbour Porpoise (DPM)_F', 'NBHF_DPM'], target: 'Porpoise (DPM)' },
            { patterns: ['Harbour Porpoise (Clicks)_F', 'NBHFclx'], target: 'Porpoise (Clicks)' },
            { patterns: ['Other Cetaceans (DPM)_F', 'DOL_DPM'], target: 'Dolphin (DPM)' },
            { patterns: ['Other Cetaceans (Clicks)_F', 'DOLclx'], target: 'Dolphin (Clicks)' },
            { patterns: ['Sonar (DPM)_F', 'SONAR_DPM'], target: 'Sonar (DPM)' },
            { patterns: ['SONARclx'], target: 'Sonar (Clicks)' }
        ];

        const extractedColumns = this.extractDataColumns(columnMappings);
        this.addToProcessingLog(`Found ${extractedColumns.length} matching data columns: ${extractedColumns.map(col => col.name).join(', ')}`);
        console.log(`Found ${extractedColumns.length} matching data columns:`, extractedColumns.map(col => col.name));
        
        if (extractedColumns.length === 0) {
            const errorMsg = 'No matching data columns found for conversion. Check column names match specification.';
            this.addToProcessingLog(`❌ ${errorMsg}`, 'error');
            throw new Error(errorMsg);
        }

        // Step 4: Create structured dataset with Time column as first column
        console.log('STEP 4: Creating structured dataset...');
        
        // Align all data with timestamps
        const maxLength = timestamps.length;
        const alignedColumns = this.alignDataColumns(extractedColumns, maxLength);

        // Create headers: Time column FIRST, then data columns
        const stdHeaders = ['Time', ...alignedColumns.map(col => col.name)];
        console.log('Final headers:', stdHeaders);
        
        // Create data rows: Time column FIRST, then data columns
        this.addToProcessingLog('STEP 4: Creating final data rows...');
        const stdData = [];
        let missingTimestampCount = 0;
        let missingDataCount = 0;
        let validRowCount = 0;
        
        for (let i = 0; i < maxLength; i++) {
            const timestamp = timestamps[i] || '0';
            if (timestamp === '0') {
                missingTimestampCount++;
                this.addToProcessingLog(`⚠️ Row ${i}: Invalid/missing timestamp - using '0'`, 'warning');
            } else {
                validRowCount++;
            }
            const row = [timestamp]; // Time column FIRST
            
            alignedColumns.forEach(col => {
                const value = col.data[i] || '0';
                if (value === '0' && col.data[i] === undefined) missingDataCount++;
                row.push(value); // Replace missing data with '0'
            });
            stdData.push(row);
        }
        
        this.addToProcessingLog(`✅ Created ${stdData.length} data rows: ${validRowCount} with valid timestamps, ${missingTimestampCount} with invalid timestamps`);
        this.addToProcessingLog(`Replaced ${missingDataCount} missing data cells with '0'`);

        console.log('STEP 5: Validation - checking for columns before Time...');
        // Step 5: Check if there's any column before Time (there shouldn't be)
        if (stdHeaders[0] !== 'Time') {
            console.warn('WARNING: Time column is not first! Fixing...');
            // This shouldn't happen with our logic, but just in case
        } else {
            console.log('✅ Time column is correctly positioned as first column');
        }

        console.log(`✅ STD conversion complete: ${stdData.length} rows, ${stdHeaders.length} columns`);
        console.log('Sample data row:', stdData[0]);

        return {
            headers: stdHeaders,
            data: stdData
        };
    }

    findDateTimeColumns() {
        console.log('=== FINDING DATE-TIME COLUMNS ===');
        console.log('Available headers:', this.headers);
        console.log('Total headers:', this.headers.length);
        console.log('Data rows available:', this.csvData.length);
        
        let dateColIndex = -1;
        let timeColIndex = -1;
        let combinedColIndex = -1;

        // Show sample of first few rows for debugging
        if (this.csvData.length > 0) {
            console.log('First row sample:', this.csvData[0]);
            if (this.csvData.length > 1) {
                console.log('Second row sample:', this.csvData[1]);
            }
        }

        // Look for date/time patterns in headers
        for (let i = 0; i < this.headers.length; i++) {
            const header = (this.headers[i] || '').toLowerCase().trim();
            console.log(`Checking header ${i}: "${this.headers[i]}" (lowercase: "${header}")`);
            
            // Look for ChunkEnd column (combined date/time)
            if (header === 'chunkend' || header.includes('chunkend')) {
                console.log(`Found potential ChunkEnd column at index ${i}`);
                if (this.csvData.length > 0) {
                    console.log(`Sample ChunkEnd data: "${this.csvData[0][i]}"`);
                    if (this.isCombinedDateTimeColumn(i)) {
                        combinedColIndex = i;
                        console.log(`✅ Confirmed ChunkEnd column at index ${i}`);
                        break; // Use combined column if found
                    } else {
                        console.log(`❌ ChunkEnd column validation failed at index ${i}`);
                    }
                }
            }
            
            // Look for separate date column
            if (dateColIndex === -1 && (
                header.includes('date') || 
                header.includes('datum') || 
                header === 'c' ||
                i === 2  // Column C fallback
            )) {
                // Verify this column contains date-like data
                if (this.csvData.length > 0 && this.isDateColumn(i)) {
                    dateColIndex = i;
                }
            }
            
            // Look for separate time column
            if (timeColIndex === -1 && (
                header.includes('time') || 
                header.includes('zeit') || 
                header === 'd' ||
                i === 3  // Column D fallback
            )) {
                // Verify this column contains time-like data
                if (this.csvData.length > 0 && this.isTimeColumn(i)) {
                    timeColIndex = i;
                }
            }
        }

        // Final results logging
        console.log('=== DATE-TIME COLUMN DETECTION RESULTS ===');
        console.log('Combined column index:', combinedColIndex);
        console.log('Date column index:', dateColIndex);
        console.log('Time column index:', timeColIndex);
        
        // Return combined column index if found, otherwise separate columns
        if (combinedColIndex !== -1) {
            console.log('✅ Using COMBINED date-time column');
            return { 
                dateColIndex: combinedColIndex, 
                timeColIndex: combinedColIndex, 
                isCombined: true 
            };
        }

        if (dateColIndex !== -1 && timeColIndex !== -1) {
            console.log('✅ Using SEPARATE date and time columns');
        } else {
            console.log('❌ No valid date-time columns found!');
        }

        return { dateColIndex, timeColIndex, isCombined: false };
    }

    isDateColumn(colIndex) {
        // Check first few non-empty rows for date patterns
        for (let i = 0; i < Math.min(5, this.csvData.length); i++) {
            const value = this.csvData[i][colIndex];
            if (value && typeof value === 'string') {
                // Check for common date patterns
                if (value.match(/^\d{4}-\d{2}-\d{2}$/) || 
                    value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) || 
                    value.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
                    return true;
                }
            }
        }
        return false;
    }

    isTimeColumn(colIndex) {
        // Check first few non-empty rows for time patterns
        for (let i = 0; i < Math.min(5, this.csvData.length); i++) {
            const value = this.csvData[i][colIndex];
            if (value && typeof value === 'string') {
                // Check for time patterns
                if (value.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                    return true;
                }
            }
        }
        return false;
    }

    isCombinedDateTimeColumn(colIndex) {
        console.log(`=== VALIDATING COMBINED DATE-TIME COLUMN ${colIndex} ===`);
        
        // Check first few non-empty rows for combined date/time patterns like "3/30/2025 19:59:00"
        for (let i = 0; i < Math.min(5, this.csvData.length); i++) {
            const value = this.csvData[i][colIndex];
            console.log(`Row ${i}, Column ${colIndex}: "${value}" (type: ${typeof value})`);
            
            if (value && typeof value === 'string') {
                const trimmedValue = value.trim();
                console.log(`Trimmed value: "${trimmedValue}"`);
                
                // Check for ChunkEnd format: M/D/YYYY H:MM or M/D/YYYY H:MM:SS (seconds optional)
                const pattern = /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{1,2}(:\d{1,2})?$/;
                const matches = trimmedValue.match(pattern);
                console.log(`Pattern match result: ${matches ? 'MATCH' : 'NO MATCH'}`);
                
                if (matches) {
                    console.log('✅ Found valid combined date-time format');
                    return true;
                }
            } else if (value) {
                console.log(`Non-string value found: ${value}`);
            }
        }
        
        console.log('❌ No valid combined date-time format found');
        return false;
    }

    /**
     * Detect date format by analyzing multiple date entries for chronological consistency
     * @param {number} dateColIndex - Index of the date column
     * @returns {string} - Detected format: 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', or 'DD-MM-YYYY'
     */
    detectDateFormat(dateColIndex) {
        console.log('Starting date format detection...');
        
        // Collect valid date samples (skip header row if present)
        const dateSamples = [];
        const sampleSize = Math.min(10, this.csvData.length); // Check up to 10 samples
        
        for (let i = 0; i < sampleSize; i++) {
            const dateStr = this.csvData[i]?.[dateColIndex]?.trim();
            if (dateStr && dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
                dateSamples.push(dateStr);
            }
        }
        
        if (dateSamples.length < 3) {
            console.warn('Not enough date samples for reliable detection, defaulting to MM/DD/YYYY');
            return 'MM/DD/YYYY';
        }
        
        console.log('Date samples for analysis:', dateSamples);
        
        // Test both formats and see which creates a more logical chronological sequence
        const formats = ['DD/MM/YYYY', 'MM/DD/YYYY'];
        let bestFormat = 'MM/DD/YYYY'; // Default fallback
        let bestScore = -1;
        
        formats.forEach(format => {
            const score = this.evaluateDateFormat(dateSamples, format);
            console.log(`Format ${format} score:`, score);
            
            if (score > bestScore) {
                bestScore = score;
                bestFormat = format;
            }
        });
        
        console.log('Best detected format:', bestFormat, 'with score:', bestScore);
        return bestFormat;
    }
    
    /**
     * Evaluate how well a date format fits the data by checking chronological consistency
     * @param {string[]} dateSamples - Array of date strings to test
     * @param {string} format - Format to test ('DD/MM/YYYY' or 'MM/DD/YYYY')
     * @returns {number} - Score indicating format fitness (higher = better)
     */
    evaluateDateFormat(dateSamples, format) {
        const parsedDates = [];
        let validParses = 0;
        
        // Parse all samples with the given format
        for (const dateStr of dateSamples) {
            try {
                const parsed = this.parseDateWithFormat(dateStr, format);
                if (parsed && !isNaN(parsed.getTime())) {
                    parsedDates.push(parsed);
                    validParses++;
                }
            } catch (error) {
                // Invalid parse, continue
            }
        }
        
        if (validParses < 2) return 0; // Need at least 2 valid dates
        
        // Check for chronological consistency
        let chronologicalScore = 0;
        let reasonableDatesScore = 0;
        
        // Sort dates and check if they follow expected logger pattern (generally ascending)
        const sortedDates = [...parsedDates].sort((a, b) => a.getTime() - b.getTime());
        
        // Score based on how many dates are in chronological order in original sequence
        for (let i = 1; i < parsedDates.length; i++) {
            if (parsedDates[i].getTime() >= parsedDates[i-1].getTime()) {
                chronologicalScore++;
            }
        }
        
        // Score based on reasonable date ranges (within last 10 years and not in future)
        const now = new Date();
        const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
        
        for (const date of parsedDates) {
            if (date >= tenYearsAgo && date <= now) {
                reasonableDatesScore++;
            }
        }
        
        // Combined score: chronological consistency + reasonable dates
        const totalScore = (chronologicalScore / (parsedDates.length - 1)) * 50 + 
                          (reasonableDatesScore / parsedDates.length) * 50;
        
        console.log(`Format ${format}: ${validParses}/${dateSamples.length} valid, chrono: ${chronologicalScore}/${parsedDates.length-1}, reasonable: ${reasonableDatesScore}/${parsedDates.length}`);
        
        return totalScore;
    }
    
    /**
     * Parse date string with specific format
     * @param {string} dateStr - Date string to parse
     * @param {string} format - Format to use
     * @returns {Date} - Parsed date object
     */
    parseDateWithFormat(dateStr, format) {
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length !== 3) throw new Error('Invalid date parts');
        
        const [part1, part2, year] = parts;
        let month, day;
        
        switch (format) {
            case 'DD/MM/YYYY':
            case 'DD-MM-YYYY':
                day = parseInt(part1, 10);
                month = parseInt(part2, 10);
                break;
            case 'MM/DD/YYYY':
            case 'MM-DD-YYYY':
                month = parseInt(part1, 10);
                day = parseInt(part2, 10);
                break;
            default:
                throw new Error('Unsupported format');
        }
        
        // Validate ranges
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            throw new Error('Invalid date values');
        }
        
        return new Date(parseInt(year, 10), month - 1, day);
    }

    detectCombinedDateFormat(dateColIndex) {
        console.log('=== DETECTING COMBINED DATE FORMAT ===');
        
        const samples = [];
        const maxSamples = Math.min(10, this.csvData.length);
        
        // Collect sample combined date-time strings
        for (let i = 0; i < maxSamples; i++) {
            const combined = this.csvData[i][dateColIndex];
            if (combined && typeof combined === 'string') {
                const match = combined.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (match) {
                    samples.push({
                        first: parseInt(match[1], 10),
                        second: parseInt(match[2], 10),
                        original: combined
                    });
                }
            }
        }
        
        console.log(`Analyzing ${samples.length} combined date samples:`, samples.map(s => s.original));
        
        if (samples.length === 0) {
            console.log('No valid combined date samples found, defaulting to DD/MM/YYYY');
            return 'DD/MM/YYYY';
        }
        
        let ddmmScore = 0;
        let mmddScore = 0;
        
        for (const sample of samples) {
            // If first number > 12, it must be DD/MM/YYYY
            if (sample.first > 12) {
                ddmmScore += 2; // Strong evidence
                console.log(`  "${sample.original}": first=${sample.first} > 12, strong DD/MM evidence`);
            }
            // If second number > 12, it must be MM/DD/YYYY
            else if (sample.second > 12) {
                mmddScore += 2; // Strong evidence
                console.log(`  "${sample.original}": second=${sample.second} > 12, strong MM/DD evidence`);
            }
            // If both <= 12, look for patterns (like increasing sequences)
            else {
                console.log(`  "${sample.original}": ambiguous (both <= 12), first=${sample.first}, second=${sample.second}`);
                // Could add chronological analysis here if needed
            }
        }
        
        const detectedFormat = ddmmScore >= mmddScore ? 'DD/MM/YYYY' : 'MM/DD/YYYY';
        console.log(`Format detection scores: DD/MM=${ddmmScore}, MM/DD=${mmddScore}`);
        console.log(`✅ Detected combined format: ${detectedFormat}`);
        
        return detectedFormat;
    }

    extractTimestamps(dateColIndex, timeColIndex, isCombined = false) {
        console.log('=== EXTRACTING TIMESTAMPS ===');
        console.log(`dateColIndex: ${dateColIndex}, timeColIndex: ${timeColIndex}, isCombined: ${isCombined}`);
        
        const timestamps = [];
        
        // Detect date format - for combined and separate columns
        let detectedDateFormat = null;
        if (isCombined) {
            detectedDateFormat = this.detectCombinedDateFormat(dateColIndex);
            console.log('Detected combined date format:', detectedDateFormat);
        } else {
            detectedDateFormat = this.detectDateFormat(dateColIndex);
            console.log('Detected date format:', detectedDateFormat);
        }
        
        console.log(`Processing ${this.csvData.length} data rows...`);
        
        // Show sample data for debugging
        if (this.csvData.length > 0) {
            console.log('Sample data rows for timestamp parsing:');
            for (let sampleIdx = 0; sampleIdx < Math.min(3, this.csvData.length); sampleIdx++) {
                const sampleRow = this.csvData[sampleIdx];
                if (isCombined) {
                    console.log(`  Row ${sampleIdx}: Combined column [${dateColIndex}] = "${sampleRow[dateColIndex]}"`);
                } else {
                    console.log(`  Row ${sampleIdx}: Date [${dateColIndex}] = "${sampleRow[dateColIndex]}", Time [${timeColIndex}] = "${sampleRow[timeColIndex]}"`);
                }
            }
        }
        
        for (let i = 0; i < this.csvData.length; i++) {
            const row = this.csvData[i];
            
            if (isCombined) {
                // Handle combined ChunkEnd format
                const combinedStr = row[dateColIndex] || '';
                if (combinedStr) {
                    try {
                        const timestamp = this.parseCombinedDateTime(combinedStr, detectedDateFormat);
                        timestamps.push(timestamp);
                    } catch (error) {
                        console.error(`Row ${i}: Failed to parse timestamp "${combinedStr}":`, error.message);
                        this.addToProcessingLog(`❌ Row ${i}: Failed to parse timestamp "${combinedStr}": ${error.message}`, 'error');
                        timestamps.push('0'); // Only fallback to '0' after logging error
                    }
                } else {
                    console.warn(`Row ${i}: Missing timestamp data`);
                    this.addToProcessingLog(`⚠️ Row ${i}: Missing timestamp data`, 'warning');
                    timestamps.push('0'); // Replace missing timestamp with '0'
                }
            } else {
                // Handle separate date and time columns
                const dateStr = row[dateColIndex] || '';
                const timeStr = row[timeColIndex] || '';
                
                if (dateStr && timeStr) {
                    try {
                        const timestamp = this.combineDateTime(dateStr, timeStr, detectedDateFormat);
                        timestamps.push(timestamp);
                    } catch (error) {
                        console.error(`Row ${i}: Failed to combine date "${dateStr}" and time "${timeStr}":`, error.message);
                        this.addToProcessingLog(`❌ Row ${i}: Failed to combine date "${dateStr}" and time "${timeStr}": ${error.message}`, 'error');
                        timestamps.push('0'); // Only fallback to '0' after logging error
                    }
                } else {
                    console.warn(`Row ${i}: Missing date or time data - date: "${dateStr}", time: "${timeStr}"`);
                    this.addToProcessingLog(`⚠️ Row ${i}: Missing date or time data - date: "${dateStr}", time: "${timeStr}"`, 'warning');
                    timestamps.push('0'); // Replace missing timestamp with '0'
                }
            }
        }
        
        return timestamps;
    }

    extractDataColumns(columnMappings) {
        const dataColumns = [];
        
        // Search for each pattern in the headers
        columnMappings.forEach(mapping => {
            for (let i = 0; i < this.headers.length; i++) {
                const header = this.headers[i] || '';
                
                // Check if header matches any of the patterns
                const matches = mapping.patterns.some(pattern => 
                    header.trim() === pattern.trim() || 
                    header.toLowerCase().includes(pattern.toLowerCase())
                );
                
                if (matches) {
                    // Extract data from this column
                    const columnData = [];
                    for (let j = 0; j < this.csvData.length; j++) {
                        columnData.push(this.csvData[j][i] || '0'); // Replace missing data with '0'
                    }
                    
                    dataColumns.push({
                        name: mapping.target,
                        data: columnData,
                        originalHeader: header
                    });
                    break; // Only take first match for each mapping
                }
            }
        });
        
        return dataColumns;
    }

    alignDataColumns(dataColumns, maxLength) {
        return dataColumns.map(col => ({
            name: col.name,
            data: col.data.slice(0, maxLength), // Trim to match timestamp length
            originalHeader: col.originalHeader
        }));
    }

    parseCombinedDateTime(combinedStr, detectedDateFormat = 'DD/MM/YYYY') {
        console.log(`Parsing combined datetime: "${combinedStr}" using format: ${detectedDateFormat}`);
        
        // Handle ChunkEnd format: "3/30/2025 19:59" or "3/30/2025 19:59:00" (seconds optional)
        const match = combinedStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
        
        if (!match) {
            console.error(`Failed to parse ChunkEnd format: ${combinedStr}`);
            throw new Error(`Invalid ChunkEnd format: ${combinedStr}`);
        }
        
        console.log('Parsed components:', match.slice(1));

        const first = parseInt(match[1], 10);
        const second = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        const hours = parseInt(match[4], 10);
        const minutes = parseInt(match[5], 10);
        const seconds = parseInt(match[6] || '0', 10); // Default to 0 if no seconds

        // Use detected date format to assign month and day
        let month, day;
        
        if (detectedDateFormat === 'DD/MM/YYYY') {
            day = first;
            month = second;
            console.log(`Using DD/MM/YYYY format: day=${day}, month=${month}`);
        } else {
            // MM/DD/YYYY format
            month = first;
            day = second;
            console.log(`Using MM/DD/YYYY format: month=${month}, day=${day}`);
        }

        // Validate values
        if (month < 1 || month > 12 || day < 1 || day > 31 || 
            hours > 23 || minutes > 59 || seconds > 59) {
            throw new Error(`Invalid date/time values: ${combinedStr} (interpreted as day=${day}, month=${month})`);
        }

        // Create date object (month is 0-indexed in JavaScript)
        const date = new Date(year, month - 1, day, hours, minutes, seconds);

        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date: ${combinedStr} (interpreted as day=${day}, month=${month})`);
        }

        // Return ISO 8601 format
        console.log(`✅ Successfully parsed "${combinedStr}" as ${date.toISOString()}`);
        return date.toISOString();
    }

    combineDateTime(dateStr, timeStr, detectedDateFormat = null) {
        // Handle various date formats
        let date;
        
        // Try parsing as YYYY-MM-DD
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            date = new Date(dateStr + 'T00:00:00.000Z');
        }
        // Try parsing as MM/DD/YYYY or DD/MM/YYYY using detected format
        else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const parts = dateStr.split('/');
            let month, day;
            
            // Use detected format if available, otherwise default to MM/DD/YYYY
            if (detectedDateFormat === 'DD/MM/YYYY') {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                console.log(`Parsing ${dateStr} as DD/MM/YYYY: day=${day}, month=${month}`);
            } else {
                // Default MM/DD/YYYY or explicitly detected MM/DD/YYYY
                month = parseInt(parts[0], 10);
                day = parseInt(parts[1], 10);
                console.log(`Parsing ${dateStr} as MM/DD/YYYY: month=${month}, day=${day}`);
            }
            
            date = new Date(parseInt(parts[2], 10), month - 1, day);
        }
        // Try parsing as DD-MM-YYYY or MM-DD-YYYY using detected format  
        else if (dateStr.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
            const parts = dateStr.split('-');
            let month, day;
            
            // Use detected format if available, otherwise default to DD-MM-YYYY
            if (detectedDateFormat === 'MM-DD-YYYY') {
                month = parseInt(parts[0], 10);
                day = parseInt(parts[1], 10);
                console.log(`Parsing ${dateStr} as MM-DD-YYYY: month=${month}, day=${day}`);
            } else {
                // Default DD-MM-YYYY or explicitly detected DD-MM-YYYY
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                console.log(`Parsing ${dateStr} as DD-MM-YYYY: day=${day}, month=${month}`);
            }
            
            date = new Date(parseInt(parts[2], 10), month - 1, day);
        }
        else {
            throw new Error(`Unsupported date format: ${dateStr}`);
        }

        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date: ${dateStr}`);
        }

        // Parse time (handle HH:MM:SS or HH:MM format)
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (!timeMatch) {
            throw new Error(`Invalid time format: ${timeStr}`);
        }

        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseInt(timeMatch[3] || '0', 10);

        if (hours > 23 || minutes > 59 || seconds > 59) {
            throw new Error(`Invalid time values: ${timeStr}`);
        }

        // Combine date and time
        const combined = new Date(date);
        combined.setUTCHours(hours, minutes, seconds, 0);

        // Return ISO 8601 format
        return combined.toISOString();
    }

    exportStdCSV(stdData) {
        if (!stdData || stdData.data.length === 0) return;

        let csvContent = stdData.headers.join(',') + '\n';
        
        stdData.data.forEach(row => {
            const escapedRow = row.map(field => this.escapeCSVField(field)).join(',');
            csvContent += escapedRow + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            
            // Generate _std filename with _raw replacement logic - fix duplicate _std issue
            let stdFileName;
            if (this.fileName.toLowerCase().includes('_raw')) {
                stdFileName = this.fileName.replace(/_raw/gi, '_std');
            } else if (!this.fileName.toLowerCase().includes('_std')) {
                const baseName = this.fileName.replace(/\.csv$/i, '');
                stdFileName = `${baseName}_std.csv`;
            } else {
                stdFileName = this.fileName; // Already has _std
            }
            
            link.setAttribute('download', stdFileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #34c759;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 500;
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 5000);
    }

    convertTo24hrAverage() {
        if (this.csvData.length === 0) {
            this.showError('No data to convert. Please upload a CSV file first.');
            return;
        }

        try {
            const avgData = this.processTo24hrAverage();
            
            // Update the current view with averaged data for preview
            this.displayAveragedData(avgData);
            
            this.showSuccess('Successfully created 24-hour averages! Preview the data and use the export button to download.');
        } catch (error) {
            this.showError(`24hr averaging failed: ${error.message}`);
        }
    }

    processTo24hrAverage() {
        console.log('=== 24HR CONVERSION FROM STD FILE ===');
        console.log('File name:', this.fileName);
        console.log('Headers:', this.headers);
        console.log('Header details:', this.headers.map((h, i) => `${i}: ${h}`));
        console.log('Total data rows:', this.csvData.length);
        console.log('Data sample (first 3 rows):', this.csvData.slice(0, 3));
        
        if (this.csvData.length === 0) {
            throw new Error('No data available for 24HR averaging.');
        }
        
        if (this.headers.length < 2) {
            throw new Error('Data must have at least 2 columns for 24hr averaging.');
        }

        // Find time column - look for actual time/date columns, not percentages
        let timeColumnIndex = 0;
        const timeColumnCandidate = this.headers.findIndex(header => {
            const lowerHeader = header.toLowerCase();
            // Look for time/date columns but exclude percentage columns
            return (lowerHeader.includes('time') || lowerHeader.includes('date')) && 
                   !lowerHeader.includes('%') && 
                   !lowerHeader.includes('lost') &&
                   !lowerHeader.includes('percent');
        });
        
        if (timeColumnCandidate !== -1) {
            timeColumnIndex = timeColumnCandidate;
        }
        
        console.log('Using time column index:', timeColumnIndex, 'Header:', this.headers[timeColumnIndex]);
        
        // Get first timestamp to determine base date
        const firstTimestamp = this.csvData[0][timeColumnIndex];
        let baseDate;
        try {
            baseDate = new Date(firstTimestamp);
            if (isNaN(baseDate.getTime())) {
                throw new Error(`Invalid timestamp format: ${firstTimestamp}`);
            }
        } catch (error) {
            throw new Error(`Cannot parse timestamp from column "${this.headers[timeColumnIndex]}": ${firstTimestamp}`);
        }
        
        // Set to start of day (00:00:00.000)
        baseDate.setHours(0, 0, 0, 0);
        console.log('Base date (start of day):', baseDate.toISOString());
        
        // Group data by hour and calculate averages
        const hourlyAverages = this.calculatePreciseHourlyAverages(timeColumnIndex, baseDate);
        
        // Format the output according to specifications
        const result = this.formatPrecise24HourOutput(hourlyAverages, baseDate, timeColumnIndex);
        console.log('24HR processing complete. Result headers:', result.headers);
        console.log('Sample output rows:', result.data.slice(0, 3));
        
        return result;
    }

    calculatePreciseHourlyAverages(timeColumnIndex, baseDate) {
        console.log('=== CALCULATING PRECISE HOURLY AVERAGES ===');
        
        // Initialize 24-hour groups
        const hourlyGroups = {};
        for (let hour = 0; hour < 24; hour++) {
            hourlyGroups[hour] = [];
        }
        
        let validTimeCount = 0;
        let invalidTimeCount = 0;
        
        // Group data by hour
        for (let i = 0; i < this.csvData.length; i++) {
            const row = this.csvData[i];
            const timeStr = row[timeColumnIndex];
            
            if (timeStr) {
                try {
                    const timestamp = new Date(timeStr);
                    if (!isNaN(timestamp.getTime())) {
                        const hour = timestamp.getHours();
                        validTimeCount++;
                        
                        // Extract numeric data from all columns except time column
                        const numericData = {};
                        let numericFieldCount = 0;
                        
                        for (let j = 0; j < row.length; j++) {
                            if (j !== timeColumnIndex) {
                                const value = parseFloat(row[j]);
                console.log("Parsed float value:", value, "isNaN:", isNaN(value));
                                if (!isNaN(value)) {
                    console.log("Valid numeric value:", value, "for column:", col.header);
                                    numericData[this.headers[j]] = value;
                                    numericFieldCount++;
                                }
                            }
                        }
                        
                        if (numericFieldCount > 0) {
                            hourlyGroups[hour].push(numericData);
                        }
                    } else {
                        invalidTimeCount++;
                    }
                } catch (error) {
                    invalidTimeCount++;
                }
            }
        }
        
        console.log(`Grouped ${validTimeCount} valid timestamps, ${invalidTimeCount} invalid`);
        
        // Calculate averages for each hour
        const hourlyAverages = {};
        for (let hour = 0; hour < 24; hour++) {
            const hourData = hourlyGroups[hour];
            hourlyAverages[hour] = {};
            
            console.log(`Hour ${hour}: ${hourData.length} records`);
            
            if (hourData.length > 0) {
                // Calculate average for each numeric column
                for (let j = 0; j < this.headers.length; j++) {
                    if (j !== timeColumnIndex) {
                        const columnName = this.headers[j];
                        const validValues = hourData
                            .map(record => record[columnName])
                            .filter(val => val !== undefined && !isNaN(val));
                        
                        if (validValues.length > 0) {
                            const sum = validValues.reduce((acc, val) => acc + val, 0);
                            const average = sum / validValues.length;
                            // Round to 3 decimal places as per specifications
                            hourlyAverages[hour][columnName] = parseFloat(average.toFixed(3));
                        } else {
                            hourlyAverages[hour][columnName] = 0; // Replace missing data with 0
                        }
                    }
                }
            } else {
                // No data for this hour, set all values to 0
                for (let j = 0; j < this.headers.length; j++) {
                    if (j !== timeColumnIndex) {
                        hourlyAverages[hour][this.headers[j]] = 0; // Replace missing data with 0
                    }
                }
            }
        }
        
        return hourlyAverages;
    }

    formatPrecise24HourOutput(hourlyAverages, baseDate, timeColumnIndex) {
        console.log('=== FORMATTING 24HR OUTPUT ===');
        
        // Create headers: Time first, then all numeric columns (excluding original time column)
        const headers = ['Time'];
        for (let i = 0; i < this.headers.length; i++) {
            if (i !== timeColumnIndex) {
                headers.push(this.headers[i]);
            }
        }
        
        console.log('Output headers:', headers);
        
        // Create 24 rows, one for each hour
        const data = [];
        for (let hour = 0; hour < 24; hour++) {
            const timeForHour = new Date(baseDate);
            timeForHour.setHours(hour, 0, 0, 0);
            
            // Format time as YYYY-MM-DDTHH:MM:SS.000Z
            const formattedTime = timeForHour.toISOString();
            
            const row = [formattedTime];
            
            // Add averaged values for this hour
            for (let i = 0; i < this.headers.length; i++) {
                if (i !== timeColumnIndex) {
                    const columnName = this.headers[i];
                    const value = hourlyAverages[hour][columnName];
                    // Replace missing values with 0 for consistency
                    row.push(value !== null && value !== undefined ? value : 0);
                }
            }
            
            data.push(row);
        }
        
        console.log('Created 24 hourly records');
        console.log('Sample records:', data.slice(0, 3));
        
        return { headers, data };
    }

    groupDataByHour(timeColumnIndex) {
        const hourlyGroups = {};
        
        // Initialize 24 hours (0-23)
        for (let hour = 0; hour < 24; hour++) {
            hourlyGroups[hour] = [];
        }

        console.log('Processing', this.csvData.length, 'rows for grouping');

        let validTimeCount = 0;
        let invalidTimeCount = 0;
        let emptyTimeCount = 0;

        for (let i = 0; i < this.csvData.length; i++) {
            const row = this.csvData[i];
            const timeStr = row[timeColumnIndex];
            
            if (timeStr) {
                try {
                    // Try multiple time parsing approaches
                    let date;
                    let hour;
                    
                    // First try standard Date parsing
                    date = new Date(timeStr);
                    if (!isNaN(date.getTime())) {
                        hour = date.getHours();
                    } else {
                        // Try parsing as time only (HH:MM or HH:MM:SS)
                        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                        if (timeMatch) {
                            hour = parseInt(timeMatch[1], 10);
                            if (hour >= 0 && hour <= 23) {
                                date = new Date(); // Use today as base
                                date.setHours(hour, parseInt(timeMatch[2], 10), parseInt(timeMatch[3] || '0', 10));
                            }
                        } else {
                            // Try parsing as decimal hour (e.g., 13.5 for 1:30 PM)
                            const decimalHour = parseFloat(timeStr);
                            if (!isNaN(decimalHour) && decimalHour >= 0 && decimalHour < 24) {
                                hour = Math.floor(decimalHour);
                                date = new Date();
                                date.setHours(hour, (decimalHour % 1) * 60, 0);
                            }
                        }
                    }
                    
                    if (!isNaN(date.getTime()) && hour !== undefined && hour >= 0 && hour <= 23) {
                        validTimeCount++;
                        
                        // Extract numeric data from other columns (excluding time column)
                        const numericData = {};
                        let numericFieldCount = 0;
                        for (let j = 0; j < this.headers.length; j++) {
                            if (j !== timeColumnIndex) { // Skip time column
                                const value = parseFloat(row[j]);
                console.log("Parsed float value:", value, "isNaN:", isNaN(value));
                                if (!isNaN(value)) {
                    console.log("Valid numeric value:", value, "for column:", col.header);
                                    numericData[this.headers[j]] = value;
                                    numericFieldCount++;
                                }
                            }
                        }
                        
                        if (numericFieldCount > 0) {
                            hourlyGroups[hour].push(numericData);
                        }
                        
                        // Debug first few rows
                        if (i < 3) {
                            console.log(`Row ${i}: time="${timeStr}" → hour=${hour}, numeric fields=${numericFieldCount}`, numericData);
                        }
                    } else {
                        invalidTimeCount++;
                        if (i < 10) console.log('Invalid date:', timeStr, 'at row', i);
                    }
                } catch (error) {
                    invalidTimeCount++;
                    if (i < 10) console.log('Error parsing date:', timeStr, 'at row', i, 'Error:', error);
                    continue;
                }
            } else {
                emptyTimeCount++;
                if (i < 10) console.log('Empty time value at row', i);
            }
        }

        console.log(`Time parsing summary: ${validTimeCount} valid, ${invalidTimeCount} invalid, ${emptyTimeCount} empty`);

        return hourlyGroups;
    }

    calculateHourlyAverages(hourlyGroups, timeColumnIndex) {
        const averages = {};

        for (let hour = 0; hour < 24; hour++) {
            const hourData = hourlyGroups[hour];
            averages[hour] = {};

            if (hourData.length > 0) {
                console.log(`Hour ${hour}: ${hourData.length} records`);
                // Calculate average for each column (excluding time column)
                for (let j = 0; j < this.headers.length; j++) {
                    if (j !== timeColumnIndex) { // Skip time column
                        const columnName = this.headers[j];
                        const validValues = hourData
                            .map(row => row[columnName])
                            .filter(val => val !== undefined && !isNaN(val));

                        if (validValues.length > 0) {
                            const sum = validValues.reduce((acc, val) => acc + val, 0);
                            averages[hour][columnName] = (sum / validValues.length);
                            console.log(`  ${columnName}: ${validValues.length} values, avg = ${averages[hour][columnName]}`);
                        } else {
                            averages[hour][columnName] = 0; // Default for missing data
                        }
                    }
                }
            } else {
                // No data for this hour, fill with zeros
                for (let j = 0; j < this.headers.length; j++) {
                    if (j !== timeColumnIndex) { // Skip time column
                        averages[hour][this.headers[j]] = 0;
                    }
                }
            }
        }

        return averages;
    }

    formatHourlyOutput(averages, timeColumnIndex) {
        // Get the first date from the dataset to use as base
        const firstTimestamp = this.csvData.length > 0 ? this.csvData[0][timeColumnIndex] : null;
        let baseDate;
        
        if (firstTimestamp) {
            try {
                baseDate = new Date(firstTimestamp);
                // Set to start of day
                baseDate.setHours(0, 0, 0, 0);
            } catch {
                baseDate = new Date();
                baseDate.setHours(0, 0, 0, 0);
            }
        } else {
            baseDate = new Date();
            baseDate.setHours(0, 0, 0, 0);
        }

        // Build headers: put Time first, then other columns (excluding the original time column)
        const headers = ['Time'];
        for (let j = 0; j < this.headers.length; j++) {
            if (j !== timeColumnIndex) {
                headers.push(this.headers[j]);
            }
        }
        
        console.log('Output headers:', headers);
        
        const data = [];

        for (let hour = 0; hour < 24; hour++) {
            const timeForHour = new Date(baseDate);
            timeForHour.setHours(hour);
            
            const row = [timeForHour.toISOString()];
            
            // Add averaged values, rounded to 3 decimal places
            for (let j = 0; j < this.headers.length; j++) {
                if (j !== timeColumnIndex) {
                    const columnName = this.headers[j];
                    const value = averages[hour][columnName] || 0;
                    row.push(parseFloat(value.toFixed(3)));
                }
            }
            
            data.push(row);
        }

        console.log('Sample output rows:', data.slice(0, 3));
        return { headers, data };
    }

    displayAveragedData(avgData) {
        // Update the internal data structure
        this.headers = avgData.headers;
        this.csvData = avgData.data;
        
        // Update the filename for 24hr file
        let newFileName;
        if (this.fileName.toLowerCase().includes('_std')) {
            newFileName = this.fileName.replace(/_std\.csv$/i, '_24hr.csv');
        } else {
            const baseName = this.fileName.replace(/\.csv$/i, '');
            newFileName = `${baseName}_24hr.csv`;
        }
        this.fileName = newFileName;
        
        // Re-render the table with averaged data
        this.renderTable();
        
        // Update file info to show averaging details
        this.updateFileInfoForAveraging(avgData);
    }

    updateFileInfoForAveraging(avgData) {
        const fileDetails = document.getElementById('fileDetails');
        
        const recordCount = avgData.data.length;
        const columnCount = avgData.headers.length;
        
        // Create averaging details
        const averagingInfo = document.createElement('div');
        averagingInfo.className = 'averaging-info';
        averagingInfo.style.cssText = `
            margin-top: 15px;
            padding: 15px;
            background: #e6f8e6;
            border-radius: 8px;
            border-left: 4px solid #34c759;
        `;
        
        averagingInfo.innerHTML = `
            <div style="font-weight: 600; color: #34c759; margin-bottom: 10px;">
                ✓ Converted to 24-hour averages
            </div>
            <div style="font-size: 0.9rem; color: #1d1d1f;">
                <strong>Output:</strong> ${recordCount} hourly records, ${columnCount} columns<br>
                <strong>Columns averaged:</strong> ${avgData.headers.slice(1).join(', ')}<br>
                <strong>Time range:</strong> 00:00 - 23:00 (24 hours)
            </div>
        `;
        
        // Remove existing conversion/averaging info if present
        const existingInfo = document.querySelectorAll('.conversion-info, .averaging-info');
        existingInfo.forEach(info => info.remove());
        
        fileDetails.appendChild(averagingInfo);
    }

    showError(message) {
        // Create a simple error notification
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff3b30;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 500;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    showSuccess(message) {
        // Create a simple success notification
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2B7A78;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 500;
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
}

// Navigation functionality
class NavigationManager {
    constructor() {
        this.currentPage = 'reformat';
        this.availableFiles = [];
        this.sites = new Set();
        this.sources = new Set();
        this.initializeNavigation();
        this.initializePlotPage();

        // Initialize slider states on page load
        this.initializeSliderStates();
    }

    initializeSliderStates() {
        // Set initial thumb positions for both sliders
        this.updateSliderThumb(this.currentPage);
    }

    initializeNavigation() {
        const sliderIcons = document.querySelectorAll('.slider-icon');
        sliderIcons.forEach(icon => {
            icon.addEventListener('click', async () => {
                const targetPage = icon.getAttribute('data-page');
                await this.switchPage(targetPage);
            });
        });
    }

    async switchPage(pageName) {
        // Update slider icons
        document.querySelectorAll('.slider-icon').forEach(icon => {
            icon.classList.remove('active');
        });
        document.querySelector(`.slider-icon[data-page="${pageName}"]`).classList.add('active');

        // Update slider thumb position
        this.updateSliderThumb(pageName);

        // Update page content
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(`${pageName}Page`).classList.add('active');

        this.currentPage = pageName;

        // If switching to plot page, update file info
        if (pageName === 'plot') {
            console.log(`Switching to ${pageName} page - refreshing file information...`);

            // Force refresh the file list from csvManager
            if (csvManager && csvManager.workingDirFiles) {
                console.log(`Plot page: Found ${csvManager.workingDirFiles.length} files in working directory`);
                csvManager.workingDirFiles.forEach(file => {
                    console.log(`  - ${file.name}`);
                });
            }

            await this.updatePlotPageFileInfo(pageName);
            console.log(`${pageName} page file info updated`);
        }
    }

    updateSliderThumb(pageName) {
        // Update FPOD slider
        const fpodContainer = document.querySelector('.fpod-container');
        const fpodThumb = fpodContainer?.querySelector('.slider-thumb');

        if (pageName === 'reformat') {
            // Reset both thumbs, then set active one
            if (fpodThumb) fpodThumb.style.transform = 'translateX(0px)';
        } else if (pageName === 'plot') {
            // Reset both thumbs, then set active one
            if (fpodThumb) fpodThumb.style.transform = 'translateX(56px)';
        }
    }
    initializePlotPage() {
        // Initialize dropdowns and button event listeners
        this.initializeComparisonControls();
        this.initializeBladeCountControls();
    }

    initializeComparisonControls() {
        // Site comparison controls
        const sourceSelect1 = document.getElementById('sourceSelect1');
        const sitesSelect1 = document.getElementById('sitesSelect1');
        const generateSiteComparisonBtn = document.getElementById('generateSiteComparisonBtn');

        // Source comparison controls
        const siteSelect2 = document.getElementById('siteSelect2');
        const sourcesSelect2 = document.getElementById('sourcesSelect2');
        const generateSourceComparisonBtn = document.getElementById('generateSourceComparisonBtn');

        // Add event listeners for enabling/disabling buttons
        const updateSiteComparisonButton = () => {
            const sourceSelected = sourceSelect1.value;
            const sitesSelected = Array.from(sitesSelect1.selectedOptions).map(option => option.value);
            generateSiteComparisonBtn.disabled = !sourceSelected || sitesSelected.length < 1;
        };

        const updateSourceComparisonButton = () => {
            const siteSelected = siteSelect2.value;
            const sourcesSelected = Array.from(sourcesSelect2.selectedOptions).map(option => option.value);
            generateSourceComparisonBtn.disabled = !siteSelected || sourcesSelected.length < 1;
        };

        // Add event listeners
        if (sourceSelect1) sourceSelect1.addEventListener('change', updateSiteComparisonButton);
        if (sitesSelect1) sitesSelect1.addEventListener('change', updateSiteComparisonButton);
        if (siteSelect2) siteSelect2.addEventListener('change', updateSourceComparisonButton);
        if (sourcesSelect2) sourcesSelect2.addEventListener('change', updateSourceComparisonButton);

        // Button click handlers (placeholder functionality)
        if (generateSiteComparisonBtn) {
            generateSiteComparisonBtn.addEventListener('click', () => {
                const source = sourceSelect1.value;
                const sites = Array.from(sitesSelect1.selectedOptions).map(option => option.value);
                this.generateSiteComparison(source, sites);
            });
        }

        if (generateSourceComparisonBtn) {
            generateSourceComparisonBtn.addEventListener('click', () => {
                const site = siteSelect2.value;
                const sources = Array.from(sourcesSelect2.selectedOptions).map(option => option.value);
                this.generateSourceComparison(site, sources);
            });
        }

        // Standard DPM controls
        const sourceSelectStd1 = document.getElementById('sourceSelectStd1');
        const sitesSelectStd1 = document.getElementById('sitesSelectStd1');
        const generateSiteComparisonStdBtn = document.getElementById('generateSiteComparisonStdBtn');

        const siteSelectStd2 = document.getElementById('siteSelectStd2');
        const sourcesSelectStd2 = document.getElementById('sourcesSelectStd2');
        const generateSourceComparisonStdBtn = document.getElementById('generateSourceComparisonStdBtn');

        // Add event listeners for std buttons
        const updateStdSiteComparisonButton = () => {
            const sourceSelected = sourceSelectStd1?.value;
            const sitesSelected = Array.from(sitesSelectStd1?.selectedOptions || []).map(option => option.value);
            if (generateSiteComparisonStdBtn) {
                generateSiteComparisonStdBtn.disabled = !sourceSelected || sitesSelected.length < 1;
            }
        };

        const updateStdSourceComparisonButton = () => {
            const siteSelected = siteSelectStd2?.value;
            const sourcesSelected = Array.from(sourcesSelectStd2?.selectedOptions || []).map(option => option.value);
            if (generateSourceComparisonStdBtn) {
                generateSourceComparisonStdBtn.disabled = !siteSelected || sourcesSelected.length < 1;
            }
        };

        // Add event listeners for std controls
        if (sourceSelectStd1) sourceSelectStd1.addEventListener('change', updateStdSiteComparisonButton);
        if (sitesSelectStd1) sitesSelectStd1.addEventListener('change', updateStdSiteComparisonButton);
        if (siteSelectStd2) siteSelectStd2.addEventListener('change', updateStdSourceComparisonButton);
        if (sourcesSelectStd2) sourcesSelectStd2.addEventListener('change', updateStdSourceComparisonButton);

        // Std button click handlers
        if (generateSiteComparisonStdBtn) {
            generateSiteComparisonStdBtn.addEventListener('click', () => {
                const source = sourceSelectStd1.value;
                const sites = Array.from(sitesSelectStd1.selectedOptions).map(option => option.value);
                this.generateStdSiteComparison(source, sites);
            });
        }

        if (generateSourceComparisonStdBtn) {
            generateSourceComparisonStdBtn.addEventListener('click', () => {
                const site = siteSelectStd2.value;
                const sources = Array.from(sourcesSelectStd2.selectedOptions).map(option => option.value);
                this.generateStdSourceComparison(site, sources);
            });
        }

        // Length distribution controls
        const lengthSelect1 = document.getElementById('lengthSelect1');
        const sitesSelectLength1 = document.getElementById('sitesSelectLength1');
        const generateSiteComparisonLengthBtn = document.getElementById('generateSiteComparisonLengthBtn');

        const siteSelectLength2 = document.getElementById('siteSelectLength2');
        const lengthVarsSelect2 = document.getElementById('lengthVarsSelect2');
        const generateVariableComparisonLengthBtn = document.getElementById('generateVariableComparisonLengthBtn');

        // Add event listeners for length distribution buttons
        const updateLengthSiteComparisonButton = () => {
            const siteSelected = sitesSelectLength1?.value;
            const varsSelected = Array.from(lengthSelect1?.selectedOptions || []).map(option => option.value);
            if (generateSiteComparisonLengthBtn) {
                generateSiteComparisonLengthBtn.disabled = !siteSelected || varsSelected.length < 1;
            }
        };

        const updateLengthVariableComparisonButton = () => {
            const siteSelected = siteSelectLength2?.value;
            const varsSelected = Array.from(lengthVarsSelect2?.selectedOptions || []).map(option => option.value);
            if (generateVariableComparisonLengthBtn) {
                generateVariableComparisonLengthBtn.disabled = !siteSelected || varsSelected.length < 1;
            }
        };

        // Add event listeners for length controls
        if (lengthSelect1) lengthSelect1.addEventListener('change', updateLengthSiteComparisonButton);
        if (sitesSelectLength1) sitesSelectLength1.addEventListener('change', updateLengthSiteComparisonButton);
        if (siteSelectLength2) siteSelectLength2.addEventListener('change', updateLengthVariableComparisonButton);
        if (lengthVarsSelect2) lengthVarsSelect2.addEventListener('change', updateLengthVariableComparisonButton);

        // Length button click handlers
        if (generateSiteComparisonLengthBtn) {
            generateSiteComparisonLengthBtn.addEventListener('click', () => {
                const site = sitesSelectLength1.value;
                const lengthVars = Array.from(lengthSelect1.selectedOptions).map(option => option.value);
                this.generateLengthDistributionFromFirstCard(site, lengthVars);
            });
        }

        if (generateVariableComparisonLengthBtn) {
            generateVariableComparisonLengthBtn.addEventListener('click', () => {
                const site = siteSelectLength2.value;
                const lengthVars = Array.from(lengthVarsSelect2.selectedOptions).map(option => option.value);
                this.generateLengthVariableComparison(site, lengthVars);
            });
        }
    }

    async updatePlotPageFileInfo(pageName = 'plot') {
        console.log(`=== UPDATING ${pageName.toUpperCase()} PAGE FILE INFO ===`);
        
        // Get file info from csvManager if available
        let fileList = csvManager && csvManager.workingDirFiles ? csvManager.workingDirFiles : [];
        console.log(`Initial file list has ${fileList.length} files`);
        
        // Also gather all file versions from fileInfos Map to ensure nothing is missed
        if (csvManager && csvManager.fileInfos) {
            const allFileVersions = [];
            csvManager.fileInfos.forEach((fileInfo, baseName) => {
                fileInfo.versions.forEach((file, version) => {
                    // Check if this file is already in the fileList
                    if (!fileList.find(f => f.name === file.name)) {
                        allFileVersions.push(file);
                        console.log(`Adding missing file version: ${file.name} (${version})`);
                    }
                });
            });
            
            // Add any missing file versions
            fileList = [...fileList, ...allFileVersions];
            console.log(`Enhanced file list now has ${fileList.length} files`);
        }
        
        this.availableFiles = fileList;
        
        // Extract sites and sources from filenames
        await this.extractSitesAndSources(fileList);
        
        // Update dropdowns
        this.updateDropdowns(pageName);
        
        // Update status display
        this.updateStatusDisplay();
        
        console.log('✅ Plot page file info update complete');
    }

    async extractSitesAndSources(fileList) {
        this.sites.clear();
        this.sources.clear();
        this.hr24Files = []; // Store actual _24hr files
        this.stdFiles = []; // Store actual _std files
        
        // First, get sources from column headers if we have loaded files
        if (csvManager && csvManager.headers && csvManager.headers.length > 0) {
            // Extract all non-time columns as potential DPM sources
            csvManager.headers.forEach(header => {
                const headerLower = header.toLowerCase();
                // Skip time/date columns - include everything else as potential DPM columns
                if (!headerLower.includes('time') &&
                    !headerLower.includes('date') &&
                    !headerLower.includes('hour') &&
                    !headerLower.includes('timestamp') &&
                    header.trim() !== '') {
                    this.sources.add(header.trim()); // Use original header name
                }
            });
        }
        
        // If no sources found in headers, fall back to checking all available files
        if (this.sources.size === 0) {
            // Check headers of all available files for sources
            await this.checkAllFilesForSources(fileList);
        }
        
        // Find all _24hr.csv files and _std.csv files
        fileList.forEach(file => {
            const fileName = file.name.toLowerCase();
            if (fileName.includes('24hr') && fileName.endsWith('.csv')) {
                console.log(`Found _24hr file: ${file.name}`);
                this.hr24Files.push(file);
                // Also add to sites for backward compatibility
                this.sites.add(file.name);
            } else if (fileName.includes('std') && fileName.endsWith('.csv')) {
                console.log(`Found _std file: ${file.name}`);
                this.stdFiles.push(file);
            }
        });
        
        console.log(`Found ${this.hr24Files.length} _24hr.csv files and ${this.stdFiles.length} _std.csv files`);

        // Also check std files for additional column headers (they might have different columns)
        if (this.stdFiles.length > 0) {
            await this.checkStdFilesForSources();
        }
    }

    extractSiteFromFilename(baseName) {
        const sites = [];
        console.log(`  Analyzing filename: ${baseName}`);
        
        // Strategy 1: Standard format - site after second underscore
        // Example: FPOD_Alga_Control-S_2504-2506 -> Control-S
        const parts = baseName.split('_');
        if (parts.length >= 3) {
            const potentialSite = parts[2];
            if (potentialSite && !this.isDateLike(potentialSite)) {
                sites.push(potentialSite);
                console.log(`    Strategy 1 (after 2nd underscore): ${potentialSite}`);
            }
        }
        
        // Strategy 2: Look for known site patterns anywhere in the filename
        const sitePatterns = [
            /control[-_]?s/i,
            /farm[-_]?as/i,
            /farm[-_]?l/i,
            /control/i,
            /farm/i
        ];
        
        sitePatterns.forEach((pattern, index) => {
            const match = baseName.match(pattern);
            if (match) {
                let site = match[0];
                // Normalize the site name
                if (site.toLowerCase().includes('control') && site.toLowerCase().includes('s')) {
                    site = 'Control-S';
                } else if (site.toLowerCase().includes('farm') && site.toLowerCase().includes('as')) {
                    site = 'Farm-AS';
                } else if (site.toLowerCase().includes('farm') && site.toLowerCase().includes('l')) {
                    site = 'Farm-L';
                } else if (site.toLowerCase().includes('control')) {
                    site = 'Control';
                } else if (site.toLowerCase().includes('farm')) {
                    site = 'Farm';
                }
                
                if (!sites.includes(site)) {
                    sites.push(site);
                    console.log(`    Strategy 2 (pattern ${index + 1}): ${site}`);
                }
            }
        });
        
        // Strategy 3: Look for parts that look like site names (contains letters and possibly dashes)
        parts.forEach((part, index) => {
            if (index > 0 && // Skip first part (usually FPOD)
                part.length > 1 && 
                /[a-zA-Z]/.test(part) && 
                !this.isDateLike(part) &&
                !part.toLowerCase().includes('24hr') &&
                !part.toLowerCase().includes('std')) {
                
                if (!sites.some(s => s.toLowerCase() === part.toLowerCase())) {
                    sites.push(part);
                    console.log(`    Strategy 3 (part analysis): ${part}`);
                }
            }
        });
        
        return sites;
    }

    isDateLike(str) {
        // Check if string looks like a date or number
        return /^\d{4}[-]?\d{0,4}$/.test(str) || /^\d+$/.test(str);
    }

    extractSiteNameFromFilename(filename) {
        // Extract site name from filename: take text between 2nd and 4th underscore (PROJECT_REQUIREMENTS)
        // Example: FPOD_Alga_Control-S_2406-2407_24hr.csv -> Control-S_2406-2407
        const parts = filename.split('_');
        if (parts.length >= 4) {
            return parts.slice(2, 4).join('_');
        }
        // Fallback to the filename if extraction fails
        return filename.replace(/\.(csv|CSV)$/, '');
    }

    async checkAllFilesForSources(fileList) {
        console.log('Checking all files for column headers...');

        // Check a few representative files to extract column headers
        for (const file of fileList.slice(0, 3)) { // Check first 3 files
            try {
                console.log(`Checking file: ${file.name}`);
                const csvData = await this.parseCSVFile(file);
                if (csvData && csvData.headers) {
                    csvData.headers.forEach(header => {
                        const headerLower = header.toLowerCase();
                        // Skip time/date columns - include everything else as potential DPM columns
                        if (!headerLower.includes('time') &&
                            !headerLower.includes('date') &&
                            !headerLower.includes('hour') &&
                            !headerLower.includes('timestamp') &&
                            header.trim() !== '') {
                            this.sources.add(header.trim()); // Use original header name
                        }
                    });
                }
            } catch (error) {
                console.warn(`Could not parse file ${file.name}:`, error);
            }
        }

        console.log('Found sources from files:', Array.from(this.sources));
    }

    async checkStdFilesForSources() {
        console.log('Checking std files for additional column headers...');

        // Check a few representative std files to extract column headers
        for (const file of this.stdFiles.slice(0, 3)) { // Check first 3 std files
            try {
                console.log(`Checking std file: ${file.name}`);
                const csvData = await this.parseCSVFile(file);
                if (csvData && csvData.headers) {
                    csvData.headers.forEach(header => {
                        const headerLower = header.toLowerCase();
                        // Skip time/date columns - include everything else as potential DPM columns
                        if (!headerLower.includes('time') &&
                            !headerLower.includes('date') &&
                            !headerLower.includes('hour') &&
                            !headerLower.includes('timestamp') &&
                            header.trim() !== '') {
                            this.sources.add(header.trim()); // Use original header name
                        }
                    });
                }
            } catch (error) {
                console.warn(`Could not parse std file ${file.name}:`, error);
            }
        }

        console.log('Total sources after checking std files:', Array.from(this.sources));
    }

    updateDropdowns(pageName = 'plot') {
        const idPrefix = "";
        const sources = Array.from(this.sources).sort();
        const hr24Files = this.hr24Files || [];


        // Update source dropdown for site comparison (DPM columns)
        const sourceSelect1 = document.getElementById(idPrefix + 'sourceSelect1');
        if (sourceSelect1) {
            sourceSelect1.innerHTML = '<option value="">Select DPM column to plot...</option>';
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                sourceSelect1.appendChild(option);
            });
        }
        
        // Update sites dropdown for site comparison (_24hr files)
        const sitesSelect1 = document.getElementById(idPrefix + 'sitesSelect1');
        if (sitesSelect1) {
            sitesSelect1.innerHTML = '';
            hr24Files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name; // Use full filename as value
                option.textContent = file.name; // Show full filename
                sitesSelect1.appendChild(option);
            });
        }
        
        // Update site dropdown for source comparison (_24hr files)
        const siteSelect2 = document.getElementById(idPrefix + 'siteSelect2');
        if (siteSelect2) {
            siteSelect2.innerHTML = '<option value="">Select a _24hr.csv file...</option>';
            hr24Files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name; // Use full filename as value
                option.textContent = file.name; // Show full filename
                siteSelect2.appendChild(option);
            });
        }
        
        // Update sources dropdown for source comparison (DPM columns)
        const sourcesSelect2 = document.getElementById(idPrefix + 'sourcesSelect2');
        if (sourcesSelect2) {
            sourcesSelect2.innerHTML = '';
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                sourcesSelect2.appendChild(option);
            });
        }

        // Update length distribution dropdowns
        this.updateLengthDropdowns(hr24Files, this.stdFiles, pageName);

        // Update blade count dropdowns
        this.updateBladeCountDropdowns(pageName);

        // Update std dropdowns
        this.updateStdDropdowns(sources, this.stdFiles, pageName);
    }

    updateBladeCountDropdowns(pageName = 'plot') {
        console.log("🎛️ DEBUG: Starting blade count dropdown update process");

        // Look for Indiv and Summary files
        const bladeCountFiles = [];

        if (this.availableFiles && this.availableFiles.length > 0) {
            // Look for Indiv files (case insensitive, various patterns)
            const individFiles = this.availableFiles.filter(file => {
                const fileName = file.name.toLowerCase();
                return fileName.includes('indiv') || fileName.includes('_indiv') || fileName.includes('individual');
            });
            bladeCountFiles.push(...individFiles);

            // Look for Summary files (case insensitive, various patterns)
            const summaryFiles = this.availableFiles.filter(file => {
                const fileName = file.name.toLowerCase();
                return fileName.includes('summary') || fileName.includes('_summary') || fileName.includes('summ');
            });
            bladeCountFiles.push(...summaryFiles);
        }

        console.log("📁 DEBUG: Found blade count files:", bladeCountFiles.map(f => f.name));

        // Update data source dropdown
        const dataSourceSelect = document.getElementById('dataSourceSelect');
        if (dataSourceSelect) {
            console.log("🎯 DEBUG: Found dataSourceSelect dropdown, populating with blade count files");
            dataSourceSelect.innerHTML = '<option value="">Select data source...</option>';
            bladeCountFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name;
                dataSourceSelect.appendChild(option);
            });
        }
    }

    updateLengthDropdowns(hr24Files, stdFiles, pageName = 'plot') {
        console.log("🎛️ DEBUG: Starting length distribution dropdown update process");

        // Look for the specific files that should contain length data (like Indiv files)
        const lengthDataFiles = [];

        // Check if availableFiles contains the expected files
        if (this.availableFiles && this.availableFiles.length > 0) {
            // Look for Indiv files (which should contain length data)
            const individFiles = this.availableFiles.filter(file =>
                file.name.includes('Indiv') || file.name.includes('_indiv')
            );
            lengthDataFiles.push(...individFiles);

            // Also check for Summary files as backup
            const summaryFiles = this.availableFiles.filter(file =>
                file.name.includes('Summary') || file.name.includes('_summary')
            );
            lengthDataFiles.push(...summaryFiles);
        }

        console.log("📁 DEBUG: Found length data files:", lengthDataFiles.map(f => f.name));
        const idPrefix = "";

        // Update sites dropdown for length site comparison (length data files) - single select
        const sitesSelectLength1 = document.getElementById(idPrefix + 'sitesSelectLength1');
        if (sitesSelectLength1) {
            console.log("🎯 DEBUG: Found sitesSelectLength1 dropdown, populating with length data files");
            sitesSelectLength1.innerHTML = '<option value="">Select a CSV file...</option>';
            lengthDataFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name;
                sitesSelectLength1.appendChild(option);
            });
        }

        // Update site dropdown for length variable comparison (length data files)
        const siteSelectLength2 = document.getElementById(idPrefix + 'siteSelectLength2');
        if (siteSelectLength2) {
            console.log("🎯 DEBUG: Found siteSelectLength2 dropdown, populating with length data files");
            siteSelectLength2.innerHTML = '<option value="">Select a CSV file...</option>';
            lengthDataFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name;
                siteSelectLength2.appendChild(option);
            });
        }
    }

    updateStdDropdowns(sources, stdFiles, pageName = 'plot') {
        const idPrefix = "";

        // Update source dropdown for std site comparison (DPM columns)
        const sourceSelectStd1 = document.getElementById(idPrefix + 'sourceSelectStd1');
        if (sourceSelectStd1) {
            sourceSelectStd1.innerHTML = '<option value="">Select DPM column to plot...</option>';
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                sourceSelectStd1.appendChild(option);
            });

            // Auto-select first source if available
            if (sources.length > 0) {
                sourceSelectStd1.value = sources[0];
            }
        }

        // Update sites dropdown for std site comparison (_std files)
        const sitesSelectStd1 = document.getElementById(idPrefix + 'sitesSelectStd1');
        if (sitesSelectStd1) {
            sitesSelectStd1.innerHTML = '';
            stdFiles.forEach((file, index) => {
                const option = document.createElement('option');
                option.value = file.name; // Use full filename as value
                option.textContent = file.name;
                sitesSelectStd1.appendChild(option);

                // Auto-select first 2 files if available
                if (index < 2 && stdFiles.length >= 2) {
                    option.selected = true;
                }
            });
        }

        // Update site dropdown for std source comparison (_std files)
        const siteSelectStd2 = document.getElementById(idPrefix + 'siteSelectStd2');
        if (siteSelectStd2) {
            siteSelectStd2.innerHTML = '<option value="">Select a _std.csv file...</option>';
            stdFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name; // Use full filename as value
                option.textContent = file.name;
                siteSelectStd2.appendChild(option);
            });
        }

        // Update sources dropdown for std source comparison
        const sourcesSelectStd2 = document.getElementById(idPrefix + 'sourcesSelectStd2');
        if (sourcesSelectStd2) {
            sourcesSelectStd2.innerHTML = '';
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                sourcesSelectStd2.appendChild(option);
            });
        }

        // Trigger button state updates after setting defaults
        setTimeout(() => {
            // Trigger std site comparison button update
            const sourceSelectStd1 = document.getElementById('sourceSelectStd1');
            const sitesSelectStd1 = document.getElementById('sitesSelectStd1');
            if (sourceSelectStd1 && sitesSelectStd1) {
                const event = new Event('change');
                sourceSelectStd1.dispatchEvent(event);
                sitesSelectStd1.dispatchEvent(event);
            }
        }, 100);
    }

    updateStatusDisplay() {
        const availableFilesStatus = document.getElementById('availableFilesStatus');
        const availableSitesStatus = document.getElementById('availableSitesStatus');
        const availableSourcesStatus = document.getElementById('availableSourcesStatus');
        
        // Update std status displays
        const availableStdFilesStatus = document.getElementById('availableStdFilesStatus');
        const availableStdSitesStatus = document.getElementById('availableStdSitesStatus');
        const availableStdSourcesStatus = document.getElementById('availableStdSourcesStatus');
        
        if (this.availableFiles.length > 0) {
            if (availableFilesStatus) {
                availableFilesStatus.textContent = `Found ${this.availableFiles.length} CSV files in working directory.`;
            }
            if (availableSitesStatus) {
                const sites = Array.from(this.sites);
                availableSitesStatus.textContent = `Available Sites: ${sites.length > 0 ? sites.join(', ') : 'None detected'}`;
            }
            if (availableSourcesStatus) {
                const sources = Array.from(this.sources);
                availableSourcesStatus.textContent = `Available Sources: ${sources.length > 0 ? sources.join(', ') : 'None detected'}`;
            }

            // Update std status displays
            if (availableStdFilesStatus) {
                availableStdFilesStatus.textContent = `Found ${this.stdFiles.length} _std.csv files in working directory.`;
            }
            if (availableStdSitesStatus) {
                const stdSites = this.stdFiles.map(f => f.name);
                availableStdSitesStatus.textContent = `Available Std Sites: ${stdSites.length > 0 ? stdSites.join(', ') : 'None detected'}`;
            }
            if (availableStdSourcesStatus) {
                const sources = Array.from(this.sources);
                availableStdSourcesStatus.textContent = `Available Sources: ${sources.length > 0 ? sources.join(', ') : 'None detected'}`;
            }
        } else {
            if (availableFilesStatus) {
                availableFilesStatus.textContent = 'No directory selected. Please select a working directory first.';
            }
            if (availableSitesStatus) {
                availableSitesStatus.textContent = '';
            }
            if (availableSourcesStatus) {
                availableSourcesStatus.textContent = '';
            }

            // Clear std status displays
            if (availableStdFilesStatus) {
                availableStdFilesStatus.textContent = 'No directory selected. Please select a working directory first.';
            }
            if (availableStdSitesStatus) {
                availableStdSitesStatus.textContent = '';
            }
            if (availableStdSourcesStatus) {
                availableStdSourcesStatus.textContent = '';
            }
        }
    }

    async generateSiteComparison(source, sites) {
        console.log('=== GENERATE SITE COMPARISON START ===');
        console.log('Source:', source);
        console.log('Sites:', sites);
        console.log('Available files:', this.availableFiles?.length || 0);
        console.log('Available files list:', this.availableFiles?.map(f => f.name) || []);
        
        const outputDiv = document.getElementById('siteComparisonOutput');
        if (!outputDiv) {
            console.error('Output div not found');
            return;
        }

        outputDiv.classList.add('active');
        
        // Show loading message
        outputDiv.innerHTML = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; text-align: center;">
                <h4 style="color: #0369a1; margin-bottom: 8px;">🔄 Generating Plot...</h4>
                <p>Loading ${sites.join(', ')} data for ${source} analysis...</p>
                <p style="font-size: 0.8rem; margin-top: 10px;">Debug: Found ${this.availableFiles?.length || 0} files</p>
            </div>
        `;

        try {
            console.log('Starting to load 24hr files...');
            // Load the 24hr CSV files for each selected site
            const siteData = await this.load24hrFilesForSites(sites, source);
            
            console.log('Loaded site data:', siteData.length, 'files');
            siteData.forEach((data, i) => {
                console.log(`Site ${i + 1}:`, data.site, 'File:', data.file?.name);
            });
            
            if (siteData.length === 0) {
                throw new Error('No _24hr files found for the selected sites');
            }

            console.log('Creating plot...');
            // Generate the plot
            this.createSiteComparisonPlot(siteData, source, sites, outputDiv);
            console.log('Plot creation completed');
            
        } catch (error) {
            console.error('Error generating site comparison plot:', error);
            console.error('Error stack:', error.stack);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Could not generate plot:</strong> ${error.message}</p>
                    <p style="margin-top: 10px; font-size: 0.85rem;">
                        Make sure the corresponding _24hr files exist for: ${sites.join(', ')}
                    </p>
                    <p style="margin-top: 10px; font-size: 0.75rem; font-family: monospace;">
                        Debug: Available files: ${this.availableFiles?.map(f => f.name).join(', ') || 'None'}
                    </p>
                </div>
            `;
        }
    }

    async load24hrFilesForSites(selectedFilenames, source) {
        console.log('=== LOAD 24HR FILES FOR SITES ===');
        console.log('Selected filenames:', selectedFilenames);
        console.log('Available files count:', this.availableFiles?.length || 0);
        
        const siteData = [];
        
        for (const filename of selectedFilenames) {
            console.log(`Looking for file: ${filename}`);
            // Find the file by exact filename match
            const file24hr = this.availableFiles.find(file => file.name === filename);
            
            console.log(`Found file for ${filename}:`, file24hr?.name || 'NOT FOUND');
            
            if (file24hr) {
                try {
                    console.log(`Parsing CSV file: ${file24hr.name}`);
                    const data = await this.parseCSVFile(file24hr);
                    console.log(`Parsed data for ${filename}:`, data.headers?.length || 0, 'headers,', data.data?.length || 0, 'rows');
                    
                    siteData.push({
                        site: filename, // Use filename as site identifier
                        file: file24hr,
                        data: data,
                        source: source
                    });
                } catch (error) {
                    console.error(`Error loading file ${filename}:`, error);
                }
            } else {
                console.warn(`File not found: ${filename}`);
            }
        }
        
        console.log('Total site data loaded:', siteData.length);
        return siteData;
    }

    find24hrFileForSite(site) {
        console.log(`=== FIND 24HR FILE FOR SITE: ${site} ===`);
        console.log('Available files:', this.availableFiles?.map(f => f.name) || []);
        
        if (!this.availableFiles || this.availableFiles.length === 0) {
            console.warn('No available files to search through');
            return null;
        }
        
        // Normalize the site name for flexible matching
        const normalizedSite = this.normalizeSiteName(site);
        console.log(`Normalized site name: "${site}" -> "${normalizedSite}"`);
        
        // Try multiple matching strategies
        const strategies = [
            // Strategy 1: Exact match with underscores and 24hr
            (fileName) => {
                const normalized = fileName.toLowerCase().replace(/[-\s]/g, '');
                const siteNormalized = normalizedSite.replace(/[-\s]/g, '');
                return normalized.includes(siteNormalized) && normalized.includes('24hr');
            },
            
            // Strategy 2: Match with original site name and 24hr variations
            (fileName) => {
                const normalized = fileName.toLowerCase();
                const siteVariations = this.getSiteVariations(site);
                const has24hr = normalized.includes('24hr') || normalized.includes('_24hr') || normalized.includes('-24hr');
                return siteVariations.some(variation => normalized.includes(variation.toLowerCase())) && has24hr;
            },
            
            // Strategy 3: Flexible matching for filename parts
            (fileName) => {
                const parts = fileName.toLowerCase().split(/[_\-\.]/);
                const siteVariations = this.getSiteVariations(site);
                const has24hr = parts.some(part => part.includes('24hr'));
                const hasSite = siteVariations.some(variation => 
                    parts.some(part => part.includes(variation.toLowerCase()))
                );
                return hasSite && has24hr;
            }
        ];
        
        // Try each strategy
        for (let i = 0; i < strategies.length; i++) {
            console.log(`Trying strategy ${i + 1}...`);
            
            const foundFile = this.availableFiles.find(file => {
                const fileName = file.name;
                const isMatch = strategies[i](fileName);
                
                console.log(`  Checking file: ${fileName}`);
                console.log(`    Strategy ${i + 1} match: ${isMatch}`);
                
                return isMatch;
            });
            
            if (foundFile) {
                console.log(`Found file with strategy ${i + 1}: ${foundFile.name}`);
                return foundFile;
            }
        }
        
        console.log(`No file found for site: ${site}`);
        console.log('Consider these available files:');
        this.availableFiles.forEach(file => {
            console.log(`  - ${file.name}`);
        });
        
        return null;
    }

    normalizeSiteName(site) {
        // Remove common prefixes/suffixes and normalize
        return site
            .replace(/^(site|location|area)/i, '')
            .replace(/(site|location|area)$/i, '')
            .trim()
            .toLowerCase();
    }

    getSiteVariations(site) {
        const variations = [site];
        const normalized = site.toLowerCase();
        
        // Add variations with different separators
        variations.push(
            site.replace(/-/g, '_'),     // Control-S -> Control_S
            site.replace(/_/g, '-'),     // Control_S -> Control-S
            site.replace(/[-_]/g, ''),   // Control-S -> ControlS
            normalized,
            normalized.replace(/-/g, '_'),
            normalized.replace(/_/g, '-'),
            normalized.replace(/[-_]/g, '')
        );
        
        // Add specific common variations
        if (normalized.includes('control')) {
            variations.push('ctrl', 'control', 'cont');
        }
        if (normalized.includes('farm')) {
            variations.push('farm', 'frm');
        }
        
        // Remove duplicates
        return [...new Set(variations)];
    }

    async parseCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;
                    const lines = csvText.trim().split(/\r\n|\n/);
                    const headers = lines[0].split(',').map(h => h.trim());
                    const data = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.trim());
                        const row = {};
                        headers.forEach((header, index) => {
                            row[header] = values[index];
                        });
                        data.push(row);
                    }
                    
                    resolve({ headers, data });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    createSiteComparisonPlot(siteData, source, sites, outputDiv) {
        console.log('=== CREATE SITE COMPARISON PLOT ===');
        console.log('Site data:', siteData.length, 'sites');
        console.log('Source:', source);
        console.log('Sites:', sites);
        console.log('Output div:', !!outputDiv);
        
        try {
            // Create the plot container
            console.log('Creating plot container...');
            const plotContainer = document.createElement('div');
            if (!plotContainer) {
                throw new Error('Failed to create plot container div');
            }
            plotContainer.style.cssText = 'width: 100%; height: 400px; position: relative; background: white; border-radius: 6px; padding: 20px;';
            
            console.log('Creating canvas element...');
            const canvas = document.createElement('canvas');
            if (!canvas) {
                throw new Error('Failed to create canvas element');
            }
            
            console.log('Setting canvas properties...');
            canvas.width = 800;
            canvas.height = 400;
            canvas.style.cssText = 'width: 100%; height: 100%;';
            
            console.log('Appending canvas to container...');
            plotContainer.appendChild(canvas);
            
            console.log('Getting 2D context...');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get 2D context from canvas');
            }
            console.log('Canvas and context created successfully');
        
            // Define professional journal-style colors (Nature journal style)
            const journalColors = [
                '#1f77b4', // Blue
                '#ff7f0e', // Orange  
                '#2ca02c', // Green
                '#d62728', // Red
                '#9467bd', // Purple
                '#8c564b', // Brown
                '#e377c2', // Pink
                '#7f7f7f', // Gray
                '#bcbd22', // Olive
                '#17becf'  // Cyan
            ];
            
            // Set up professional plot dimensions with more space for labels
            const plotArea = {
                left: 90,
                right: 700,
                top: 80,
                bottom: 320,
                width: 610,
                height: 240
            };
            
            console.log('Clearing canvas...');
            // Clear canvas with professional white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            console.log('Title and subtitle removed for cleaner appearance');
            // Title and subtitle removed
            
            console.log('Preparing data for plotting...');
            // Prepare data for plotting - first extract all available time points from all sites
            let allTimePoints = new Set();
            siteData.forEach(siteInfo => {
                const hourlyData = this.extractHourlyData(siteInfo.data, source);
                Object.keys(hourlyData).forEach(hour => allTimePoints.add(hour));
            });

            // Sort time points properly by converting to Date objects
            const sortedHours = Array.from(allTimePoints).sort((a, b) => {
                const dateA = new Date(a.replace(/\//g, "-"));
                const dateB = new Date(b.replace(/\//g, "-"));
                return dateA - dateB;
            });
            
            // Format all dates uniformly as dd/mm/yy
            const hours = sortedHours.map(timeStr => {
                const date = new Date(timeStr.replace(/\//g, "-"));
                const day = String(date.getDate()).padStart(2, "0");
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const year = String(date.getFullYear()).slice(-2);
                return `${day}/${month}/${year}`;
            });
            console.log(`Using ${hours.length} time points from actual data:`, hours.slice(0, 5), '...');
            console.log("=== DEBUG: Site Comparison Time Range ===");
            console.log("All time points found:", allTimePoints);
            console.log("Sorted hours:", sortedHours.slice(0, 10));
            console.log("Formatted hours:", hours.slice(0, 10));

            let maxDPM = 0;

            const plotData = siteData.map((siteInfo, index) => {
                console.log(`Processing data for site: ${siteInfo.site}`);
                const hourlyData = this.extractHourlyData(siteInfo.data, source);
                console.log(`Hourly data for ${siteInfo.site}:`, Object.keys(hourlyData).length, 'hours');

                const dpmValues = sortedHours.map(hour => {
                console.log("=== DEBUG: Processing site", siteInfo.site, "===");
                console.log("Hourly data keys:", Object.keys(hourlyData));
                console.log("Sorted hours length:", sortedHours.length);
                    return hourlyData[hour] !== undefined ? hourlyData[hour] : null;
                    console.log("Hour", hour, "-> value:", hourlyData[hour], "mapped to:", hourlyData[hour] !== undefined ? hourlyData[hour] : null);
                });
                const validDpmValues = dpmValues.filter(v => v !== null); if (validDpmValues.length > 0) maxDPM = Math.max(maxDPM, ...validDpmValues);
                
                // Extract clean site name from filename
                const siteName = this.extractSiteNameFromFilename(siteInfo.site);
                
                return {
                    site: siteName, // Use clean site name
                    filename: siteInfo.site, // Keep original filename for reference
                    dpmValues: dpmValues,
                    color: journalColors[index % journalColors.length] // Assign color by index
                };
            });
            
            console.log('Max DPM found:', maxDPM);
            
            // Round up maxDPM to nice number
            maxDPM = Math.ceil(maxDPM * 1.1);
            const maxPercentage = Math.ceil((maxDPM / 60) * 100);
            
            console.log('Drawing axes...');
            // Draw axes
            this.drawPlotAxes(ctx, plotArea, hours, maxDPM, maxPercentage, canvas, "Time");
            
            console.log('Plotting site data...');
            // Plot data for each site
            plotData.forEach(siteData => {
                console.log(`Plotting data for site: ${siteData.site}`);
                this.plotSiteData(ctx, plotArea, siteData, hours, maxDPM);
            });
            
            console.log('Drawing legend...');
            // Draw legend
            this.drawPlotLegend(ctx, plotData, plotArea);
            
            console.log('Updating output div...');
            // Clear output div and append plot container directly
            outputDiv.innerHTML = '';
            
            console.log('Appending plot container...');
            outputDiv.appendChild(plotContainer);
            console.log('Plot creation completed successfully');
            
        } catch (error) {
            console.error('Error in createSiteComparisonPlot:', error);
            console.error('Error stack:', error.stack);
            throw error; // Re-throw to be caught by the calling function
        }
    }

    extractHourlyData(csvData, source) {
        console.log(`=== EXTRACT HOURLY DATA FOR SOURCE: ${source} ===`);
        console.log('CSV headers:', csvData.headers);
        console.log('CSV data rows:', csvData.data.length);

        const hourlyData = {};

        csvData.data.forEach((row, index) => {
            if (index < 3) { // Log first few rows for debugging
                console.log(`Row ${index}:`, row);
            }

            // Look for hour column (might be 'Hour', 'Time', etc.)
            const hourKey = Object.keys(row).find(key =>
                key.toLowerCase().includes('hour') || key.toLowerCase().includes('time')
            );

            // Look for the source column (Porpoise, Dolphin, Sonar)
            const sourceKey = Object.keys(row).find(key =>
                key.toLowerCase().includes(source.toLowerCase())
            );

            if (index < 3) {
                console.log(`Row ${index} - Hour key: "${hourKey}", Source key: "${sourceKey}"`);
                if (hourKey) console.log(`  Hour value: "${row[hourKey]}"`);
                if (sourceKey) console.log(`  Source value: "${row[sourceKey]}"`);
            }

            if (hourKey && sourceKey && row[hourKey] && row[sourceKey] !== undefined) {
                let timeIdentifier = row[hourKey];

                // Handle different time formats for std files vs 24hr files
                if (typeof timeIdentifier === 'string' && timeIdentifier.includes('T')) {
                    // ISO timestamp like "2025-03-30T01:00:00.000Z" (common in std files)
                    const dateObj = new Date(timeIdentifier);
                    // Use a unique identifier that combines date and hour for std files
                    const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
                    const hourStr = String(dateObj.getHours()).padStart(2, '0'); // 00-23
                    timeIdentifier = `${dateStr}_${hourStr}`; // e.g., "2025-03-30_14"
                } else {
                    // Use as-is for 24hr files (simple hour numbers)
                    timeIdentifier = String(timeIdentifier).padStart(2, '0');
                }

                const dpm = parseFloat(row[sourceKey]) || 0;
                hourlyData[timeIdentifier] = dpm;

                if (index < 3) {
                    console.log(`  Stored: timeIdentifier="${timeIdentifier}", dpm=${dpm}`);
                }
            }
        });

        console.log('Extracted hourly data:', Object.keys(hourlyData).length, 'hours');
        console.log('Sample hourly data:', Object.fromEntries(Object.entries(hourlyData).slice(0, 5)));

        return hourlyData;
    }

    calculateOptimalLabelSpacing(dataSize) {
        // Calculate spacing to show only 8-12 labels across the entire x-axis
        const targetLabelCount = 10; // Aim for ~10 labels total
        const spacing = Math.max(1, Math.ceil(dataSize / targetLabelCount));

        console.log(`Dataset size: ${dataSize}, calculated spacing: ${spacing}, estimated labels: ${Math.ceil(dataSize / spacing)}`);

        return spacing;
    }

formatTimePointsAsDateLabels(sortedHours, sampleSiteData, formatType = "date") {        // For 24hr file format - use time format when requested (check this FIRST)        if (formatType === "time") {            return sortedHours.map((hour) => {                const hourNum = hour.includes("_") ? parseInt(hour.split("_")[1], 10) : parseInt(hour, 10);                const hours = String(hourNum).padStart(2, "0");                return `${hours}:00`;            });        }        // Check if we're dealing with std file time identifiers (format: "YYYY-MM-DD_HH")        if (sortedHours.length > 0 && sortedHours[0].includes("_")) {            // This is std file format with date_hour identifiers            return sortedHours.map(timeIdentifier => {                const [dateStr, hourStr] = timeIdentifier.split("_");                const date = new Date(dateStr + "T00:00:00Z");                const day = String(date.getDate()).padStart(2, "0");                const month = String(date.getMonth() + 1).padStart(2, "0");                const year = String(date.getFullYear()).slice(-2);                return `${day}/${month}/${year}`;            });        }        // For 24hr file format - use time format when requested
        if (formatType === "time") {
            return sortedHours.map((hour) => {
                const hourNum = hour.includes("_") ? parseInt(hour.split("_")[1], 10) : parseInt(hour, 10);
                const hours = String(hourNum).padStart(2, "0");
                return `${hours}:00`;
            });
        }

        // Fallback for 24hr file format (simple hour numbers)
        let baseDate = null;

        // Try to find a timestamp in the data to extract the base date
        if (sampleSiteData && sampleSiteData.data && sampleSiteData.data.data && sampleSiteData.data.data.length > 0) {
            const firstRow = sampleSiteData.data.data[0];
            const timeKey = Object.keys(firstRow).find(key =>
                key.toLowerCase().includes('time') || key.toLowerCase().includes('date')
            );

            if (timeKey && firstRow[timeKey]) {
                const timeValue = firstRow[timeKey];
                if (typeof timeValue === 'string' && timeValue.includes('T')) {
                    baseDate = new Date(timeValue);
                }
            }
        }

        // If we can't extract a base date, use current date as fallback
        if (!baseDate || isNaN(baseDate.getTime())) {
            baseDate = new Date();
            console.warn('Could not extract base date from data, using current date as fallback');
        }

        // Generate date labels in dd/mm/yy format for each time point
        return sortedHours.map((hour, index) => {
            const date = new Date(baseDate);
            // Add index as days offset (each hour could represent a different day)
            // For std files, this might be days rather than hours
            date.setDate(date.getDate() + index);

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);

            return `${day}/${month}/${year}`;
        });
    }

    extractStandardData(csvData, source) {
        console.log(`=== EXTRACT STANDARD DATA FOR SOURCE: ${source} ===`);
        console.log('CSV headers:', csvData.headers);
        console.log('CSV data rows:', csvData.data.length);

        // Group data by day first, then calculate % detection per day
        const dailyData = {};

        csvData.data.forEach((row, index) => {
            if (index < 3) { // Log first few rows for debugging
                console.log(`Row ${index}:`, row);
            }

            // Look for time column (ISO format)
            const timeKey = Object.keys(row).find(key =>
                key.toLowerCase().includes('time') || key.toLowerCase().includes('hour')
            );

            // Look for the source column (Porpoise, Dolphin, Sonar, etc.)
            const sourceKey = Object.keys(row).find(key =>
                key.toLowerCase().includes(source.toLowerCase())
            );

            if (index < 3) {
                console.log(`Row ${index} - Time key: "${timeKey}", Source key: "${sourceKey}"`);
                if (timeKey) console.log(`  Time value: "${row[timeKey]}"`);
                if (sourceKey) console.log(`  Source value: "${row[sourceKey]}"`);
            }

            if (timeKey && sourceKey && row[timeKey] && row[sourceKey] !== undefined) {
                const timeValue = row[timeKey];
                const dpm = parseFloat(row[sourceKey]) || 0;

                // Parse ISO time format to get date and hour
                let date, hour;
                if (typeof timeValue === 'string' && timeValue.includes('T')) {
                    // ISO timestamp like "2025-03-30T01:00:00.000Z"
                    const dateObj = new Date(timeValue);
                    date = dateObj.toISOString().split('T')[0]; // Get YYYY-MM-DD
                    hour = String(dateObj.getHours()).padStart(2, '0'); // 00-23 format
                } else {
                    // Fallback - assume it's just hour data
                    date = 'unknown';
                    hour = String(timeValue).padStart(2, '0');
                }

                // Initialize day data if not exists
                if (!dailyData[date]) {
                    dailyData[date] = { totalHours: 0, detectedHours: 0, hourlyData: {} };
                }

                // Track this hour
                dailyData[date].totalHours++;
                dailyData[date].hourlyData[hour] = dpm;

                // Count as detected if DPM > 0
                if (dpm > 0) {
                    dailyData[date].detectedHours++;
                }

                if (index < 3) {
                    console.log(`  Processed: date="${date}", hour="${hour}", dpm=${dpm}, detected=${dpm > 0}`);
                }
            }
        });

        // Calculate % detection per day and aggregate by hour across all days
        const hourlyPercentages = {};
        let totalDays = 0;

        // Initialize all hours to 0
        for (let h = 0; h < 24; h++) {
            hourlyPercentages[String(h + 1).padStart(2, '0')] = 0; // Using 01-24 format
        }

        Object.keys(dailyData).forEach(date => {
            const dayData = dailyData[date];
            const dayPercentage = dayData.totalHours > 0 ? (dayData.detectedHours / dayData.totalHours) * 100 : 0;

            console.log(`Day ${date}: ${dayData.detectedHours}/${dayData.totalHours} hours detected (${dayPercentage.toFixed(1)}%)`);

            // For each hour in this day, add the day's percentage if there was detection
            Object.keys(dayData.hourlyData).forEach(hour => {
                const hourDPM = dayData.hourlyData[hour];
                const displayHour = String(parseInt(hour) + 1).padStart(2, '0'); // Convert to 01-24 format

                if (hourDPM > 0) {
                    // This hour had detection, so add the day's detection percentage
                    if (!hourlyPercentages[displayHour]) hourlyPercentages[displayHour] = 0;
                    hourlyPercentages[displayHour] += dayPercentage;
                }
            });

            totalDays++;
        });

        // Average the percentages across all days
        Object.keys(hourlyPercentages).forEach(hour => {
            if (totalDays > 0) {
                hourlyPercentages[hour] = hourlyPercentages[hour] / totalDays;
            }
        });

        console.log('Calculated hourly percentages:', Object.keys(hourlyPercentages).length, 'hours');
        console.log('Sample hourly percentages:', Object.fromEntries(Object.entries(hourlyPercentages).slice(0, 5)));
        console.log(`Total days processed: ${totalDays}`);

        return hourlyPercentages;
    }

    drawPlotAxes(ctx, plotArea, hours, maxDPM, maxPercentage, canvas, xAxisLabel = "Date") {
        // Softer, elegant styling
        ctx.strokeStyle = '#d0d0d0';  // Light gray for axes
        ctx.lineWidth = 1;
        ctx.font = '13px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666666';  // Softer text color
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(plotArea.left, plotArea.bottom);
        ctx.lineTo(plotArea.right, plotArea.bottom);
        ctx.stroke();
        
        // Y-axis (left - DPM)
        ctx.beginPath();
        ctx.moveTo(plotArea.left, plotArea.top);
        ctx.lineTo(plotArea.left, plotArea.bottom);
        ctx.stroke();
        
        // Y-axis (right - Percentage)
        ctx.beginPath();
        ctx.moveTo(plotArea.right, plotArea.top);
        ctx.lineTo(plotArea.right, plotArea.bottom);
        ctx.stroke();
        
        // X-axis labels (hours)
        const xStep = plotArea.width / (hours.length - 1);
        hours.forEach((hour, i) => {
            const x = plotArea.left + (i * xStep);
            
            // Tick mark
            ctx.beginPath();
            ctx.moveTo(x, plotArea.bottom);
            ctx.lineTo(x, plotArea.bottom + 5);
            ctx.stroke();
            
            // Label with intelligent spacing to avoid crowding - rotated at 45 degrees
            const labelSpacing = this.calculateOptimalLabelSpacing(hours.length);
            if (i % labelSpacing === 0 || i === hours.length - 1) { // Always show first, last, and spaced labels
                ctx.save();
                ctx.translate(x, plotArea.bottom + 20);
                ctx.rotate(-Math.PI / 4); // -45 degrees
                ctx.textAlign = 'right';
                ctx.fillText(hour, 0, 0);
                ctx.restore();
            }
        });
        
        // Left Y-axis labels (DPM)
        ctx.textAlign = 'right';
        const dpmSteps = 5;
        for (let i = 0; i <= dpmSteps; i++) {
            const dpm = (maxDPM / dpmSteps) * i;
            const y = plotArea.bottom - (plotArea.height / dpmSteps) * i;
            
            // Tick mark
            ctx.beginPath();
            ctx.moveTo(plotArea.left - 5, y);
            ctx.lineTo(plotArea.left, y);
            ctx.stroke();
            
            // Label (moved closer to axis)
            ctx.fillText(dpm.toFixed(1), plotArea.left - 6, y + 4);
        }
        
        // Add horizontal gridlines for Y-axis major ticks (faint)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i < dpmSteps; i++) { // Skip 0 and max to avoid overlapping with axes
            const y = plotArea.bottom - (plotArea.height / dpmSteps) * i;
            ctx.beginPath();
            ctx.moveTo(plotArea.left, y);
            ctx.lineTo(plotArea.right, y);
            ctx.stroke();
        }
        
        // Add vertical gridlines for X-axis major ticks (faint)
        // Use the xStep already declared above
        const gridSpacing = this.calculateOptimalLabelSpacing(hours.length);
        for (let i = gridSpacing; i < hours.length - 1; i += gridSpacing) { // Skip first and last, use intelligent spacing
            const x = plotArea.left + (i * xStep);
            ctx.beginPath();
            ctx.moveTo(x, plotArea.top);
            ctx.lineTo(x, plotArea.bottom);
            ctx.stroke();
        }
        
        // Add horizontal line at top to complete the rectangle
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotArea.left, plotArea.top);
        ctx.lineTo(plotArea.right, plotArea.top);
        ctx.stroke();
        
        // Reset styles for other elements
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 1;
        
        // Right Y-axis labels (Percentage)
        ctx.textAlign = 'left';
        for (let i = 0; i <= dpmSteps; i++) {
            const percentage = (maxPercentage / dpmSteps) * i;
            const y = plotArea.bottom - (plotArea.height / dpmSteps) * i;
            
            // Tick mark
            ctx.beginPath();
            ctx.moveTo(plotArea.right, y);
            ctx.lineTo(plotArea.right + 5, y);
            ctx.stroke();
            
            // Label (moved closer to axis)
            ctx.fillText(percentage.toFixed(1) + '%', plotArea.right + 6, y + 4);
        }
        
        // Elegant axis labels
        ctx.textAlign = 'center';
        ctx.font = '14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.fillStyle = '#555555';
        
        // X-axis label (positioned lower to avoid overlap with rotated tick labels)
        ctx.fillText(xAxisLabel, plotArea.left + plotArea.width / 2, xAxisLabel === "Date" ? plotArea.bottom + 75 : plotArea.bottom + 65);
        
        // Left Y-axis label (moved much more RIGHT towards center)
        ctx.save();
        ctx.translate(40, plotArea.top + plotArea.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Detection Positive Minutes (DPM)', 0, 0);
        ctx.restore();
        
        // Right Y-axis label (positioned properly for current canvas size)
        ctx.save();
        ctx.translate(plotArea.right + 80, plotArea.top + plotArea.height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillText('Detection rate (% of hour)', 0, 0);
        ctx.restore();
    }

    plotSiteData(ctx, plotArea, siteData, hours, maxDPM) {
        console.log("=== DEBUG: plotSiteData ===");
        console.log("Site:", siteData.site);
        console.log("DPM values length:", siteData.dpmValues.length);
        console.log("Hours length:", hours.length);
        console.log("DPM values sample:", siteData.dpmValues.slice(0, 10));
        console.log("Null count:", siteData.dpmValues.filter(v => v === null).length);
        const { site, dpmValues, color } = siteData;
        
        // Professional smooth line styling
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const xStep = plotArea.width / (hours.length - 1);
        
        // Create smooth curve without data points
        if (points.length < 2) {
            console.log("Not enough valid points for site", site, "- only", points.length, "valid points");
            return;
        }
        
        ctx.beginPath();
        
        // Calculate points, filtering out null values
        const points = [];
        dpmValues.forEach((dpm, i) => {
            if (dpm !== null) {
                points.push({
                    x: plotArea.left + (i * xStep),
                    y: plotArea.bottom - (dpm / maxDPM) * plotArea.height
                });
            }
        });
        
        // Start the path
        ctx.moveTo(points[0].x, points[0].y);
        
        // Draw smooth curves using quadratic bezier curves
        for (let i = 1; i < points.length; i++) {
            const current = points[i];
            const previous = points[i - 1];
            
            if (i === points.length - 1) {
                // Last point - draw straight line
                ctx.lineTo(current.x, current.y);
            } else {
                // Create smooth curve using quadratic bezier
                const next = points[i + 1];
                const cpX = current.x;
                const cpY = current.y;
                const endX = (current.x + next.x) / 2;
                const endY = (current.y + next.y) / 2;
                
                // Enhanced smoothing with catmull-rom style curves
                const cpX1 = (current.x + previous.x) / 2;
                const cpY1 = (current.y + previous.y) / 2;
                const cpX2 = (current.x + next.x) / 2;
                const cpY2 = (current.y + next.y) / 2;
                
                ctx.bezierCurveTo(
                    previous.x + (current.x - previous.x) / 6,
                    previous.y + (current.y - previous.y) / 6,
                    current.x - (next.x - current.x) / 6,
                    current.y - (next.y - current.y) / 6,
                    current.x,
                    current.y
                );
            }
        }
        
        ctx.stroke();
    }

    drawPlotLegend(ctx, plotData, plotArea) {
        // Legend positioning aligned to left like the second plot
        const legendX = plotArea.left + 20;
        const legendY = plotArea.top + 20;

        // File name truncation function (2nd to 4th underscore)
        const truncateFileName = (fileName) => {
            const parts = fileName.split('_');
            if (parts.length >= 4) {
                return parts.slice(2, 4).join('_');
            }
            return fileName; // Return original if not enough underscores
        };

        // Calculate legend box dimensions dynamically based on text content
        const legendPadding = 6;
        const lineHeight = 20;

        // Set font for measurement
        ctx.font = '14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';

        // Calculate maximum text width
        let maxTextWidth = 0;
        plotData.forEach((siteData) => {
            let displayName;
            if (plotData.length === 1) {
                displayName = truncateFileName(siteData.site);
            } else {
                displayName = siteData.site; // Already truncated by extractSiteNameFromFilename
            }
            const textWidth = ctx.measureText(displayName).width;
            maxTextWidth = Math.max(maxTextWidth, textWidth);
        });

        // Legend width: line sample (30px) + text width + padding
        const legendWidth = maxTextWidth + 46; // Component-based: 8px padding + 24px icon + 6px gap + text + 8px padding
        const legendHeight = (plotData.length * lineHeight) + (legendPadding * 2);

        // Draw legend background box with transparency
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // White with 30% transparency
        ctx.fillRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);

        // Draw legend border
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)'; // Light grey with 50% transparency
        ctx.lineWidth = 0.5; // Reduced from 1 to 0.5 for thinner border
        ctx.strokeRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);

        // Draw legend items
        ctx.font = '14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'left';

        plotData.forEach((siteData, i) => {
            const y = legendY + legendPadding + (i * lineHeight) + (lineHeight / 2);

            // Draw line sample only (no boxes) - adjusted for double padding
            ctx.strokeStyle = siteData.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(legendX, y - 2);
            ctx.lineTo(legendX + 24, y - 2);
            ctx.stroke();

            // Site name with truncation - adjusted for double padding
            ctx.fillStyle = '#374151';
            const displayName = truncateFileName(siteData.site);
            ctx.fillText(displayName, legendX + 30, y + 2);
        });
    }

    async generateSourceComparison(site, sources) {
        const outputDiv = document.getElementById('sourceComparisonOutput');
        if (!outputDiv) return;

        outputDiv.classList.add('active');
        
        // Show loading message
        outputDiv.innerHTML = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; text-align: center;">
                <h4 style="color: #0369a1; margin-bottom: 8px;">🔄 Generating Plot...</h4>
                <p>Loading ${sources.join(', ')} data for ${site} analysis...</p>
            </div>
        `;

        try {
            // Load the 24hr CSV file for the selected site
            const siteData = await this.load24hrFileForSite(site, sources);
            
            if (!siteData) {
                throw new Error(`No _24hr file found for site: ${site}`);
            }

            // Generate the plot
            this.createSourceComparisonPlot(siteData, site, sources, outputDiv);
            
        } catch (error) {
            console.error('Error generating source comparison plot:', error);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Could not generate plot:</strong> ${error.message}</p>
                    <p style="margin-top: 10px; font-size: 0.85rem;">
                        Make sure the corresponding _24hr file exists for: ${site}
                    </p>
                </div>
            `;
        }
    }

    async load24hrFileForSite(filename, sources) {
        console.log('=== LOAD 24HR FILE FOR SOURCE COMPARISON ===');
        console.log('Selected filename:', filename);
        
        // Find the file by exact filename match
        const file24hr = this.availableFiles.find(file => file.name === filename);
        
        if (file24hr) {
            try {
                console.log(`Parsing CSV file: ${file24hr.name}`);
                const data = await this.parseCSVFile(file24hr);
                console.log(`Parsed data:`, data.headers?.length || 0, 'headers,', data.data?.length || 0, 'rows');
                
                return {
                    site: filename, // Use filename as identifier
                    file: file24hr,
                    data: data,
                    sources: sources
                };
            } catch (error) {
                console.error(`Error loading file ${filename}:`, error);
                throw error;
            }
        }
        
        console.warn(`File not found: ${filename}`);
        return null;
    }

    createSourceComparisonPlot(siteData, site, sources, outputDiv) {
        // Create the plot container
        const plotContainer = document.createElement('div');
        plotContainer.style.cssText = 'width: 100%; height: 400px; position: relative; background: white; border-radius: 6px; padding: 20px;';
        
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 400;
        canvas.style.cssText = 'width: 100%; height: 100%;';
        
        plotContainer.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        
        // Use professional journal colors for sources
        const journalColors = [
            '#1f77b4', // Blue
            '#ff7f0e', // Orange  
            '#2ca02c', // Green
            '#d62728', // Red
            '#9467bd', // Purple
            '#8c564b', // Brown
        ];
        
        // Set up professional plot dimensions
        const plotArea = {
            left: 90,
            right: 700,
            top: 80,
            bottom: 320,
            width: 610,
            height: 240
        };
        
        // Clear canvas with professional white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Extract clean site name for processing
        const siteName = this.extractSiteNameFromFilename(site);
        
        // Title and subtitle removed for cleaner appearance
        
        // Prepare data for plotting - first extract all available time points from all sources
        let allTimePoints = new Set();
        sources.forEach(source => {
            const hourlyData = this.extractHourlyData(siteData.data, source);
            Object.keys(hourlyData).forEach(hour => allTimePoints.add(hour));
        });

            // Sort time points properly by converting to Date objects
            const sortedHours = Array.from(allTimePoints).sort((a, b) => {
                const dateA = new Date(a.replace(/\//g, "-"));
                const dateB = new Date(b.replace(/\//g, "-"));
                return dateA - dateB;
            });
            
            // Format all dates uniformly as dd/mm/yy
            const hours = sortedHours.map(timeStr => {
                const date = new Date(timeStr.replace(/\//g, "-"));
                const day = String(date.getDate()).padStart(2, "0");
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const year = String(date.getFullYear()).slice(-2);
                return `${day}/${month}/${year}`;
            });
        console.log(`Using ${hours.length} time points from actual data:`, hours.slice(0, 5), '...');
            console.log("=== DEBUG: Site Comparison Time Range ===");
            console.log("All time points found:", allTimePoints);
            console.log("Sorted hours:", sortedHours.slice(0, 10));
            console.log("Formatted hours:", hours.slice(0, 10));

        let maxDPM = 0;

        const plotData = sources.map((source, index) => {
            const hourlyData = this.extractHourlyData(siteData.data, source);
            const dpmValues = sortedHours.map(hour => {
                console.log("=== DEBUG: Processing site", siteInfo.site, "===");
                console.log("Hourly data keys:", Object.keys(hourlyData));
                console.log("Sorted hours length:", sortedHours.length);
                return hourlyData[hour] !== undefined ? hourlyData[hour] : null;
                    console.log("Hour", hour, "-> value:", hourlyData[hour], "mapped to:", hourlyData[hour] !== undefined ? hourlyData[hour] : null);
            });
            const validDpmValues = dpmValues.filter(v => v !== null); if (validDpmValues.length > 0) maxDPM = Math.max(maxDPM, ...validDpmValues);
            
            return {
                source: source,
                dpmValues: dpmValues,
                color: journalColors[index % journalColors.length] // Assign color by index
            };
        });
        
        // Round up maxDPM to nice number
        maxDPM = Math.ceil(maxDPM * 1.1);
        const maxPercentage = Math.ceil((maxDPM / 60) * 100);
        
        // Draw axes
        this.drawPlotAxes(ctx, plotArea, hours, maxDPM, maxPercentage, canvas, "Time");
        
        // Plot data for each source
        plotData.forEach(sourceData => {
            this.plotSourceData(ctx, plotArea, sourceData, hours, maxDPM);
        });
        
        // Draw legend
        this.drawSourcePlotLegend(ctx, plotData, plotArea);
        
        // Clear output div and append plot container directly
        outputDiv.innerHTML = '';
        
        outputDiv.appendChild(plotContainer);
    }

    plotSourceData(ctx, plotArea, sourceData, hours, maxDPM) {
        const { source, dpmValues, color } = sourceData;
        
        // Professional smooth line styling
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const xStep = plotArea.width / (hours.length - 1);
        
        // Create smooth curve without data points
        if (points.length < 2) {
            console.log("Not enough valid points for site", site, "- only", points.length, "valid points");
            return;
        }
        
        ctx.beginPath();
        
        // Calculate points, filtering out null values
        const points = [];
        dpmValues.forEach((dpm, i) => {
            if (dpm !== null) {
                points.push({
                    x: plotArea.left + (i * xStep),
                    y: plotArea.bottom - (dpm / maxDPM) * plotArea.height
                });
            }
        });
        
        // Start the path
        ctx.moveTo(points[0].x, points[0].y);
        
        // Draw smooth curves using quadratic bezier curves
        for (let i = 1; i < points.length; i++) {
            const current = points[i];
            const previous = points[i - 1];
            
            if (i === points.length - 1) {
                // Last point - draw straight line
                ctx.lineTo(current.x, current.y);
            } else {
                // Create smooth curve using quadratic bezier
                const next = points[i + 1];
                const cpX = current.x;
                const cpY = current.y;
                const endX = (current.x + next.x) / 2;
                const endY = (current.y + next.y) / 2;
                
                // Enhanced smoothing with catmull-rom style curves
                const cpX1 = (current.x + previous.x) / 2;
                const cpY1 = (current.y + previous.y) / 2;
                const cpX2 = (current.x + next.x) / 2;
                const cpY2 = (current.y + next.y) / 2;
                
                ctx.bezierCurveTo(
                    previous.x + (current.x - previous.x) / 6,
                    previous.y + (current.y - previous.y) / 6,
                    current.x - (next.x - current.x) / 6,
                    current.y - (next.y - current.y) / 6,
                    current.x,
                    current.y
                );
            }
        }
        
        ctx.stroke();
    }

    drawSourcePlotLegend(ctx, plotData, plotArea) {
        const legendX = plotArea.left + 20;
        const legendY = plotArea.top + 20;

        // Calculate legend box dimensions dynamically based on text content
        const legendPadding = 10; // Increased for better visual padding
        const lineHeight = 20;

        // Set font for measurement
        ctx.font = '14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';

        // Measure the width of all legend text to determine optimal box size
        let maxTextWidth = 0;
        plotData.forEach((sourceData) => {
            const textWidth = ctx.measureText(sourceData.source).width;
            maxTextWidth = Math.max(maxTextWidth, textWidth);
        });

        // Legend width: line sample (30px) + text width + extra padding
        const legendWidth = maxTextWidth + 46; // Component-based: 8px padding + 24px icon + 6px gap + text + 8px padding
        const legendHeight = (plotData.length * lineHeight) + (legendPadding * 2);

        // Draw legend background box with transparency
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // White with 30% transparency
        ctx.fillRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);

        // Draw legend border
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)'; // Light grey with 50% transparency
        ctx.lineWidth = 0.5; // Reduced from 1 to 0.5 for thinner border
        ctx.strokeRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);
        
        // Draw legend items
        ctx.font = '14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'left';
        
        plotData.forEach((sourceData, i) => {
            const y = legendY + legendPadding + (i * lineHeight) + (lineHeight / 2);
            
            // Draw line sample only (no boxes) - adjusted for double padding
            ctx.strokeStyle = sourceData.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(legendX, y - 2);
            ctx.lineTo(legendX + 24, y - 2);
            ctx.stroke();
            
            // Source name - adjusted for double padding
            ctx.fillStyle = '#374151';
            ctx.fillText(sourceData.source, legendX + 30, y + 2);
        });
    }

    // Standard DPM plotting functions
    async generateStdSiteComparison(source, sites) {
        console.log('=== GENERATE STD SITE COMPARISON START ===');
        console.log('Source:', source);
        console.log('Sites:', sites);
        console.log('Available std files:', this.stdFiles?.length || 0);
        
        const outputDiv = document.getElementById('siteComparisonStdOutput');
        if (!outputDiv) {
            console.error('Std output div not found');
            return;
        }

        outputDiv.classList.add('active');
        
        // Show loading message
        outputDiv.innerHTML = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; text-align: center;">
                <h4 style="color: #0369a1; margin-bottom: 8px;">🔄 Generating Standard Plot...</h4>
                <p>Loading ${sites.join(', ')} data for ${source} analysis...</p>
                <p style="font-size: 0.8rem; margin-top: 10px;">Debug: Found ${this.stdFiles?.length || 0} std files</p>
            </div>
        `;

        try {
            console.log('Starting to load std files...');
            // Load the _std CSV files for each selected site
            const siteData = await this.loadStdFilesForSites(sites, source);
            
            console.log('Loaded std site data:', siteData.length, 'files');
            
            if (siteData.length === 0) {
                throw new Error('No _std files found for the selected sites');
            }

            console.log('Creating std plot...');
            // Generate the plot using the same format as 24hr
            this.createStdSiteComparisonPlot(siteData, source, sites, outputDiv);
            console.log('Std plot creation completed');
            
        } catch (error) {
            console.error('Error generating std site comparison plot:', error);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Could not generate plot:</strong> ${error.message}</p>
                    <p style="margin-top: 10px; font-size: 0.85rem;">
                        Make sure the corresponding _std files exist for: ${sites.join(', ')}
                    </p>
                </div>
            `;
        }
    }

    async loadStdFilesForSites(selectedFilenames, source) {
        console.log('=== LOAD STD FILES FOR SITES ===');
        console.log('Selected filenames:', selectedFilenames);
        console.log('Available std files count:', this.stdFiles?.length || 0);
        
        const siteData = [];
        
        for (const filename of selectedFilenames) {
            console.log(`Looking for std file: ${filename}`);
            // Find the file by exact filename match
            const fileStd = this.stdFiles.find(file => file.name === filename);
            
            console.log(`Found std file for ${filename}:`, fileStd?.name || 'NOT FOUND');
            
            if (fileStd) {
                try {
                    console.log(`Parsing CSV file: ${fileStd.name}`);
                    const data = await this.parseCSVFile(fileStd);
                    console.log(`Parsed std data for ${filename}:`, data.headers?.length || 0, 'headers,', data.data?.length || 0, 'rows');
                    
                    siteData.push({
                        site: filename, // Use filename as site identifier
                        file: fileStd,
                        data: data,
                        source: source
                    });
                } catch (error) {
                    console.error(`Error loading std file ${filename}:`, error);
                }
            } else {
                console.warn(`Std file not found: ${filename}`);
            }
        }
        
        console.log('Total std site data loaded:', siteData.length);
        return siteData;
    }

    createStdSiteComparisonPlot(siteData, source, sites, outputDiv) {
        console.log('=== CREATE STD SITE COMPARISON PLOT ===');
        
        try {
            // Create the plot container
            const plotContainer = document.createElement('div');
            plotContainer.style.cssText = 'width: 100%; height: 400px; position: relative; background: white; border-radius: 6px; padding: 20px;';
            
            console.log('Creating canvas element...');
            const canvas = document.createElement('canvas');

            // Use same simple approach as 24hr charts
            canvas.width = 800;
            canvas.height = 400;
            canvas.style.cssText = 'width: 100%; height: 100%;';
            
            plotContainer.appendChild(canvas);

            const ctx = canvas.getContext('2d');

            // Clear canvas with professional white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            console.log('Title and subtitle removed for cleaner appearance');
            // Title and subtitle removed
            
            console.log('Preparing data for plotting...');
            // Prepare data for plotting - first extract all available time points from all sites
            let allTimePoints = new Set();
            siteData.forEach(site => {
                const hourlyData = this.extractHourlyData(site.data, source);
                Object.keys(hourlyData).forEach(hour => allTimePoints.add(hour));
            });

            // Sort time points properly by converting to Date objects
            const sortedHours = Array.from(allTimePoints).sort((a, b) => {
                const dateA = new Date(a.replace(/\//g, "-"));
                const dateB = new Date(b.replace(/\//g, "-"));
                return dateA - dateB;
            });
            
            // Format all dates uniformly as dd/mm/yy
            const hours = sortedHours.map(timeStr => {
                const date = new Date(timeStr.replace(/\//g, "-"));
                const day = String(date.getDate()).padStart(2, "0");
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const year = String(date.getFullYear()).slice(-2);
                return `${day}/${month}/${year}`;
            });
            console.log(`Using ${hours.length} time points from actual data:`, hours.slice(0, 5), '...');
            console.log("=== DEBUG: Site Comparison Time Range ===");
            console.log("All time points found:", allTimePoints);
            console.log("Sorted hours:", sortedHours.slice(0, 10));
            console.log("Formatted hours:", hours.slice(0, 10));

            let maxDPM = 0;
            let maxStdDPM = 0;
            let maxNonStdDPM = 0;

            const plotData = siteData.map((site, index) => {
                // Extract DPM data
                const hourlyData = this.extractHourlyData(site.data, source);
                const dpmValues = sortedHours.map(hour => {
                console.log("=== DEBUG: Processing site", siteInfo.site, "===");
                console.log("Hourly data keys:", Object.keys(hourlyData));
                console.log("Sorted hours length:", sortedHours.length);
                    return hourlyData[hour] !== undefined ? hourlyData[hour] : null;
                    console.log("Hour", hour, "-> value:", hourlyData[hour], "mapped to:", hourlyData[hour] !== undefined ? hourlyData[hour] : null);
                });

                const validDpmValues = dpmValues.filter(v => v !== null); const maxSiteValue = validDpmValues.length > 0 ? Math.max(...validDpmValues) : 0;
                maxDPM = Math.max(maxDPM, maxSiteValue);

                // Check if this is a std file
                const isStdFile = site.site.toLowerCase().includes('_std');
                if (isStdFile) {
                    maxStdDPM = Math.max(maxStdDPM, maxSiteValue);
                } else {
                    maxNonStdDPM = Math.max(maxNonStdDPM, maxSiteValue);
                }

                return {
                    site: site.site,
                    dpmValues: dpmValues,
                    color: this.getSiteColor(index),
                    isStdFile: isStdFile
                };
            });

            // Apply scaling to std data
            const hasStdFiles = plotData.some(site => site.isStdFile);
            const hasNonStdFiles = plotData.some(site => !site.isStdFile);

            if (hasStdFiles) {
                let stdScaleFactor;

                if (hasNonStdFiles && maxStdDPM > 0 && maxNonStdDPM > 0) {
                    // Mixed std and non-std files: scale std to match non-std range
                    stdScaleFactor = (maxNonStdDPM / maxStdDPM) * 0.8;
                } else if (maxStdDPM > 50) {
                    // Only std files and values are large: scale down to reasonable range (0-50)
                    stdScaleFactor = 40 / maxStdDPM;
                } else {
                    // Small std values, no scaling needed
                    stdScaleFactor = 1;
                }

                if (stdScaleFactor !== 1) {
                    console.log('Applying std scaling factor:', stdScaleFactor, 'to max value:', maxStdDPM);

                    plotData.forEach(site => {
                        if (site.isStdFile) {
                            site.dpmValues = site.dpmValues.map(val => val * stdScaleFactor);
                            site.site += ' (scaled)'; // Add indicator to legend
                        }
                    });

                    // Recalculate max after scaling - find actual max from scaled data
                    let newMaxDPM = 0;
                    plotData.forEach(site => {
                        const validSiteValues = site.dpmValues.filter(v => v !== null); const siteMax = validSiteValues.length > 0 ? Math.max(...validSiteValues) : 0;
                        newMaxDPM = Math.max(newMaxDPM, siteMax);
                    });
                    maxDPM = newMaxDPM;

                    console.log('New maxDPM after scaling:', maxDPM);
                }
            }

            // Define plot area - same as 24hr chart for consistent sizing
            const plotArea = {
                left: 90,
                right: 700,
                top: 80,
                bottom: 320,
                width: 610,
                height: 240
            };

            // Round up max value to nice number
            maxDPM = Math.ceil(maxDPM * 1.1);

            console.log('Drawing axes...');
            // Draw axes and labels
            this.drawPlotAxes(ctx, plotArea, hours, maxDPM, maxDPM, 800, "Date");

            console.log('Plotting DPM data...');
            // Plot each site's DPM data
            plotData.forEach((siteData, index) => {
                this.plotSiteDataDPM(ctx, plotArea, siteData, hours, maxDPM);
            });

            console.log('Drawing legend...');
            // Draw legend
            this.drawPlotLegend(ctx, plotData, plotArea);
            
            console.log('Updating output div...');
            // Update output div
            outputDiv.innerHTML = `
                <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #15803d; margin-bottom: 10px;">✅ Standard Site Comparison Plot Generated</h4>
                    <p style="margin-bottom: 15px;"><strong>Source:</strong> ${source} | <strong>Sites:</strong> ${sites.join(', ')}</p>
                </div>
            `;
            
            outputDiv.appendChild(plotContainer);
            
        } catch (error) {
            console.error('Error in std site comparison plot creation:', error);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Plot creation failed:</strong> ${error.message}</p>
                </div>
            `;
        }
    }

    async generateStdSourceComparison(site, sources) {
        console.log('=== GENERATE STD SOURCE COMPARISON START ===');
        
        const outputDiv = document.getElementById('sourceComparisonStdOutput');
        if (!outputDiv) {
            console.error('Std source output div not found');
            return;
        }

        outputDiv.classList.add('active');
        
        // Show loading message
        outputDiv.innerHTML = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; text-align: center;">
                <h4 style="color: #0369a1; margin-bottom: 8px;">🔄 Generating Standard Source Plot...</h4>
                <p>Loading ${site} data for sources: ${sources.join(', ')}</p>
            </div>
        `;

        try {
            // Find the std file for the selected site
            const siteFile = this.stdFiles.find(file => file.name === site);
            if (!siteFile) {
                throw new Error(`No _std file found for site: ${site}`);
            }

            // Parse the file data
            const siteData = await this.parseCSVFile(siteFile);
            
            // Generate the plot using same format as 24hr
            this.createStdSourceComparisonPlot(siteData, site, sources, outputDiv);
            
        } catch (error) {
            console.error('Error generating std source comparison plot:', error);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Could not generate plot:</strong> ${error.message}</p>
                    <p style="margin-top: 10px; font-size: 0.85rem;">
                        Make sure the corresponding _std file exists for: ${site}
                    </p>
                </div>
            `;
        }
    }

    createStdSourceComparisonPlot(siteData, site, sources, outputDiv) {
        try {
            // Create the plot container
            const plotContainer = document.createElement('div');
            plotContainer.style.cssText = 'width: 100%; height: 400px; position: relative; background: white; border-radius: 6px; padding: 20px;';
            
            const canvas = document.createElement('canvas');

            // Use same simple approach as 24hr charts
            canvas.width = 800;
            canvas.height = 400;
            canvas.style.cssText = 'width: 100%; height: 100%;';

            plotContainer.appendChild(canvas);

            const ctx = canvas.getContext('2d');

            // Clear canvas with professional white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Extract clean site name for processing
            const siteName = this.extractSiteNameFromFilename(site);
            
            // Title and subtitle removed for cleaner appearance
            
            // Prepare data for plotting - first extract all available time points from all sources
            let allTimePoints = new Set();
            sources.forEach(source => {
                const hourlyData = this.extractHourlyData(siteData, source);
                Object.keys(hourlyData).forEach(hour => allTimePoints.add(hour));
            });

            // Sort time points properly by converting to Date objects
            const sortedHours = Array.from(allTimePoints).sort((a, b) => {
                const dateA = new Date(a.replace(/\//g, "-"));
                const dateB = new Date(b.replace(/\//g, "-"));
                return dateA - dateB;
            });
            
            // Format all dates uniformly as dd/mm/yy
            const hours = sortedHours.map(timeStr => {
                const date = new Date(timeStr.replace(/\//g, "-"));
                const day = String(date.getDate()).padStart(2, "0");
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const year = String(date.getFullYear()).slice(-2);
                return `${day}/${month}/${year}`;
            });
            console.log(`Using ${hours.length} time points from actual data:`, hours.slice(0, 5), '...');
            console.log("=== DEBUG: Site Comparison Time Range ===");
            console.log("All time points found:", allTimePoints);
            console.log("Sorted hours:", sortedHours.slice(0, 10));
            console.log("Formatted hours:", hours.slice(0, 10));

            let maxDPM = 0;

            const plotData = sources.map((source, index) => {
                const hourlyData = this.extractHourlyData(siteData, source);
                const dpmValues = sortedHours.map(hour => {
                console.log("=== DEBUG: Processing site", siteInfo.site, "===");
                console.log("Hourly data keys:", Object.keys(hourlyData));
                console.log("Sorted hours length:", sortedHours.length);
                    return hourlyData[hour] !== undefined ? hourlyData[hour] : null;
                    console.log("Hour", hour, "-> value:", hourlyData[hour], "mapped to:", hourlyData[hour] !== undefined ? hourlyData[hour] : null);
                });
                const validDpmValues = dpmValues.filter(v => v !== null); if (validDpmValues.length > 0) maxDPM = Math.max(maxDPM, ...validDpmValues);
                
                return {
                    source: source,
                    dpmValues: dpmValues,
                    color: this.getSourceColor(index)
                };
            });
            
            // Define plot area - same as 24hr chart for consistent sizing
            const plotArea = {
                left: 90,
                right: 700,
                top: 80,
                bottom: 320,
                width: 610,
                height: 240
            };

            // Draw axes and labels
            this.drawPlotAxes(ctx, plotArea, hours, maxDPM, maxDPM, 800, "Date");
            
            // Plot each source's data
            plotData.forEach((sourceData, index) => {
                this.plotSourceData(ctx, plotArea, sourceData, hours, maxDPM);
            });
            
            // Draw legend
            this.drawSourcePlotLegend(ctx, plotData, plotArea);
            
            // Update output div
            outputDiv.innerHTML = `
                <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #15803d; margin-bottom: 10px;">✅ Standard Source Comparison Plot Generated</h4>
                    <p style="margin-bottom: 15px;"><strong>Site:</strong> ${site} | <strong>Sources:</strong> ${sources.join(', ')}</p>
                </div>
            `;
            
            outputDiv.appendChild(plotContainer);
            console.log('Standard source comparison plot created successfully');
            
        } catch (error) {
            console.error('Error in std source comparison plot creation:', error);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Plot creation failed:</strong> ${error.message}</p>
                </div>
            `;
        }
    }

    // Length distribution comparison methods
    async generateLengthDistributionFromFirstCard(site, lengthVars) {
        console.log('=== GENERATE LENGTH DISTRIBUTION FROM FIRST CARD START ===');
        console.log('Site:', site);
        console.log('Length Variables:', lengthVars);

        const outputDiv = document.getElementById('siteComparisonLengthOutput');
        if (!outputDiv) {
            console.error('Length distribution output div not found');
            return;
        }

        outputDiv.classList.add('active');

        // Show loading message
        outputDiv.innerHTML = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; text-align: center;">
                <h4 style="color: #0369a1; margin-bottom: 8px;">🔄 Generating Length Distribution Plot...</h4>
                <p>Loading ${site} data for variables: ${lengthVars.join(', ')}</p>
            </div>
        `;

        try {
            console.log('Starting to load file for length distribution...');
            // Load the CSV file using the same approach as Blade Count
            const rawData = await this.loadLengthData(site);

            console.log('Loaded length data for site:', site);
            console.log('Raw data rows:', rawData.length);

            if (!rawData || rawData.length === 0) {
                throw new Error('No valid data found for the selected site');
            }

            // Create length distribution chart
            this.renderLengthDistributionChart(rawData, lengthVars, outputDiv);
            console.log('Length distribution chart created successfully');

        } catch (error) {
            console.error('Error in length distribution chart creation:', error);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Plot creation failed:</strong> ${error.message}</p>
                </div>
            `;
        }
    }

    async generateLengthSiteComparison(lengthVar, sites) {
        console.log('=== GENERATE LENGTH SITE COMPARISON START ===');
        console.log('Length Variable:', lengthVar);
        console.log('Sites:', sites);

        // This method would be for comparing the same variable across multiple sites
        // For now, redirect to the single-site comparison since we typically work with one file at a time
        const outputDiv = document.getElementById('siteComparisonLengthOutput');
        if (!outputDiv) {
            console.error('Length site comparison output div not found');
            return;
        }

        outputDiv.classList.add('active');
        outputDiv.innerHTML = `
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px;">
                <h4 style="color: #92400e; margin-bottom: 8px;">ℹ️ Note</h4>
                <p>Site comparison functionality coming soon. For now, please use the second panel below to compare multiple length variables within a single file.</p>
            </div>
        `;
    }

    async generateLengthVariableComparison(site, lengthVars) {
        console.log('=== GENERATE LENGTH VARIABLE COMPARISON START ===');
        console.log('Site:', site);
        console.log('Length Variables:', lengthVars);

        const outputDiv = document.getElementById('variableComparisonLengthOutput');
        if (!outputDiv) {
            console.error('Length variable comparison output div not found');
            return;
        }

        outputDiv.classList.add('active');

        // Show loading message
        outputDiv.innerHTML = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; text-align: center;">
                <h4 style="color: #0369a1; margin-bottom: 8px;">🔄 Generating Length Distribution Plot...</h4>
                <p>Loading ${site} data for variables: ${lengthVars.join(', ')}</p>
            </div>
        `;

        try {
            console.log('Starting to load file for length distribution...');
            // Load the CSV file using the same approach as Blade Count
            const rawData = await this.loadLengthData(site);

            console.log('Loaded length data for site:', site);
            console.log('Raw data rows:', rawData.length);

            if (!rawData || rawData.length === 0) {
                throw new Error('No valid data found for the selected site');
            }

            // Create length distribution chart
            this.renderLengthDistributionChart(rawData, lengthVars, outputDiv);
            console.log('Length distribution chart created successfully');

        } catch (error) {
            console.error('Error in length distribution chart creation:', error);
            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Error</h4>
                    <p><strong>Plot creation failed:</strong> ${error.message}</p>
                </div>
            `;
        }
    }

    // Color methods for plots
    getSiteColor(index) {
        const journalColors = [
            '#1f77b4', // Blue
            '#ff7f0e', // Orange
            '#2ca02c', // Green
            '#d62728', // Red
            '#9467bd', // Purple
            '#8c564b', // Brown
            '#e377c2', // Pink
            '#7f7f7f', // Gray
            '#bcbd22', // Olive
            '#17becf'  // Cyan
        ];
        return journalColors[index % journalColors.length];
    }

    getSourceColor(index) {
        const journalColors = [
            '#1f77b4', // Blue
            '#ff7f0e', // Orange
            '#2ca02c', // Green
            '#d62728', // Red
            '#9467bd', // Purple
            '#8c564b', // Brown
            '#e377c2', // Pink
            '#7f7f7f', // Gray
            '#bcbd22', // Olive
            '#17becf'  // Cyan
        ];
        return journalColors[index % journalColors.length];
    }

    drawDualYAxes(ctx, plotArea, hours, maxDPM, maxPercentage) {
        // Softer, elegant styling
        ctx.strokeStyle = '#d0d0d0';  // Light gray for axes
        ctx.lineWidth = 1;

        // Draw X-axis
        ctx.beginPath();
        ctx.moveTo(plotArea.left, plotArea.bottom);
        ctx.lineTo(plotArea.right, plotArea.bottom);
        ctx.stroke();

        // Draw left Y-axis (DPM)
        ctx.beginPath();
        ctx.moveTo(plotArea.left, plotArea.top);
        ctx.lineTo(plotArea.left, plotArea.bottom);
        ctx.stroke();

        // Draw right Y-axis (% day detected)
        ctx.beginPath();
        ctx.moveTo(plotArea.right, plotArea.top);
        ctx.lineTo(plotArea.right, plotArea.bottom);
        ctx.stroke();

        // Style for axis labels
        ctx.font = '13px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666666';  // Softer text color

        // X-axis labels (dates)
        const xStep = plotArea.width / hours.length;
        hours.forEach((hour, index) => {
            const x = plotArea.left + (index + 0.5) * xStep;

            // Show dates with intelligent spacing to avoid crowding - rotated at 45 degrees
            const labelSpacing = this.calculateOptimalLabelSpacing(hours.length);
            if (index % labelSpacing === 0 || index === hours.length - 1) { // Always show first, last, and spaced labels
                ctx.save();
                ctx.translate(x, plotArea.bottom + 20);
                ctx.rotate(-Math.PI / 4); // -45 degrees
                ctx.textAlign = 'right';
                ctx.fillText(hour, 0, 0);
                ctx.restore();
            }
        });

        // X-axis title (positioned lower to avoid overlap with rotated tick labels)
        ctx.font = 'bold 14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.fillText('Date', plotArea.left + plotArea.width / 2, plotArea.bottom + 75);

        // Left Y-axis labels (DPM)
        ctx.textAlign = 'right';
        ctx.font = '13px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.fillStyle = '#1f77b4'; // Blue for DPM
        const dpmSteps = 5;
        for (let i = 0; i <= dpmSteps; i++) {
            const value = (maxDPM / dpmSteps) * i;
            const y = plotArea.bottom - (plotArea.height / dpmSteps) * i;
            ctx.fillText(value.toFixed(1), plotArea.left - 10, y + 4);
        }

        // Left Y-axis title (DPM)
        ctx.save();
        ctx.translate(plotArea.left - 60, plotArea.top + plotArea.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = 'bold 14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DPM (Detections per Minute)', 0, 0);
        ctx.restore();

        // Right Y-axis labels (Detection Rate %)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#d62728'; // Red for detection rate
        const percentSteps = 5;
        for (let i = 0; i <= percentSteps; i++) {
            const value = (maxPercentage / percentSteps) * i;
            const y = plotArea.bottom - (plotArea.height / percentSteps) * i;
            ctx.fillText(value.toFixed(1) + '%', plotArea.right + 10, y + 4);
        }

        // Right Y-axis title (Detection Rate %)
        ctx.save();
        ctx.translate(plotArea.right + 80, plotArea.top + plotArea.height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.font = 'bold 14px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Detection Rate (%)', 0, 0);
        ctx.restore();
    }

    plotSiteDataDPM(ctx, plotArea, siteData, hours, maxDPM) {
        const { site, dpmValues, color } = siteData;

        // Solid line for DPM data
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]); // Solid line

        const xStep = plotArea.width / dpmValues.length;

        ctx.beginPath();
        let firstPoint = true;
            console.log("=== DEBUG: Drawing series", col.header, "===");
            console.log("Series color:", color, "isStdSeries:", isStdSeries);
            console.log("Global min/max:", globalMin, globalMax, "Range:", range);

        dpmValues.forEach((dpm, index) => {
            const x = plotArea.left + (index + 0.5) * xStep;
            const y = plotArea.bottom - (dpm / maxDPM) * plotArea.height;

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    plotSiteDataDetectionRate(ctx, plotArea, siteData, hours, maxPercentage) {
        const { site, detectionRateValues, color } = siteData;

        // Dashed line for detection rate data
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([5, 5]); // Dashed line

        const xStep = plotArea.width / dpmValues.length;

        ctx.beginPath();
        let firstPoint = true;
            console.log("=== DEBUG: Drawing series", col.header, "===");
            console.log("Series color:", color, "isStdSeries:", isStdSeries);
            console.log("Global min/max:", globalMin, globalMax, "Range:", range);

        detectionRateValues.forEach((detectionRate, index) => {
            const x = plotArea.left + (index + 0.5) * xStep;
            const y = plotArea.bottom - (detectionRate / maxPercentage) * plotArea.height;

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid line
    }

    drawDualAxisLegend(ctx, plotData, plotArea) {
        // Legend positioning - more space needed for dual entries
        const legendX = plotArea.left + 20;
        const legendY = plotArea.top + 20;

        // Calculate legend box dimensions dynamically - doubled for both line types
        const legendPadding = 12; // Increased for better visual padding
        const lineHeight = 18;

        // Set font for measurement
        ctx.font = '12px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';

        // Measure the width of all legend text to determine optimal box size
        let maxTextWidth = 0;
        plotData.forEach((site) => {
            // Check both DPM and % labels (they will be displayed)
            const dpmText = `${site.site} (DPM)`;
            const percentText = `${site.site} (% day detected)`;
            const dpmWidth = ctx.measureText(dpmText).width;
            const percentWidth = ctx.measureText(percentText).width;
            maxTextWidth = Math.max(maxTextWidth, dpmWidth, percentWidth);
        });

        // Account for headers "DPM Values" and "% Day Detected"
        const headerWidth1 = ctx.measureText("DPM Values").width;
        const headerWidth2 = ctx.measureText("% Day Detected").width;
        maxTextWidth = Math.max(maxTextWidth, headerWidth1, headerWidth2);

        // Legend width: line sample (30px) + text width + extra padding
        const legendWidth = Math.max(180, maxTextWidth + 60); // Minimum 180px for dual axis
        const legendHeight = (plotData.length * lineHeight * 2) + (legendPadding * 2) + 25; // Extra space for headers

        // Draw legend background box with transparency
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // More opaque for readability
        ctx.fillRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);

        // Draw legend border
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);

        // Draw legend headers
        ctx.font = 'bold 12px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#1f77b4'; // Blue for DPM
        ctx.fillText('DPM (solid lines):', legendX, legendY + 12);

        ctx.fillStyle = '#d62728'; // Red for detection rate
        ctx.fillText('Detection Rate % (dashed):', legendX, legendY + 26);

        // Draw legend items
        ctx.font = '11px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        let currentY = legendY + 45;

        plotData.forEach((siteData, i) => {
            // DPM line (solid)
            ctx.strokeStyle = siteData.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([]); // Solid line
            ctx.beginPath();
            ctx.moveTo(legendX + 5, currentY - 2);
            ctx.lineTo(legendX + 25, currentY - 2);
            ctx.stroke();

            // Site name for DPM
            ctx.fillStyle = '#374151';
            ctx.fillText(siteData.site, legendX + 30, currentY + 2);

            currentY += lineHeight;

            // Percentage line (dashed)
            ctx.strokeStyle = siteData.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]); // Dashed line
            ctx.beginPath();
            ctx.moveTo(legendX + 5, currentY - 2);
            ctx.lineTo(legendX + 25, currentY - 2);
            ctx.stroke();

            // Site name for detection rate
            ctx.fillStyle = '#374151';
            ctx.fillText(`${siteData.site} (Rate%)`, legendX + 30, currentY + 2);

            currentY += lineHeight;
        });

        ctx.setLineDash([]); // Reset to solid line
    }
    initializeBladeCountControls() {
        const dataSourceSelect = document.getElementById("dataSourceSelect");
        const parameterSelect = document.getElementById("parameterSelect");
        const generateBladeCountBtn = document.getElementById("generateBladeCountBtn");
        const parameterHelpText = document.getElementById("parameterHelpText");

        const updateParameterDropdown = () => {
            const selectedSource = dataSourceSelect.value;
            const isIndivFile = selectedSource && (selectedSource.includes('Indiv') || selectedSource.includes('_indiv'));
            const isSummaryFile = selectedSource && (selectedSource.includes('Summary') || selectedSource.includes('_summary'));

            if (isSummaryFile && !isIndivFile) {
                parameterSelect.disabled = true;
                parameterSelect.innerHTML = "<option value=\"\">Select parameter...</option>";
                parameterHelpText.textContent = "Summary files don't support blade count analysis. Please select an Indiv file.";
                parameterHelpText.style.color = "#999";
                generateBladeCountBtn.disabled = true;
            } else if (isIndivFile) {
                parameterSelect.disabled = false;
                parameterSelect.innerHTML = "<option value=\"\">Select parameter...</option><option value=\"blade_count_by_size\">Blade count by size (small vs large)</option>";
                parameterHelpText.textContent = "Select a parameter to analyze";
                parameterHelpText.style.color = "#666";
                updateGenerateButton();
            } else {
                parameterSelect.disabled = true;
                parameterSelect.innerHTML = "<option value=\"\">Select parameter...</option>";
                parameterHelpText.textContent = "Select data source first";
                parameterHelpText.style.color = "#666";
                generateBladeCountBtn.disabled = true;
            }
        };

        const updateGenerateButton = () => {
            const sourceSelected = dataSourceSelect.value;
            const parameterSelected = parameterSelect.value;
            const isIndivFile = sourceSelected && (sourceSelected.includes('Indiv') || sourceSelected.includes('_indiv'));
            generateBladeCountBtn.disabled = !(isIndivFile && parameterSelected === "blade_count_by_size");
        };

        if (dataSourceSelect) dataSourceSelect.addEventListener("change", updateParameterDropdown);
        if (parameterSelect) parameterSelect.addEventListener("change", updateGenerateButton);
        if (generateBladeCountBtn) {
            generateBladeCountBtn.addEventListener("click", () => {
                this.generateBladeCountChart();
            });
        }

        // Initial population of dropdown
        this.updateBladeCountDropdowns();
    }

    async generateBladeCountChart() {
        const outputDiv = document.getElementById("bladeCountOutput");

        // Make sure output div is visible
        outputDiv.classList.add('active');

        try {
            // Show loading state
            outputDiv.innerHTML = "<p>Loading and processing data...</p>";

            // Load and process data
            const rawData = await this.loadBladeCountData();
            const cleanedData = this.cleanBladeCountData(rawData);
            const aggregatedData = this.aggregateBladeCountData(cleanedData);

            // Render chart
            this.renderBladeCountChart(aggregatedData, outputDiv);

        } catch (error) {
            console.error('Error generating blade count chart:', error);
            outputDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }

    async loadBladeCountData() {
        // Get the selected file from the data source dropdown
        const dataSourceSelect = document.getElementById("dataSourceSelect");
        const selectedFilename = dataSourceSelect ? dataSourceSelect.value : null;

        if (!selectedFilename) {
            throw new Error('Please select a data source from the dropdown first.');
        }

        // Find the selected file in loaded files
        let selectedFile = null;

        if (csvManager && csvManager.workingDirFiles) {
            selectedFile = csvManager.workingDirFiles.find(file => file.name === selectedFilename);
        }

        if (!selectedFile) {
            throw new Error(`Please load the ${selectedFilename} file using the "Select CSV Files" button first.`);
        }

        return this.parseCSVFile(selectedFile);
    }

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

    renderBladeCountChart(data, outputDiv) {

        // Create canvas for chart
        const canvas = document.createElement('canvas');
        canvas.width = 576;
        canvas.height = 360;
        canvas.style.border = '1px solid #ddd';
        canvas.style.borderRadius = '4px';
        canvas.style.backgroundColor = '#ffffff';
        canvas.style.display = 'block';
        canvas.style.margin = '10px auto';

        // Create chart container
        outputDiv.innerHTML = '';
        const chartContainer = document.createElement('div');
        chartContainer.style.textAlign = 'center';
        chartContainer.style.marginTop = '20px';

        const title = document.createElement('h3');
        title.textContent = 'Blade Count by Station (Small vs Large)';
        title.style.marginBottom = '10px';

        chartContainer.appendChild(title);
        chartContainer.appendChild(canvas);
        outputDiv.appendChild(chartContainer);


        // Draw the chart
        this.drawStackedBarChart(canvas, data);
    }

    drawStackedBarChart(canvas, data) {
        const ctx = canvas.getContext('2d');
        const padding = 80;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;

        // Clear canvas with white background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add chart title - left aligned above plot area
        ctx.fillStyle = '#555';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Number of blades sampled by station', padding, 50);

        if (data.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data to display', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Calculate max value for scaling with 10% buffer
        const maxDataValue = Math.max(...data.map(d => d.total));
        const maxValue = maxDataValue * 1.1;  // Add 10% buffer
        const yScale = chartHeight / maxValue;
        const barWidth = chartWidth / data.length * 0.7;
        const barSpacing = chartWidth / data.length * 0.3;

        // Modern color scheme matching reference image
        const smallColor = '#1f77b4';  // Blue similar to reference
        const largeColor = '#ff7f0e';  // Orange similar to reference

        // Draw gridlines first (behind bars) - horizontal and vertical
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);

        // Horizontal gridlines
        for (let i = 1; i <= 5; i++) {
            const y = canvas.height - padding - (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        // Vertical gridlines
        data.forEach((station, index) => {
            const x = padding + index * (barWidth + barSpacing) + barSpacing / 2 + barWidth / 2;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, canvas.height - padding);
            ctx.stroke();
        });

        ctx.setLineDash([]);

        // Draw bars
        data.forEach((station, index) => {
            const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
            const smallHeight = station.smallBlades * yScale;
            const largeHeight = station.largeBlades * yScale;

            // Draw small blades (bottom)
            ctx.fillStyle = smallColor;
            ctx.fillRect(x, canvas.height - padding - smallHeight, barWidth, smallHeight);

            // Draw large blades (top)
            ctx.fillStyle = largeColor;
            ctx.fillRect(x, canvas.height - padding - smallHeight - largeHeight, barWidth, largeHeight);

            // Station label
            ctx.fillStyle = '#666';
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.save();
            ctx.translate(x + barWidth / 2, canvas.height - padding + 25);
            ctx.rotate(-Math.PI / 4);
            ctx.fillText(station.station, 0, 0);
            ctx.restore();
        });

        // Draw axes - complete rectangle around plot area
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Left axis
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        // Bottom axis
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        // Right axis
        ctx.lineTo(canvas.width - padding, padding);
        // Top axis
        ctx.lineTo(padding, padding);
        ctx.stroke();

        // Y-axis labels with modern typography
        ctx.fillStyle = '#666';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = (maxValue / 5) * i;
            const y = canvas.height - padding - (chartHeight / 5) * i;
            ctx.fillText(Math.round(value), padding - 15, y + 4);

        }

        // Modern legend with clean styling - top left position
        const legendY = padding + 15;
        const legendX = padding + 15;
        const legendWidth = 120;
        const legendHeight = 45;
        const legendPadding = 6;

        // Draw semi-transparent legend background with softer styling
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);

        // Draw subtle legend border
        ctx.strokeStyle = 'rgba(220, 220, 220, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX - legendPadding, legendY - legendPadding, legendWidth, legendHeight);

        // Draw legend items with modern styling
        ctx.fillStyle = smallColor;
        ctx.fillRect(legendX, legendY, 12, 12);
        ctx.fillStyle = '#555';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Small blades', legendX + 18, legendY + 9);

        ctx.fillStyle = largeColor;
        ctx.fillRect(legendX, legendY + 22, 12, 12);
        ctx.fillStyle = '#555';
        ctx.fillText('Large blades', legendX + 18, legendY + 31);

        // Modern axis labels - closer to axes
        ctx.fillStyle = '#555';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Station', canvas.width / 2, canvas.height - padding + 45);

        ctx.save();
        ctx.translate(35, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Number of blade samples', 0, 0);
        ctx.restore();
    }

    addBladeCountSummaryTable(data, outputDiv) {
        const tableContainer = document.createElement('div');
        tableContainer.style.marginTop = '20px';

        const tableTitle = document.createElement('h4');
        tableTitle.textContent = 'Summary Data';
        tableContainer.appendChild(tableTitle);

        const table = document.createElement('table');
        table.style.border = '1px solid #ddd';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '0 auto';
        table.style.minWidth = '400px';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Station', 'Small Blades', 'Large Blades', 'Total'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.border = '1px solid #ddd';
            th.style.padding = '8px';
            th.style.backgroundColor = '#f5f5f5';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.forEach(station => {
            const row = document.createElement('tr');
            [station.station, station.smallBlades, station.largeBlades, station.total].forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                td.style.border = '1px solid #ddd';
                td.style.padding = '8px';
                td.style.textAlign = 'center';
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.appendChild(table);
        outputDiv.appendChild(tableContainer);
    }

    // Length distribution methods
    async loadLengthData(filename) {
        console.log('=== LOADING LENGTH DATA ===');
        console.log('Requested filename:', filename);

        // Find the selected file in loaded files (exact match only, like blade count)
        let selectedFile = null;
        if (csvManager && csvManager.workingDirFiles) {
            console.log('Available files:', csvManager.workingDirFiles.map(f => f.name));
            selectedFile = csvManager.workingDirFiles.find(file => file.name === filename);
        }

        if (!selectedFile) {
            throw new Error(`File "${filename}" not found. Please load it using the "Select CSV Files" button first.`);
        }

        console.log('Loading file:', selectedFile.name);
        return this.parseCSVFile(selectedFile);
    }

    // Extract individual blade measurements from raw data for true whisker plots
    extractIndividualBladeData(rawData, measurementType) {
        console.log('🔍 === EXTRACTING INDIVIDUAL BLADE DATA ===');
        console.log(`Measurement type: ${measurementType}`);
        console.log(`Raw data rows: ${rawData.length}`);

        const stationMeasurements = {};
        const stationSet = new Set();

        // Process each row to extract individual measurements
        rawData.forEach((row, index) => {
            const sampleId = row['sample ID'] || row.sampleId || row.sample_id;
            const bladeId = row['blade ID'] || row.bladeId || row.blade_id;
            const measurement = parseFloat(row[measurementType]);

            // Skip summary rows (first row per station with no blade ID)
            if (!bladeId || bladeId === '' || isNaN(measurement) || measurement <= 0) {
                return;
            }

            // Skip rows without valid station ID
            if (!sampleId || sampleId === '') {
                return;
            }

            stationSet.add(sampleId);

            if (!stationMeasurements[sampleId]) {
                stationMeasurements[sampleId] = [];
            }

            stationMeasurements[sampleId].push({
                bladeId: bladeId,
                value: measurement,
                subset: row.subset || 'unknown'
            });
        });

        // Log extraction results
        const stations = Array.from(stationSet).sort();
        stations.forEach(station => {
            const count = stationMeasurements[station].length;
            const values = stationMeasurements[station].map(m => m.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            console.log(`📊 Station ${station}: ${count} measurements (${min.toFixed(1)}-${max.toFixed(1)})`);
        });

        console.log(`✅ Extracted individual data for ${stations.length} stations`);
        return stationMeasurements;
    }

    // Map AV variable names to individual measurement column names
    mapVariableToIndividualColumn(selectedVariable) {
        console.log('🗺️ Mapping variable to individual column:', selectedVariable);

        const mapping = {
            'AV sml_l (cm)': 'length (cm)',
            'AV lrg_l (cm)': 'length (cm)',
            'AV all_l (cm)': 'length (cm)',
            'AV sml_w (cm)': 'width (cm)',
            'AV lrg_w (cm)': 'width (cm)',
            'AV all_w (cm)': 'width (cm)'
        };

        const individualColumn = mapping[selectedVariable];

        if (!individualColumn) {
            console.log('❌ No mapping found for variable:', selectedVariable);
            return null;
        }

        console.log(`✅ Mapped ${selectedVariable} → ${individualColumn}`);
        return individualColumn;
    }

    // Filter measurements by subset if needed
    filterMeasurementsBySubset(measurements, selectedVariable) {
        console.log('🔍 Filtering measurements by subset for:', selectedVariable);

        // Determine target subset based on variable
        let targetSubset = 'all';
        if (selectedVariable.includes('sml_')) {
            targetSubset = 'small';
        } else if (selectedVariable.includes('lrg_')) {
            targetSubset = 'large';
        }

        if (targetSubset === 'all') {
            console.log('📊 Using all measurements (small + large combined)');
            return measurements.map(m => m.value);
        }

        const filteredMeasurements = measurements
            .filter(m => m.subset === targetSubset)
            .map(m => m.value);

        console.log(`📊 Filtered to ${targetSubset}: ${filteredMeasurements.length}/${measurements.length} measurements`);
        return filteredMeasurements;
    }

    // Calculate box plot statistics (quartiles, outliers, etc.)
    calculateBoxPlotStatistics(values) {
        console.log('📊 === CALCULATING BOX PLOT STATISTICS ===');
        console.log(`Input values: ${values.length} measurements`);

        if (!values || values.length === 0) {
            console.log('❌ No values provided for box plot calculation');
            return null;
        }

        // Sort values for percentile calculations
        const sortedValues = [...values].sort((a, b) => a - b);
        const n = sortedValues.length;

        console.log(`📊 Sorted range: ${sortedValues[0].toFixed(1)} to ${sortedValues[n-1].toFixed(1)}`);

        // Calculate percentiles using linear interpolation
        const calculatePercentile = (p) => {
            const index = (n - 1) * p;
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            const weight = index % 1;

            if (upper >= n) return sortedValues[n - 1];
            if (lower < 0) return sortedValues[0];

            return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
        };

        // Calculate quartiles
        const min = sortedValues[0];
        const q1 = calculatePercentile(0.25);
        const median = calculatePercentile(0.50);
        const q3 = calculatePercentile(0.75);
        const max = sortedValues[n - 1];

        // Calculate IQR and fences
        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;

        // Find whisker ends (min/max within fences)
        const whiskerMin = sortedValues.find(v => v >= lowerFence) || min;
        const whiskerMax = sortedValues.slice().reverse().find(v => v <= upperFence) || max;

        // Identify outliers
        const outliers = sortedValues.filter(v => v < lowerFence || v > upperFence);

        const statistics = {
            count: n,
            min: min,
            q1: q1,
            median: median,
            q3: q3,
            max: max,
            iqr: iqr,
            lowerFence: lowerFence,
            upperFence: upperFence,
            whiskerMin: whiskerMin,
            whiskerMax: whiskerMax,
            outliers: outliers,
            rawValues: sortedValues
        };

        // Log detailed statistics
        console.log('📊 Box Plot Statistics:');
        console.log(`   Count: ${n}`);
        console.log(`   Min: ${min.toFixed(2)}`);
        console.log(`   Q1: ${q1.toFixed(2)}`);
        console.log(`   Median: ${median.toFixed(2)}`);
        console.log(`   Q3: ${q3.toFixed(2)}`);
        console.log(`   Max: ${max.toFixed(2)}`);
        console.log(`   IQR: ${iqr.toFixed(2)}`);
        console.log(`   Whiskers: ${whiskerMin.toFixed(2)} to ${whiskerMax.toFixed(2)}`);
        console.log(`   Outliers: ${outliers.length} (${outliers.map(v => v.toFixed(1)).join(', ')})`);

        return statistics;
    }

    // Validate quartile calculations with basic checks
    validateBoxPlotStatistics(stats) {
        if (!stats) return false;

        const checks = [
            { name: 'Min ≤ Q1', pass: stats.min <= stats.q1 },
            { name: 'Q1 ≤ Median', pass: stats.q1 <= stats.median },
            { name: 'Median ≤ Q3', pass: stats.median <= stats.q3 },
            { name: 'Q3 ≤ Max', pass: stats.q3 <= stats.max },
            { name: 'IQR ≥ 0', pass: stats.iqr >= 0 },
            { name: 'Count > 0', pass: stats.count > 0 }
        ];

        const failedChecks = checks.filter(check => !check.pass);

        if (failedChecks.length > 0) {
            console.log('❌ Box plot validation failed:');
            failedChecks.forEach(check => console.log(`   ${check.name}: FAILED`));
            return false;
        }

        console.log('✅ Box plot statistics validation passed');
        return true;
    }

    // Detect corresponding SD column for a given AV column
    detectStandardDeviationColumn(averageColumn) {
        console.log('🔍 Detecting SD column for:', averageColumn);

        // Convert AV column name to corresponding SD column name
        // Example: "AV sml_l (cm)" → "SD sml_l (cm)"
        const sdColumn = averageColumn.replace(/^AV\s/, 'SD ');

        console.log('🎯 Detected SD column:', sdColumn);
        return sdColumn;
    }

    // Validate that SD column exists in the data
    validateSDColumn(rawData, sdColumn) {
        if (!rawData || rawData.length === 0) {
            console.log('❌ No data to validate SD column');
            return false;
        }

        // Check if SD column exists in the first row (headers should be in first data row)
        const firstRow = rawData[0];
        const hasColumn = firstRow.hasOwnProperty(sdColumn);

        console.log(`🔍 Validating SD column "${sdColumn}": ${hasColumn ? '✅ Found' : '❌ Not found'}`);

        if (hasColumn) {
            // Check if SD column has any valid numeric data
            const validSDValues = rawData.filter(row => {
                const sdValue = parseFloat(row[sdColumn]);
                return !isNaN(sdValue) && sdValue >= 0;
            }).length;

            console.log(`📊 Valid SD values found: ${validSDValues}/${rawData.length}`);
            return validSDValues > 0;
        }

        return false;
    }

    aggregateLengthData(rawData, selectedVariable) {
        console.log('🎯 === AGGREGATING INDIVIDUAL BLADE DATA FOR BOX PLOTS ===');
        console.log('Raw data rows:', rawData.length);
        console.log('Selected variable:', selectedVariable);

        try {
            // Map AV variable to individual measurement column
            const individualColumn = this.mapVariableToIndividualColumn(selectedVariable);
            if (!individualColumn) {
                console.log('❌ Unable to map variable to individual column');
                return [];
            }

            // Extract individual blade measurements by station
            const stationMeasurements = this.extractIndividualBladeData(rawData, individualColumn);

            if (Object.keys(stationMeasurements).length === 0) {
                console.log('❌ No individual measurements extracted');
                return [];
            }

            // Process each station to calculate box plot statistics
            const stations = Object.keys(stationMeasurements).sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
            );

            const result = stations.map(station => {
                console.log(`\n📊 Processing station: ${station}`);

                const measurements = stationMeasurements[station];

                // Filter measurements by subset if needed (small/large/all)
                const filteredValues = this.filterMeasurementsBySubset(measurements, selectedVariable);

                if (filteredValues.length === 0) {
                    console.log(`❌ No valid measurements for station ${station}`);
                    return null;
                }

                // Calculate box plot statistics
                const statistics = this.calculateBoxPlotStatistics(filteredValues);

                if (!statistics || !this.validateBoxPlotStatistics(statistics)) {
                    console.log(`❌ Invalid statistics for station ${station}`);
                    return null;
                }

                return {
                    station: station,
                    statistics: statistics,
                    variable: selectedVariable,
                    individualColumn: individualColumn,
                    hasBoxPlot: true,

                    // Legacy compatibility properties
                    avgLength: statistics.median, // Use median as representative value
                    standardDeviation: statistics.iqr / 1.349, // Approximate SD from IQR
                    maxLength: statistics.max,
                    minLength: statistics.min,
                    count: statistics.count,
                    hasSD: true // Always true for box plots
                };
            }).filter(result => result !== null);

            console.log(`✅ Successfully processed ${result.length} stations for box plots`);
            console.log('🎯 Box plot aggregation complete');

            return result;

        } catch (error) {
            console.error('❌ Error in box plot aggregation:', error);

            // Fallback to old method if individual data processing fails
            console.log('🔄 Falling back to summary statistics method...');
            return this.aggregateLengthDataLegacy(rawData, selectedVariable);
        }
    }

    // Legacy aggregation method as fallback
    aggregateLengthDataLegacy(rawData, selectedVariable) {
        console.log('🔄 === LEGACY AGGREGATION (SUMMARY STATS ONLY) ===');

        // Detect corresponding SD column
        const sdColumn = this.detectStandardDeviationColumn(selectedVariable);
        const hasValidSD = this.validateSDColumn(rawData, sdColumn);

        console.log(`🔍 SD column detection: ${sdColumn} (Valid: ${hasValidSD})`);

        const stationGroups = {};
        const stationSDGroups = {};
        const stationSet = new Set();

        // Group data by station and collect values for both AV and SD
        rawData.forEach(row => {
            const sampleId = row['sample ID'] || row.sampleId || row.sample_id;
            const avgValue = parseFloat(row[selectedVariable]);
            const sdValue = hasValidSD ? parseFloat(row[sdColumn]) : null;

            if (!sampleId || isNaN(avgValue) || avgValue <= 0) {
                return; // Skip invalid rows
            }

            stationSet.add(sampleId);

            if (!stationGroups[sampleId]) {
                stationGroups[sampleId] = [];
                stationSDGroups[sampleId] = [];
            }

            stationGroups[sampleId].push(avgValue);

            // Store SD values if available and valid
            if (hasValidSD && !isNaN(sdValue) && sdValue >= 0) {
                stationSDGroups[sampleId].push(sdValue);
            }
        });

        // Calculate statistics for each station
        const stations = Array.from(stationSet).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        const result = stations.map(station => {
            const avgValues = stationGroups[station];
            const sdValues = stationSDGroups[station];

            // Calculate average of the average values
            const avgLength = avgValues.reduce((sum, v) => sum + v, 0) / avgValues.length;
            const maxLength = Math.max(...avgValues);
            const minLength = Math.min(...avgValues);

            // Calculate average SD if available
            let avgSD = null;
            if (hasValidSD && sdValues.length > 0) {
                avgSD = sdValues.reduce((sum, v) => sum + v, 0) / sdValues.length;
                console.log(`📊 Station ${station}: Avg=${avgLength.toFixed(1)}, SD=${avgSD.toFixed(1)}`);
            } else {
                console.log(`📊 Station ${station}: Avg=${avgLength.toFixed(1)}, SD=N/A`);
            }

            return {
                station: station,
                avgLength: avgLength,
                standardDeviation: avgSD,
                maxLength: maxLength,
                minLength: minLength,
                count: avgValues.length,
                variable: selectedVariable,
                sdColumn: sdColumn,
                hasSD: hasValidSD && avgSD !== null,
                hasBoxPlot: false // Legacy mode
            };
        });

        console.log('🎯 Legacy aggregated data:', result);
        return result;
    }

    renderLengthDistributionChart(rawData, lengthVars, outputDiv) {
        console.log('=== RENDERING LENGTH DISTRIBUTION CHART (WITH SD SUPPORT) ===');
        console.log('Raw data rows:', rawData.length);
        console.log('Length variables:', lengthVars);

        try {
            // Validate input parameters
            if (!rawData || !Array.isArray(rawData)) {
                throw new Error('Invalid raw data provided');
            }

            if (!lengthVars || !Array.isArray(lengthVars) || lengthVars.length === 0) {
                throw new Error('No length variables provided');
            }

            if (!outputDiv) {
                throw new Error('No output div provided');
            }

            // For now, we'll work with the first selected variable (like blade count works with one parameter)
            const selectedVariable = lengthVars[0];
            if (!selectedVariable) {
                outputDiv.innerHTML = `
                    <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                        <h4 style="color: #dc2626; margin-bottom: 8px;">❌ No Variable Selected</h4>
                        <p>Please select a length variable to analyze.</p>
                    </div>
                `;
                return;
            }

            // Validate that the selected variable exists in data
            const hasSelectedVariable = rawData.some(row => row.hasOwnProperty(selectedVariable));
            if (!hasSelectedVariable) {
                outputDiv.innerHTML = `
                    <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                        <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Variable Not Found</h4>
                        <p>The selected variable "${selectedVariable}" was not found in the data.</p>
                        <p><small>Available columns: ${Object.keys(rawData[0] || {}).join(', ')}</small></p>
                    </div>
                `;
                return;
            }

            console.log(`✅ Validation passed for variable: ${selectedVariable}`);

            // Aggregate data by stations using our new method with SD support
            const aggregatedData = this.aggregateLengthData(rawData, selectedVariable);

            if (aggregatedData.length === 0) {
                outputDiv.innerHTML = `
                    <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                        <h4 style="color: #dc2626; margin-bottom: 8px;">❌ No Data</h4>
                        <p>No valid length data found for variable: ${selectedVariable}</p>
                        <p><small>Check that your data contains valid numeric values and station IDs.</small></p>
                    </div>
                `;
                return;
            }

            // Determine chart type and add informational message
            const hasSDData = aggregatedData.some(d => d.hasSD);
            const chartType = hasSDData ? 'Whisker Plot with Error Bars' : 'Standard Bar Chart';

            console.log(`📊 Rendering ${chartType} for ${aggregatedData.length} stations`);

            // Create chart container with status message
            const chartContainer = document.createElement('div');
            chartContainer.style.marginTop = '20px';

            // Add chart type indicator
            const chartTypeIndicator = document.createElement('div');
            chartTypeIndicator.style.cssText = `
                background: ${hasSDData ? '#f0f9ff' : '#f8fafc'};
                border: 1px solid ${hasSDData ? '#0ea5e9' : '#64748b'};
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 15px;
                text-align: center;
                font-size: 13px;
                color: ${hasSDData ? '#0369a1' : '#475569'};
            `;
            chartTypeIndicator.innerHTML = `
                <strong>📊 Chart Type:</strong> ${chartType}
                ${hasSDData ? '<br><small>Error bars show ±1 standard deviation</small>' : '<br><small>SD data not available - showing averages only</small>'}
            `;
            chartContainer.appendChild(chartTypeIndicator);

            // Create canvas with error handling
            const canvas = document.createElement('canvas');
            canvas.width = 576;
            canvas.height = 360;
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            chartContainer.appendChild(canvas);

            try {
                // Render the chart with station-based data
                this.drawLengthDistributionChart(canvas, aggregatedData, selectedVariable);
                console.log('✅ Chart rendered successfully');

            } catch (drawError) {
                console.error('❌ Error drawing chart:', drawError);

                // Replace canvas with error message
                chartContainer.removeChild(canvas);
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    background: #fef2f2;
                    border: 1px solid #f87171;
                    border-radius: 6px;
                    padding: 15px;
                    text-align: center;
                `;
                errorDiv.innerHTML = `
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Chart Rendering Error</h4>
                    <p>Failed to render the ${chartType.toLowerCase()}</p>
                    <p><small>Error: ${drawError.message}</small></p>
                `;
                chartContainer.appendChild(errorDiv);
            }

            // Clear loading message and add chart
            outputDiv.innerHTML = '';
            outputDiv.appendChild(chartContainer);

            // Add enhanced summary table with SD information
            try {
                this.addEnhancedLengthSummaryTable(aggregatedData, selectedVariable, outputDiv);
            } catch (tableError) {
                console.error('❌ Error creating summary table:', tableError);
                // Fallback to original table
                this.addLengthSummaryTable(aggregatedData, selectedVariable, outputDiv);
            }

        } catch (error) {
            console.error('❌ Error in renderLengthDistributionChart:', error);

            outputDiv.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 15px;">
                    <h4 style="color: #dc2626; margin-bottom: 8px;">❌ Rendering Error</h4>
                    <p>Failed to create length distribution chart</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer;">Technical Details</summary>
                        <pre style="background: #f8f8f8; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 11px;">${error.stack || 'No stack trace available'}</pre>
                    </details>
                </div>
            `;
        }
    }

    drawLengthDistributionChart(canvas, data, selectedVariable) {
        console.log('🎨 === DRAWING TRUE BOX PLOTS ===');
        console.log('Data length:', data.length);

        const ctx = canvas.getContext('2d');
        const padding = 80;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;

        // Clear canvas with white background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Determine chart type based on box plot availability
        const hasBoxPlots = data.some(d => d.hasBoxPlot && d.statistics);
        const chartTitle = hasBoxPlots
            ? `${selectedVariable} Distribution by Station (Box Plots)`
            : `Average ${selectedVariable} by Station`;

        console.log(`📊 Chart type: ${hasBoxPlots ? 'Box Plot' : 'Regular Bar Chart'}`);

        // Add chart title
        ctx.fillStyle = '#555';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(chartTitle, padding, 50);

        if (data.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data to display', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Calculate max value for scaling with buffer
        let maxDataValue = 0;
        let minDataValue = Infinity;

        if (hasBoxPlots) {
            // Use box plot statistics for scaling
            data.forEach(station => {
                if (station.statistics) {
                    maxDataValue = Math.max(maxDataValue, station.statistics.max, ...station.statistics.outliers);
                    minDataValue = Math.min(minDataValue, station.statistics.min, ...station.statistics.outliers);
                }
            });
            console.log(`📏 Box plot range: ${minDataValue.toFixed(1)} to ${maxDataValue.toFixed(1)}`);
        } else {
            // Fallback to avgLength for scaling
            maxDataValue = Math.max(...data.map(d => d.avgLength || 0));
            minDataValue = 0;
        }

        const maxValue = maxDataValue * 1.1;  // 10% buffer
        const yScale = chartHeight / maxValue;

        const boxWidth = chartWidth / data.length * 0.7;  // Box width
        const boxSpacing = chartWidth / data.length * 0.3;

        // Color scheme for box plots - Updated to match reference image
        const boxColor = '#f8f9fa';      // Very light gray fill
        const boxStroke = '#2c3e50';     // Dark blue-gray border
        const medianColor = '#e74c3c';   // Bright red median line
        const whiskerColor = '#34495e';  // Dark gray whiskers
        const outlierColor = '#e67e22';  // Orange outliers

        // Draw gridlines first
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);

        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight * i / 5);
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Draw box plots for each station
        data.forEach((station, index) => {
            const x = padding + index * (boxWidth + boxSpacing) + boxSpacing / 2;
            const centerX = x + boxWidth / 2;

            console.log(`\n📊 Drawing chart for station: ${station.station}`);

            if (hasBoxPlots && station.hasBoxPlot && station.statistics) {
                const stats = station.statistics;
                console.log(`📈 Drawing box plot: Q1=${stats.q1.toFixed(1)}, Med=${stats.median.toFixed(1)}, Q3=${stats.q3.toFixed(1)}`);

                // Calculate y positions
                const q1Y = canvas.height - padding - (stats.q1 * yScale);
                const medianY = canvas.height - padding - (stats.median * yScale);
                const q3Y = canvas.height - padding - (stats.q3 * yScale);
                const whiskerMinY = canvas.height - padding - (stats.whiskerMin * yScale);
                const whiskerMaxY = canvas.height - padding - (stats.whiskerMax * yScale);

                // Draw whiskers (vertical lines)
                ctx.strokeStyle = whiskerColor;
                ctx.lineWidth = 1.5;

                // Upper whisker
                ctx.beginPath();
                ctx.moveTo(centerX, q3Y);
                ctx.lineTo(centerX, whiskerMaxY);
                ctx.stroke();

                // Lower whisker
                ctx.beginPath();
                ctx.moveTo(centerX, q1Y);
                ctx.lineTo(centerX, whiskerMinY);
                ctx.stroke();

                // Whisker caps
                const capWidth = boxWidth * 0.3;
                ctx.beginPath();
                ctx.moveTo(centerX - capWidth/2, whiskerMaxY);
                ctx.lineTo(centerX + capWidth/2, whiskerMaxY);
                ctx.moveTo(centerX - capWidth/2, whiskerMinY);
                ctx.lineTo(centerX + capWidth/2, whiskerMinY);
                ctx.stroke();

                // Draw box (Q1 to Q3)
                const boxHeight = q1Y - q3Y;
                const boxLeft = x + boxWidth * 0.15;
                const boxDrawWidth = boxWidth * 0.7;

                // Box fill
                ctx.fillStyle = boxColor;
                ctx.fillRect(boxLeft, q3Y, boxDrawWidth, boxHeight);

                // Box border
                ctx.strokeStyle = boxStroke;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(boxLeft, q3Y, boxDrawWidth, boxHeight);

                // Median line
                ctx.strokeStyle = medianColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(boxLeft, medianY);
                ctx.lineTo(boxLeft + boxDrawWidth, medianY);
                ctx.stroke();

                // Draw outliers
                if (stats.outliers && stats.outliers.length > 0) {
                    ctx.fillStyle = outlierColor;
                    stats.outliers.forEach(outlier => {
                        const outlierY = canvas.height - padding - (outlier * yScale);
                        ctx.beginPath();
                        ctx.arc(centerX, outlierY, 3, 0, 2 * Math.PI);
                        ctx.fill();
                    });
                    console.log(`🔴 Drew ${stats.outliers.length} outliers`);
                }

                // Add statistics label - COMMENTED OUT
                // ctx.fillStyle = '#1f2937';
                // ctx.font = '9px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
                // ctx.textAlign = 'center';
                // const labelText = `Med: ${stats.median.toFixed(1)}`;
                // ctx.fillText(labelText, centerX, whiskerMaxY - 8);

            } else {
                // Draw regular bar (fallback when no box plot data)
                console.log(`📊 Drawing fallback bar chart: avg=${station.avgLength.toFixed(1)}`);

                const barHeight = station.avgLength * yScale;
                ctx.fillStyle = '#1f77b4';
                ctx.fillRect(x + boxWidth * 0.2, canvas.height - padding - barHeight, boxWidth * 0.6, barHeight);

                // Value label
                ctx.fillStyle = '#1f2937';
                ctx.font = '10px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(station.avgLength.toFixed(1), centerX, canvas.height - padding - barHeight - 5);
            }

            // Station label (rotated)
            ctx.save();
            ctx.translate(centerX, canvas.height - padding + 15);
            ctx.rotate(-Math.PI / 4);
            ctx.fillStyle = '#374151';
            ctx.font = '11px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(station.station, 0, 0);
            ctx.restore();
        });

        // Draw axes
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.stroke();

        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, canvas.height - padding);
        ctx.lineTo(padding + chartWidth, canvas.height - padding);
        ctx.stroke();

        // Right vertical framing line (at max x)
        ctx.beginPath();
        ctx.moveTo(padding + chartWidth, padding);
        ctx.lineTo(padding + chartWidth, canvas.height - padding);
        ctx.stroke();

        // Top horizontal framing line (at max y)
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding + chartWidth, padding);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'right';

        for (let i = 0; i <= 5; i++) {
            const value = (maxValue * i / 5).toFixed(1);
            const y = canvas.height - padding - (chartHeight * i / 5);
            ctx.fillText(value, padding - 10, y + 4);
        }

        // Y-axis title
        ctx.save();
        ctx.translate(25, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#374151';
        ctx.font = '12px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        const yAxisTitle = hasBoxPlots ? 'Length (cm) Distribution' : 'Average Length (cm)';
        ctx.fillText(yAxisTitle, 0, 0);
        ctx.restore();

        // X-axis title
        ctx.fillStyle = '#374151';
        ctx.font = '12px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Station', padding + chartWidth / 2, canvas.height - padding + 50);

        // Add legend for box plots - REMOVED
        // if (hasBoxPlots) {
        //     this.drawBoxPlotLegend(ctx, canvas, padding, this.fileName);
        // }

        console.log('✅ Box plot chart drawing complete');
    }

    drawBoxPlotLegend(ctx, canvas, padding, fileName) {
        console.log('🏷️ Drawing box plot legend');

        // File name truncation function (2nd to 4th underscore)
        const truncateFileName = (fileName) => {
            const parts = fileName.split('_');
            if (parts.length >= 4) {
                return parts.slice(2, 4).join('_');
            }
            return fileName; // Return original if not enough underscores
        };

        const legendX = canvas.width - padding - 160;
        const legendY = padding + 20;
        const legendWidth = 150;
        const legendHeight = 130; // Increased height to accommodate file name section

        // Legend background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

        // File name section (at top)
        if (fileName) {
            ctx.fillStyle = '#374151';
            ctx.font = 'bold 10px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('File:', legendX + 8, legendY + 15);

            ctx.fillStyle = '#1976d2';
            ctx.font = '9px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
            const truncatedName = truncateFileName(fileName);
            ctx.fillText(truncatedName, legendX + 8, legendY + 28);
        }

        // Legend title for box plot components
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 11px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Box Plot Components:', legendX + 8, legendY + 45);

        // Mini box plot example
        const exampleX = legendX + 15;
        const exampleY = legendY + 60;
        const exampleWidth = 20;
        const exampleHeight = 30;

        // Example whiskers
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(exampleX + 10, exampleY);
        ctx.lineTo(exampleX + 10, exampleY + exampleHeight);
        ctx.stroke();

        // Example box
        ctx.fillStyle = '#e3f2fd';
        ctx.fillRect(exampleX + 3, exampleY + 8, 14, 14);
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(exampleX + 3, exampleY + 8, 14, 14);

        // Example median line
        ctx.strokeStyle = '#d32f2f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(exampleX + 3, exampleY + 15);
        ctx.lineTo(exampleX + 17, exampleY + 15);
        ctx.stroke();

        // Example outlier
        ctx.fillStyle = '#ff5722';
        ctx.beginPath();
        ctx.arc(exampleX + 10, exampleY + 35, 2, 0, 2 * Math.PI);
        ctx.fill();

        // Legend labels
        ctx.fillStyle = '#555';
        ctx.font = '9px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'left';

        const labels = [
            { text: '• Box: Q1 to Q3 (IQR)', y: legendY + 65 },
            { text: '• Red line: Median', y: legendY + 76 },
            { text: '• Whiskers: Data range', y: legendY + 87 },
            { text: '• Orange dots: Outliers', y: legendY + 98 }
        ];

        labels.forEach(label => {
            ctx.fillText(label.text, exampleX + 25, label.y);
        });

        // Add sample size note
        ctx.fillStyle = '#6b7280';
        ctx.font = '8px "Segoe UI", "SF Pro Display", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
        ctx.fillText('Based on individual blade measurements', legendX + 8, legendY + 120);
    }

    drawWhiskerPlotLegend(ctx, canvas, padding) {
        const legendX = canvas.width - padding - 150;
        const legendY = padding + 20;

        // Legend background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.fillRect(legendX, legendY, 140, 60);
        ctx.strokeRect(legendX, legendY, 140, 60);

        // Legend title
        ctx.fillStyle = '#374151';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Legend:', legendX + 10, legendY + 15);

        // Mean indicator
        ctx.fillStyle = '#1f77b4';
        ctx.fillRect(legendX + 10, legendY + 22, 15, 3);
        ctx.fillStyle = '#555';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Mean', legendX + 30, legendY + 26);

        // Error bar indicator
        ctx.strokeStyle = '#0f5a8b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX + 17, legendY + 32);
        ctx.lineTo(legendX + 17, legendY + 42);
        ctx.stroke();

        // Error bar caps
        ctx.beginPath();
        ctx.moveTo(legendX + 14, legendY + 32);
        ctx.lineTo(legendX + 20, legendY + 32);
        ctx.moveTo(legendX + 14, legendY + 42);
        ctx.lineTo(legendX + 20, legendY + 42);
        ctx.stroke();

        ctx.fillStyle = '#555';
        ctx.fillText('±1 Std Dev', legendX + 30, legendY + 40);
    }

    getLengthVariableColor(index) {
        const colors = [
            '#3b82f6', // Blue
            '#ef4444', // Red
            '#10b981', // Green
            '#f59e0b', // Yellow
            '#8b5cf6', // Purple
            '#06b6d4'  // Cyan
        ];
        return colors[index % colors.length];
    }

    addLengthSummaryTable(data, selectedVariable, outputDiv) {
        const tableContainer = document.createElement('div');
        tableContainer.style.marginTop = '20px';

        const tableTitle = document.createElement('h4');
        tableTitle.textContent = `${selectedVariable} Summary by Station`;
        tableTitle.style.marginBottom = '10px';
        tableTitle.style.color = '#374151';
        tableContainer.appendChild(tableTitle);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.backgroundColor = 'white';

        // Header
        const thead = document.createElement('thead');
        thead.style.backgroundColor = '#f8fafc';
        const headerRow = document.createElement('tr');
        ['Station', 'Average (cm)', 'Min (cm)', 'Max (cm)', 'Count'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.border = '1px solid #e5e7eb';
            th.style.padding = '12px';
            th.style.textAlign = 'center';
            th.style.fontWeight = '600';
            th.style.color = '#374151';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.forEach(station => {
            const row = document.createElement('tr');
            [station.station, station.avgLength.toFixed(2), station.minLength.toFixed(2), station.maxLength.toFixed(2), station.count].forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                td.style.border = '1px solid #e5e7eb';
                td.style.padding = '10px';
                td.style.textAlign = 'center';
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.appendChild(table);
        outputDiv.appendChild(tableContainer);
    }

    addEnhancedLengthSummaryTable(data, selectedVariable, outputDiv) {
        console.log('📊 Creating enhanced summary table with box plot support');

        const tableContainer = document.createElement('div');
        tableContainer.style.marginTop = '20px';

        const hasBoxPlots = data.some(d => d.hasBoxPlot && d.statistics);

        const tableTitle = document.createElement('h4');
        tableTitle.textContent = hasBoxPlots
            ? `${selectedVariable} Distribution Statistics by Station (Box Plot Data)`
            : `${selectedVariable} Summary by Station`;
        tableTitle.style.marginBottom = '10px';
        tableTitle.style.color = '#374151';
        tableContainer.appendChild(tableTitle);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.backgroundColor = 'white';
        table.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        table.style.borderRadius = '6px';
        table.style.overflow = 'hidden';

        // Header
        const thead = document.createElement('thead');
        thead.style.backgroundColor = '#f8fafc';
        const headerRow = document.createElement('tr');

        let headers;
        if (hasBoxPlots) {
            headers = ['Station', 'Count', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'IQR', 'Outliers'];
        } else {
            headers = ['Station', 'Average (cm)', 'Min (cm)', 'Max (cm)', 'Count'];
        }

        headers.forEach((text, index) => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.border = '1px solid #e5e7eb';
            th.style.padding = '10px';
            th.style.textAlign = 'center';
            th.style.fontWeight = '600';
            th.style.color = '#374151';
            th.style.fontSize = '11px';

            // Highlight key box plot columns
            if (hasBoxPlots && ['Median', 'IQR', 'Outliers'].includes(text)) {
                th.style.backgroundColor = '#f0f9ff';
                th.style.color = '#0369a1';
            } else {
                th.style.backgroundColor = '#f8fafc';
            }

            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.forEach((station, index) => {
            const row = document.createElement('tr');
            row.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9fafb';

            let values;
            if (hasBoxPlots && station.statistics) {
                const stats = station.statistics;
                const outlierText = stats.outliers.length > 0
                    ? `${stats.outliers.length} (${stats.outliers.map(o => o.toFixed(1)).join(', ')})`
                    : '0';

                values = [
                    station.station,
                    stats.count.toString(),
                    stats.min.toFixed(1),
                    stats.q1.toFixed(1),
                    stats.median.toFixed(1),
                    stats.q3.toFixed(1),
                    stats.max.toFixed(1),
                    stats.iqr.toFixed(1),
                    outlierText
                ];
            } else {
                values = [
                    station.station,
                    station.avgLength ? station.avgLength.toFixed(2) : 'N/A',
                    station.minLength ? station.minLength.toFixed(2) : 'N/A',
                    station.maxLength ? station.maxLength.toFixed(2) : 'N/A',
                    station.count.toString()
                ];
            }

            values.forEach((value, colIndex) => {
                const td = document.createElement('td');
                td.textContent = value;
                td.style.border = '1px solid #e5e7eb';
                td.style.padding = '8px';
                td.style.textAlign = 'center';
                td.style.fontSize = '11px';

                // Highlight key statistics for box plots
                if (hasBoxPlots && ['Median', 'IQR', 'Outliers'].includes(headers[colIndex])) {
                    if (headers[colIndex] === 'Outliers' && value !== '0') {
                        td.style.backgroundColor = '#fef2f2';
                        td.style.color = '#dc2626';
                        td.style.fontWeight = '500';
                    } else {
                        td.style.backgroundColor = '#f0f9ff';
                        td.style.fontWeight = '500';
                    }
                }

                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.appendChild(table);

        // Add summary statistics
        if (hasBoxPlots) {
            const summaryDiv = document.createElement('div');
            summaryDiv.style.cssText = `
                margin-top: 15px;
                padding: 12px;
                background: #f0f9ff;
                border: 1px solid #0ea5e9;
                border-radius: 6px;
                font-size: 12px;
                color: #0369a1;
            `;

            const totalMeasurements = data.reduce((sum, d) => sum + (d.statistics?.count || 0), 0);
            const totalOutliers = data.reduce((sum, d) => sum + (d.statistics?.outliers.length || 0), 0);
            const avgMedian = data.reduce((sum, d) => sum + (d.statistics?.median || 0), 0) / data.length;

            summaryDiv.innerHTML = `
                <strong>📊 Box Plot Summary:</strong><br>
                • Total individual measurements: ${totalMeasurements}<br>
                • Average median across stations: ${avgMedian.toFixed(2)} cm<br>
                • Total outliers detected: ${totalOutliers}<br>
                • Data source: Individual blade measurements
            `;

            tableContainer.appendChild(summaryDiv);
        }

        outputDiv.appendChild(tableContainer);
        console.log('✅ Enhanced box plot summary table created successfully');
    }
}

// Initialize the CSV Manager and Navigation when the page loads
let csvManager;
let navigationManager;
document.addEventListener('DOMContentLoaded', () => {
    csvManager = new CSVManager();
    navigationManager = new NavigationManager();

    // Hook into csvManager's file loading to update plot page
    const originalUpdateFileBrowser = csvManager.updateFileBrowser;
    csvManager.updateFileBrowser = function(files) {
        originalUpdateFileBrowser.call(this, files);
        // Update plot page when files are loaded
        if (navigationManager) {
            // Fire and forget - don't await to avoid blocking the UI
            navigationManager.updatePlotPageFileInfo().catch(console.error);
        }
    };

});