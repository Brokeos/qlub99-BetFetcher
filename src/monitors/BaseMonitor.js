const EventEmitter = require('events');

class BaseMonitor extends EventEmitter {
    constructor(name, provider, options = {}) {
        super();
        this.name = name;
        this.provider = provider;
        this.options = {
            updateInterval: 5000,
            maxRetries: 3,
            retryDelay: 1000,
            ...options
        };
        
        this.isRunning = false;
        this.retryCount = 0;
        this.lastUpdate = null;
        this.currentData = [];
    }
    
    async start() {
        if (this.isRunning) {
            console.log(`Monitor ${this.name} is already running`);
            return;
        }
        
        try {
            await this.provider.initialize();
            this.isRunning = true;
            this.retryCount = 0;
            
            console.log(`Monitor ${this.name} started`);
            
            await this.startMonitoring();
            this.emit('started');
        } catch (error) {
            console.error(`Failed to start monitor ${this.name}: ${error.message}`);
            this.emit('error', error);
            throw error;
        }
    }
    
    async stop() {
        if (!this.isRunning) {
            console.log(`Monitor ${this.name} is not running`);
            return;
        }
        
        this.isRunning = false;
        await this.stopMonitoring();
        
        console.log(`Monitor ${this.name} stopped`);
        this.emit('stopped');
    }
    
    async restart() {
        console.log(`Restarting monitor ${this.name}`);
        await this.stop();
        await this.start();
    }
    
    async startMonitoring() {
        throw new Error('startMonitoring must be implemented by subclasses');
    }
    
    async stopMonitoring() {
        throw new Error('stopMonitoring must be implemented by subclasses');
    }
    
    async handleUpdate(newData) {
        try {
            const changes = this.detectChanges(this.currentData, newData);
            
            if (changes.length > 0) {
                this.currentData = newData;
                this.lastUpdate = new Date();
                this.retryCount = 0;
                
                console.log(`Monitor ${this.name} detected ${changes.length} changes`);
                
                this.emit('update', {
                    data: newData,
                    changes: changes,
                    timestamp: this.lastUpdate
                });
            }
        } catch (error) {
            console.error(`Error handling update for monitor ${this.name}: ${error.message}`);
            this.handleError(error);
        }
    }
    
    detectChanges(oldData, newData) {
        const changes = [];
        const oldMap = new Map(oldData.map(item => [item.id, item]));
        const newMap = new Map(newData.map(item => [item.id, item]));
        
        for (const [id, newItem] of newMap) {
            const oldItem = oldMap.get(id);
            
            if (!oldItem) {
                changes.push({
                    type: 'added',
                    id: id,
                    data: newItem
                });
            } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                changes.push({
                    type: 'updated',
                    id: id,
                    oldData: oldItem,
                    newData: newItem
                });
            }
        }
        
        for (const [id, oldItem] of oldMap) {
            if (!newMap.has(id)) {
                changes.push({
                    type: 'removed',
                    id: id,
                    data: oldItem
                });
            }
        }
        
        return changes;
    }
    
    async handleError(error) {
        this.retryCount++;
        
        if (this.retryCount <= this.options.maxRetries) {
            console.log(`Monitor ${this.name} retry ${this.retryCount}/${this.options.maxRetries} after error: ${error.message}`);
            
            setTimeout(async () => {
                if (this.isRunning) {
                    try {
                        await this.startMonitoring();
                    } catch (retryError) {
                        this.handleError(retryError);
                    }
                }
            }, this.options.retryDelay * this.retryCount);
        } else {
            console.error(`Monitor ${this.name} failed after ${this.options.maxRetries} retries: ${error.message}`);
            this.emit('error', error);
            await this.stop();
        }
    }
    
    getStatus() {
        return {
            name: this.name,
            isRunning: this.isRunning,
            lastUpdate: this.lastUpdate,
            retryCount: this.retryCount,
            dataCount: this.currentData.length
        };
    }
}

module.exports = BaseMonitor; 