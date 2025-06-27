const EventEmitter = require('events');

class MonitorManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.monitors = new Map();
        this.options = {
            gracefulShutdownTimeout: 30000,
            ...options
        };
        
        this.isShuttingDown = false;
        this.setupSignalHandlers();
    }
    
    addMonitor(monitor) {
        if (this.monitors.has(monitor.name)) {
            throw new Error(`Monitor with name ${monitor.name} already exists`);
        }
        
        this.monitors.set(monitor.name, monitor);
        this.setupMonitorListeners(monitor);
        
        console.log(`Monitor ${monitor.name} added to manager`);
        this.emit('monitorAdded', monitor);
    }
    
    removeMonitor(name) {
        const monitor = this.monitors.get(name);
        
        if (!monitor) {
            console.warn(`Monitor ${name} not found`);
            return false;
        }
        
        this.monitors.delete(name);
        this.removeMonitorListeners(monitor);
        
        console.log(`Monitor ${name} removed from manager`);
        this.emit('monitorRemoved', monitor);
        
        return true;
    }
    
    async startMonitor(name) {
        const monitor = this.monitors.get(name);
        
        if (!monitor) {
            throw new Error(`Monitor ${name} not found`);
        }
        
        await monitor.start();
    }
    
    async stopMonitor(name) {
        const monitor = this.monitors.get(name);
        
        if (!monitor) {
            throw new Error(`Monitor ${name} not found`);
        }
        
        await monitor.stop();
    }
    
    async restartMonitor(name) {
        const monitor = this.monitors.get(name);
        
        if (!monitor) {
            throw new Error(`Monitor ${name} not found`);
        }
        
        await monitor.restart();
    }
    
    async startAll() {
        if (this.isShuttingDown) {
            throw new Error('Cannot start monitors during shutdown');
        }
        
        console.log(`Starting ${this.monitors.size} monitors`);
        
        const promises = Array.from(this.monitors.values()).map(async (monitor) => {
            try {
                await monitor.start();
            } catch (error) {
                console.error(`Failed to start monitor ${monitor.name}: ${error.message}`);
            }
        });
        
        await Promise.all(promises);
        
        const runningCount = this.getRunningMonitors().length;
        console.log(`${runningCount}/${this.monitors.size} monitors started successfully`);
        
        this.emit('allStarted', { total: this.monitors.size, running: runningCount });
    }
    
    async stopAll() {
        console.log(`Stopping ${this.monitors.size} monitors`);
        
        const promises = Array.from(this.monitors.values()).map(async (monitor) => {
            try {
                await monitor.stop();
            } catch (error) {
                console.error(`Failed to stop monitor ${monitor.name}: ${error.message}`);
            }
        });
        
        await Promise.all(promises);
        
        console.log('All monitors stopped');
        this.emit('allStopped');
    }
    
    async restartAll() {
        console.log('Restarting all monitors');
        await this.stopAll();
        await this.startAll();
        this.emit('allRestarted');
    }
    
    getMonitor(name) {
        return this.monitors.get(name);
    }
    
    getAllMonitors() {
        return Array.from(this.monitors.values());
    }
    
    getRunningMonitors() {
        return Array.from(this.monitors.values()).filter(monitor => monitor.isRunning);
    }
    
    getStoppedMonitors() {
        return Array.from(this.monitors.values()).filter(monitor => !monitor.isRunning);
    }
    
    getStatus() {
        const monitors = Array.from(this.monitors.values()).map(monitor => monitor.getStatus());
        const running = monitors.filter(m => m.isRunning).length;
        
        return {
            total: this.monitors.size,
            running: running,
            stopped: this.monitors.size - running,
            monitors: monitors,
            isShuttingDown: this.isShuttingDown
        };
    }
    
    setupMonitorListeners(monitor) {
        monitor.on('started', () => {
            console.log(`Monitor ${monitor.name} started`);
            this.emit('monitorStarted', monitor);
        });
        
        monitor.on('stopped', () => {
            console.log(`Monitor ${monitor.name} stopped`);
            this.emit('monitorStopped', monitor);
        });
        
        monitor.on('update', (updateData) => {
            this.emit('monitorUpdate', monitor, updateData);
        });
        
        monitor.on('error', (error) => {
            console.error(`Monitor ${monitor.name} error: ${error.message}`);
            this.emit('monitorError', monitor, error);
        });
    }
    
    removeMonitorListeners(monitor) {
        monitor.removeAllListeners();
    }
    
    setupSignalHandlers() {
        const gracefulShutdown = async (signal) => {
            if (this.isShuttingDown) {
                console.log('Force shutdown');
                process.exit(1);
            }
            
            this.isShuttingDown = true;
            console.log(`Received ${signal}, shutting down gracefully`);
            
            const shutdownTimeout = setTimeout(() => {
                console.log('Shutdown timeout reached, forcing exit');
                process.exit(1);
            }, this.options.gracefulShutdownTimeout);
            
            try {
                await this.stopAll();
                clearTimeout(shutdownTimeout);
                console.log('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                console.error(`Error during shutdown: ${error.message}`);
                clearTimeout(shutdownTimeout);
                process.exit(1);
            }
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
}

module.exports = MonitorManager; 