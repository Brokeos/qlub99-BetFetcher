const { get, add, exists, getAll, getByName} = require('./sports.database');
const cacheService = require('../services/cache.service');

class Sports {
	static CACHE_TTL = 60 * 60 * 24 * 7 * 1000; // 7 days
	static ENTITY_NAME = 'sports';
	
	constructor(id, name) {
		this.id = id;
		this.name = name;
	}
	
	static async get(id) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, id);
		const cachedSport = await cacheService.get(cacheKey);
		
		if (cachedSport) {
			return new Sports(cachedSport.id, cachedSport.name);
		}
		
		const result = await get(id);
		
		if (result) {
			const sport = new Sports(result.id, result.name);
			
			await cacheService.set(cacheKey, sport, this.CACHE_TTL);
			
			return sport;
		}
		
		return null;
	}
	
	static async add(name) {
		if (await this.exists(name)) {
			return this.getByName(name);
		}
		
		const result = await add(name);
		const sport = new Sports(result.id, result.name);
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, result.id);
		
		await cacheService.set(cacheKey, sport, this.CACHE_TTL);
		
		return sport;
	}
	
	static async exists(name) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, `name:${name}`);
		const cachedExists = await cacheService.get(cacheKey);
		
		if (cachedExists !== null) {
			return true;
		}
		
		const existsResult = await exists(name);
		
		if (existsResult){
			const sport = await this.getByName(name);
			
			if (sport) {
				const cacheKeyId = cacheService.generateKey(this.ENTITY_NAME, sport.id);
				
				await cacheService.set(cacheKeyId, sport, this.CACHE_TTL);
				await cacheService.set(cacheKey, sport, this.CACHE_TTL);
				
				return true;
			}
		}
		
		return existsResult;
	}
	
	static async getByName(name) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, `name:${name}`);
		const cachedSport = await cacheService.get(cacheKey);
		
		if (cachedSport) {
			return new Sports(cachedSport.id, cachedSport.name);
		}
		
		const result = await getByName(name);
		
		if (result) {
			const sport = new Sports(result.id, result.name);
			
			await cacheService.set(cacheKey, sport, this.CACHE_TTL);
			
			return sport;
		}
		
		return null;
	}
	
	static async getAll() {
		const cachedSports = await cacheService.getAll(this.ENTITY_NAME);
		
		if (cachedSports) {
			return cachedSports.map(sport => new Sports(sport.id, sport.name));
		}
		
		const results = await getAll();
		const sportsList = results.map(result => new Sports(result.id, result.name));
		const cachePromises = sportsList.map(sport => {
			const cacheKey = cacheService.generateKey(this.ENTITY_NAME, sport.id);
			
			return cacheService.set(cacheKey, sport, this.CACHE_TTL);
		});
		
		await Promise.all(cachePromises);
		
		return sportsList;
	}
}

module.exports = Sports;