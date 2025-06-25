class BaseProvider {
	constructor(name, options = {}) {
		this.name = name;
		this.options = {
			timeout: 10000,
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			...options
		}
		this.isInitialized = false;
	}
	
	async initialize() {
		throw new Error(`Method initialize() must be implemented by provider ${this.name}`);
	}
	
	async fetchMatchs(){
		throw new Error(`Method fetchMatchs() must be implemented by provider ${this.name}`);
	}
}

module.exports = BaseProvider;