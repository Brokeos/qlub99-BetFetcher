const BaseMonitor = require('./BaseMonitor');

class FlashScoreMonitor extends BaseMonitor {
    constructor(provider, options = {}) {
        super('FlashScore', provider, options);
        
        this.pages = new Map();
        this.sportConfigs = [];
        this.webSocketListeners = new Map();
        this.domHashes = new Map();
    }
    
    async startMonitoring() {
        try {
            this.sportConfigs = this.provider.sportsConfig.filter(config => config.liveUrl);
            
            if (this.sportConfigs.length === 0) {
                throw new Error('No live URLs found in sport configurations');
            }
            
            await this.setupPages();
            await this.loadInitialData();
            
            console.log(`FlashScore monitor started with ${this.sportConfigs.length} sport pages`);
        } catch (error) {
            console.error(`Failed to start FlashScore monitoring: ${error.message}`);
            throw error;
        }
    }
    
    async stopMonitoring() {
        await this.closeAllPages();
        this.webSocketListeners.clear();
        this.domHashes.clear();
        
        console.log('FlashScore monitor stopped');
    }
    
    async setupPages() {
        const setupPromises = this.sportConfigs.map(async (sportConfig) => {
            try {
                const page = await this.provider.browser.newPage();
                await page.setUserAgent(this.provider.options.userAgent);
                await page.setViewport({width: 1920, height: 1080});
                
                this.pages.set(sportConfig.name, page);
                
                await this.setupPageMonitoring(page, sportConfig);
                await this.navigateToLivePage(page, sportConfig);
                
                console.log(`Page setup completed for ${sportConfig.name}`);
            } catch (error) {
                console.error(`Failed to setup page for ${sportConfig.name}: ${error.message}`);
            }
        });
        
        await Promise.all(setupPromises);
    }
    
    async setupPageMonitoring(page, sportConfig) {
        await page.evaluateOnNewDocument(() => {
            const originalWebSocket = window.WebSocket;
            
            window.WebSocket = function(url, protocols) {
                const ws = new originalWebSocket(url, protocols);
                
                ws.addEventListener('message', (event) => {
                    window.dispatchEvent(new CustomEvent('websocket-message', {
                        detail: { 
                            url, 
                            data: event.data, 
                            timestamp: Date.now(),
                            sport: window.location.href
                        }
                    }));
                });
                
                return ws;
            };
            
            Object.setPrototypeOf(window.WebSocket, originalWebSocket);
            Object.defineProperty(window.WebSocket, 'prototype', {
                value: originalWebSocket.prototype,
                writable: false
            });
        });
        
        await page.exposeFunction('onWebSocketMessage', (data) => {
            this.handleWebSocketMessage(data, sportConfig);
        });
        
        await page.exposeFunction('onDomChange', (hash) => {
            this.handleDomChange(hash, sportConfig);
        });
        
        await page.evaluate(() => {
            window.addEventListener('websocket-message', (event) => {
                window.onWebSocketMessage(event.detail);
            });
            
            const targetNode = document.body;
            const config = { 
                childList: true, 
                subtree: true, 
                attributes: true, 
                attributeOldValue: true,
                characterData: true
            };
            
            let debounceTimer = null;
            
            const generateHash = (element) => {
                const matchElements = element.querySelectorAll('.event__match[data-event-row="true"]');
                let contentString = '';
                
                matchElements.forEach((match) => {
                    contentString += match.outerHTML;
                });
                
                let hash = 0;
                for (let i = 0; i < contentString.length; i++) {
                    const char = contentString.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                
                return hash.toString();
            };
            
            const observer = new MutationObserver(() => {
                clearTimeout(debounceTimer);
                
                debounceTimer = setTimeout(() => {
                    const currentHash = generateHash(document.body);
                    window.onDomChange(currentHash);
                }, 500);
            });
            
            observer.observe(targetNode, config);
            
            setTimeout(() => {
                const initialHash = generateHash(document.body);
                window.onDomChange(initialHash);
            }, 2000);
        });
    }
    
    async navigateToLivePage(page, sportConfig) {
        try {
            const response = await page.goto(sportConfig.liveUrl, {
                waitUntil: 'networkidle2',
                timeout: this.provider.options.timeout
            });
            
            if (!response || !response.ok()) {
                throw new Error(`Failed to load ${sportConfig.liveUrl}`);
            }
            
            console.log(`Navigated to live page for ${sportConfig.name}`);
        } catch (error) {
            console.error(`Failed to navigate to live page for ${sportConfig.name}: ${error.message}`);
            throw error;
        }
    }
    
    async loadInitialData() {
        try {
            const allMatches = [];
            
            const fetchPromises = this.sportConfigs.map(async (sportConfig) => {
                try {
                    const page = this.pages.get(sportConfig.name);
                    if (!page) return [];
                    
                    const html = await page.content();
                    const matches = this.provider.parseMatches(html, sportConfig);
                    
                    console.log(`Loaded ${matches.length} initial matches for ${sportConfig.name}`);
                    return matches;
                } catch (error) {
                    console.error(`Failed to load initial data for ${sportConfig.name}: ${error.message}`);
                    return [];
                }
            });
            
            const results = await Promise.all(fetchPromises);
            results.forEach(matches => allMatches.push(...matches));
            
            this.currentData = this.provider.mergeMatches(allMatches);
            this.lastUpdate = new Date();
            
            console.log(`Loaded ${this.currentData.length} total initial matches`);
        } catch (error) {
            console.error(`Failed to load initial data: ${error.message}`);
            throw error;
        }
    }
    
    async handleWebSocketMessage(data, sportConfig) {
        try {
            console.log(`WebSocket message received for ${sportConfig.name}`);
            await this.refreshPageData(sportConfig);
        } catch (error) {
            console.error(`Error handling WebSocket message for ${sportConfig.name}: ${error.message}`);
        }
    }
    
    async handleDomChange(hash, sportConfig) {
        try {
            const pageKey = sportConfig.name;
            const lastHash = this.domHashes.get(pageKey);
            
            if (lastHash !== null && lastHash !== hash) {
                console.log(`DOM change detected for ${sportConfig.name}`);
                await this.refreshPageData(sportConfig);
            }
            
            this.domHashes.set(pageKey, hash);
        } catch (error) {
            console.error(`Error handling DOM change for ${sportConfig.name}: ${error.message}`);
        }
    }
    
    async refreshPageData(sportConfig) {
        try {
            const page = this.pages.get(sportConfig.name);
            if (!page) {
                console.error(`Page not found for ${sportConfig.name}`);
                return;
            }
            
            const html = await page.content();
            const pageMatches = this.provider.parseMatches(html, sportConfig);
            
            const allMatches = [];
            
            for (const config of this.sportConfigs) {
                if (config.name === sportConfig.name) {
                    allMatches.push(...pageMatches);
                } else {
                    const otherPage = this.pages.get(config.name);
                    if (otherPage) {
                        try {
                            const otherHtml = await otherPage.content();
                            const otherMatches = this.provider.parseMatches(otherHtml, config);
                            allMatches.push(...otherMatches);
                        } catch (error) {
                            console.error(`Failed to get data from ${config.name}: ${error.message}`);
                        }
                    }
                }
            }
            
            const mergedData = this.provider.mergeMatches(allMatches);
            await this.handleUpdate(mergedData);
            
            console.log(`Refreshed data for ${sportConfig.name}, total matches: ${mergedData.length}`);
        } catch (error) {
            console.error(`Error refreshing data for ${sportConfig.name}: ${error.message}`);
            this.handleError(error);
        }
    }
    
    async refreshAllData() {
        try {
            const allMatches = [];
            
            const refreshPromises = this.sportConfigs.map(async (sportConfig) => {
                const page = this.pages.get(sportConfig.name);
                if (!page) return [];
                
                try {
                    const html = await page.content();
                    return this.provider.parseMatches(html, sportConfig);
                } catch (error) {
                    console.error(`Failed to refresh ${sportConfig.name}: ${error.message}`);
                    return [];
                }
            });
            
            const results = await Promise.all(refreshPromises);
            results.forEach(matches => allMatches.push(...matches));
            
            const mergedData = this.provider.mergeMatches(allMatches);
            await this.handleUpdate(mergedData);
            
            console.log(`Refreshed all data, total matches: ${mergedData.length}`);
        } catch (error) {
            console.error(`Error refreshing all data: ${error.message}`);
            this.handleError(error);
        }
    }
    
    async closeAllPages() {
        const closePromises = Array.from(this.pages.values()).map(async (page) => {
            try {
                await page.close();
            } catch (error) {
                console.error(`Error closing page: ${error.message}`);
            }
        });
        
        await Promise.all(closePromises);
        this.pages.clear();
        
        console.log('All pages closed');
    }
    
    getPageStatuses() {
        const statuses = {};
        
        for (const [sportName, page] of this.pages) {
            statuses[sportName] = {
                isOpen: !page.isClosed(),
                url: page.url(),
                lastDomHash: this.domHashes.get(sportName)
            };
        }
        
        return statuses;
    }
    
    getStatus() {
        const baseStatus = super.getStatus();
        
        return {
            ...baseStatus,
            pagesCount: this.pages.size,
            sportsConfigured: this.sportConfigs.length,
            pageStatuses: this.getPageStatuses()
        };
    }
}

module.exports = FlashScoreMonitor; 