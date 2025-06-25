const { redis } = require("../repository/config");

class CacheService {
	constructor() {
		this.defaultTTL = 3600;
	}
	
	generateKey(entityName, id) {
		return `betfetcher:${entityName}:${id}`;
	}
	
	async get(key) {
		const cachedData = await redis.get(key);
		
		return cachedData ? JSON.parse(cachedData) : null;
	}
	
	async getAll(entityName) {
		const keys = await redis.keys(this.generateKey(entityName, '*'));
		const results = [];
		
		for (const key of keys) {
			const data = await this.get(key);
			if (data) {
				results.push(data);
			}
		}
		
		return results;
	}
	
	async set(key, data, ttl = this.defaultTTL) {
		if (ttl === null || ttl === undefined || ttl === -1) {
			await redis.set(key, JSON.stringify(data));
		} else {
			await redis.set(key, JSON.stringify(data), { 'EX': ttl});
		}
	}
	
	async delete(key) {
		await redis.del(key);
	}
}

module.exports = new CacheService();