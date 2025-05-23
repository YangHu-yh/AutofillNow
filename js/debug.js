// Debug utility functions
const DebugUtil = {
    logs: [],
    errors: [],
    showNonCriticalErrors: false, // Default to hiding non-critical errors
    
    // Load logs from Chrome storage
    loadLogs: function() {
        chrome.storage.local.get(['autofill_debug_logs', 'autofill_debug_errors', 'autofill_show_non_critical'], (result) => {
            this.logs = result.autofill_debug_logs || [];
            this.errors = result.autofill_debug_errors || [];
            this.showNonCriticalErrors = result.autofill_show_non_critical || false;
            
            // Update UI
            this.updateLogsUI();
            this.updateErrorsUI();
            
            // Update counts
            this.updateCounts();
        });
    },
    
    // Update the error and log counts in the UI
    updateCounts: function() {
        // Filter out non-critical errors for the count if needed
        const errorCount = this.showNonCriticalErrors 
            ? this.errors.length 
            : this.errors.filter(error => !this.isNonCriticalError(error.message)).length;
            
        document.getElementById('log-count').textContent = this.logs.length;
        document.getElementById('error-count').textContent = errorCount;
        
        // Update the filter toggle button text
        const filterBtn = document.getElementById('toggleNonCritical');
        if (filterBtn) {
            filterBtn.textContent = this.showNonCriticalErrors 
                ? "Hide Browser Warnings" 
                : "Show Browser Warnings";
        }
    },
    
    // Toggle showing/hiding non-critical errors
    toggleNonCriticalErrors: function() {
        this.showNonCriticalErrors = !this.showNonCriticalErrors;
        
        // Save preference
        chrome.storage.local.set({
            autofill_show_non_critical: this.showNonCriticalErrors
        });
        
        // Update UI
        this.updateErrorsUI();
        this.updateCounts();
    },
    
    // Check if an error message is a non-critical browser warning
    isNonCriticalError: function(message) {
        if (!message) return false;
        
        // List of known non-critical browser warnings
        const nonCriticalPatterns = [
            'ResizeObserver loop', 
            'Script error',
            'Load failed',
            'Cannot read properties of null',
            'Extension context invalidated',
            'The specified value is non-finite'
        ];
        
        return nonCriticalPatterns.some(pattern => message.includes(pattern));
    },
    
    // Clear logs in Chrome storage
    clearLogs: function() {
        if (confirm('Are you sure you want to clear all logs?')) {
            chrome.storage.local.remove(['autofill_debug_logs', 'autofill_debug_errors'], () => {
                this.logs = [];
                this.errors = [];
                
                // Update UI
                this.updateLogsUI();
                this.updateErrorsUI();
                
                // Update counts
                this.updateCounts();
            });
        }
    },
    
    // Update logs UI
    updateLogsUI: function() {
        const container = document.getElementById('log-container');
        container.innerHTML = '';
        
        if (this.logs.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No logs available.</div>';
            return;
        }
        
        // Sort logs by timestamp (newest first)
        const sortedLogs = [...this.logs].sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Create log entries
        sortedLogs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            
            const timestamp = document.createElement('div');
            timestamp.className = 'timestamp';
            timestamp.textContent = new Date(log.timestamp).toLocaleString();
            
            const category = document.createElement('span');
            category.className = 'category';
            category.textContent = log.category || 'unknown';
            
            const message = document.createElement('div');
            message.className = 'log-message';
            message.textContent = log.message || '';
            
            logEntry.appendChild(timestamp);
            logEntry.appendChild(category);
            logEntry.appendChild(message);
            
            container.appendChild(logEntry);
        });
    },
    
    // Update errors UI
    updateErrorsUI: function() {
        const container = document.getElementById('error-container');
        container.innerHTML = '';
        
        // Filter errors if needed
        let errorsToShow = this.errors;
        if (!this.showNonCriticalErrors) {
            errorsToShow = this.errors.filter(error => !this.isNonCriticalError(error.message));
        }
        
        if (errorsToShow.length === 0) {
            container.innerHTML = '<div class="alert alert-success">No errors recorded.</div>';
            return;
        }
        
        // Sort errors by timestamp (newest first)
        const sortedErrors = [...errorsToShow].sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Create error entries
        sortedErrors.forEach(error => {
            const errorEntry = document.createElement('div');
            errorEntry.className = 'log-entry error-entry expandable';
            
            // Add a class for non-critical errors
            if (this.isNonCriticalError(error.message)) {
                errorEntry.classList.add('warning-entry');
            }
            
            const timestamp = document.createElement('div');
            timestamp.className = 'timestamp';
            timestamp.textContent = new Date(error.timestamp).toLocaleString();
            
            const category = document.createElement('span');
            category.className = 'category';
            category.textContent = error.category || 'unknown';
            
            const message = document.createElement('div');
            message.className = 'log-message';
            message.textContent = error.message || '';
            
            const stack = document.createElement('div');
            stack.className = 'stack-trace';
            stack.textContent = error.stack || 'No stack trace available';
            
            errorEntry.appendChild(timestamp);
            errorEntry.appendChild(category);
            errorEntry.appendChild(message);
            errorEntry.appendChild(stack);
            
            // Toggle stack trace visibility on click
            errorEntry.addEventListener('click', function() {
                const stackTrace = this.querySelector('.stack-trace');
                if (stackTrace.style.display === 'block') {
                    stackTrace.style.display = 'none';
                } else {
                    stackTrace.style.display = 'block';
                }
            });
            
            container.appendChild(errorEntry);
        });
    },
    
    // Load and display profile data
    loadProfileData: function() {
        chrome.storage.local.get(['lastSelectedProfile', 'profilesList'], (profileResult) => {
            let currentProfile = 'default';
            
            if (profileResult.lastSelectedProfile && 
                profileResult.profilesList && 
                profileResult.profilesList.includes(profileResult.lastSelectedProfile)) {
                currentProfile = profileResult.lastSelectedProfile;
            }
            
            document.getElementById('currentProfile').innerHTML = `
                <strong>Current Profile:</strong> ${currentProfile}<br>
                <strong>Available Profiles:</strong> ${(profileResult.profilesList || ['default']).join(', ')}
            `;
            
            // Now get data for the current profile
            let userDataKey = "userdata_" + currentProfile;
            
            chrome.storage.local.get([userDataKey, "userdata"], (result) => {
                let userData = result[userDataKey] || (currentProfile === "default" ? result.userdata : null);
                
                if (userData) {
                    // Format and display the data
                    try {
                        if (typeof userData === 'string') {
                            userData = JSON.parse(userData);
                        }
                        document.getElementById('profile-data').textContent = JSON.stringify(userData, null, 2);
                    } catch (e) {
                        document.getElementById('profile-data').textContent = 'Error parsing profile data: ' + e.message;
                    }
                } else {
                    document.getElementById('profile-data').textContent = 'No profile data found.';
                }
            });
        });
    },
    
    // Load system information
    loadSystemInfo: function() {
        const systemInfo = {
            'Browser': navigator.userAgent,
            'Platform': navigator.platform,
            'Extension Version': chrome.runtime.getManifest().version,
            'Timestamp': new Date().toLocaleString()
        };
        
        // Get the permissions
        chrome.permissions.getAll(permissions => {
            systemInfo['Permissions'] = permissions.permissions.join(', ');
            systemInfo['Host Permissions'] = permissions.origins.join(', ');
            
            // Get storage usage
            chrome.storage.local.getBytesInUse(null, bytesInUse => {
                systemInfo['Storage Usage'] = `${(bytesInUse / 1024).toFixed(2)} KB`;
                
                // Update the UI
                const table = document.getElementById('system-info-table');
                table.innerHTML = '';
                
                for (const [key, value] of Object.entries(systemInfo)) {
                    const row = document.createElement('tr');
                    
                    const keyCell = document.createElement('td');
                    keyCell.textContent = key;
                    keyCell.style.fontWeight = 'bold';
                    keyCell.style.width = '30%';
                    
                    const valueCell = document.createElement('td');
                    valueCell.textContent = value;
                    
                    row.appendChild(keyCell);
                    row.appendChild(valueCell);
                    
                    table.appendChild(row);
                }
            });
        });
    },
    
    // Test profile data 
    testProfileData: function() {
        chrome.storage.local.get(['lastSelectedProfile', 'profilesList'], (profileResult) => {
            let currentProfile = 'default';
            
            if (profileResult.lastSelectedProfile && 
                profileResult.profilesList && 
                profileResult.profilesList.includes(profileResult.lastSelectedProfile)) {
                currentProfile = profileResult.lastSelectedProfile;
            }
            
            // Now get data for the current profile
            let userDataKey = "userdata_" + currentProfile;
            
            chrome.storage.local.get([userDataKey, "userdata"], (result) => {
                let userData = result[userDataKey] || (currentProfile === "default" ? result.userdata : null);
                
                const testResults = document.createElement('div');
                testResults.className = 'alert alert-info mt-3';
                
                if (userData) {
                    try {
                        if (typeof userData === 'string') {
                            userData = JSON.parse(userData);
                            testResults.innerHTML += '<p>Profile data is stored as a string and needs parsing.</p>';
                        }
                        
                        // Check essential fields
                        const essentialFields = ['first name', 'last name', 'email', 'phone'];
                        const missingFields = [];
                        
                        essentialFields.forEach(field => {
                            if (!userData[field]) {
                                missingFields.push(field);
                            }
                        });
                        
                        if (missingFields.length > 0) {
                            testResults.innerHTML += `<p>Missing essential fields: ${missingFields.join(', ')}</p>`;
                        } else {
                            testResults.innerHTML += '<p>All essential fields are present.</p>';
                        }
                        
                        // Check arrays
                        if (!Array.isArray(userData.educations)) {
                            testResults.innerHTML += '<p>educations is not an array or is missing.</p>';
                        }
                        
                        if (!Array.isArray(userData.experiences)) {
                            testResults.innerHTML += '<p>experiences is not an array or is missing.</p>';
                        }
                        
                        // Add a summary
                        testResults.innerHTML = `<h4>Profile Test Results for "${currentProfile}"</h4>` + testResults.innerHTML;
                        
                    } catch (e) {
                        testResults.className = 'alert alert-danger mt-3';
                        testResults.innerHTML = `<h4>Error Testing Profile "${currentProfile}"</h4><p>Error: ${e.message}</p>`;
                    }
                } else {
                    testResults.className = 'alert alert-danger mt-3';
                    testResults.innerHTML = `<h4>No Profile Data Found for "${currentProfile}"</h4><p>Please create a profile.</p>`;
                }
                
                // Add to the UI
                const container = document.getElementById('profile');
                
                // Remove any previous test results
                const previousResults = container.querySelectorAll('.alert');
                previousResults.forEach(el => el.remove());
                
                container.appendChild(testResults);
            });
        });
    },
    
    // Export logs to a file
    exportLogs: function() {
        const data = {
            logs: this.logs,
            errors: this.errors,
            timestamp: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
            browser: navigator.userAgent
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `autofill-logs-${new Date().toISOString().replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }
};

// Initialize the debug page
document.addEventListener('DOMContentLoaded', function() {
    // Load logs
    DebugUtil.loadLogs();
    
    // Load profile data
    DebugUtil.loadProfileData();
    
    // Load system info
    DebugUtil.loadSystemInfo();
    
    // Set up button handlers
    document.getElementById('refreshLogs').addEventListener('click', () => {
        DebugUtil.loadLogs();
        DebugUtil.loadProfileData();
        DebugUtil.loadSystemInfo();
    });
    
    document.getElementById('clearLogs').addEventListener('click', () => {
        DebugUtil.clearLogs();
    });
    
    document.getElementById('testProfile').addEventListener('click', () => {
        DebugUtil.testProfileData();
    });
    
    document.getElementById('exportLogs').addEventListener('click', () => {
        DebugUtil.exportLogs();
    });
    
    // Add handler for the toggle non-critical errors button
    document.getElementById('toggleNonCritical').addEventListener('click', () => {
        DebugUtil.toggleNonCriticalErrors();
    });
}); 