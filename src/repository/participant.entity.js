const { get, add, exists, getAll, getByName} = require('./participant.database');
const cacheService = require('../services/cache.service');

class Participant {
	static CACHE_TTL = 60 * 60 * 24 * 7 * 1000; // 7 days
	static ENTITY_NAME = 'participant';
	
	constructor(id, name) {
		this.id = id;
		this.name = name;
	}
	
	static async get(id) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, id);
		const cachedParticipant = await cacheService.get(cacheKey);
		
		if (cachedParticipant) {
			return new Participant(cachedParticipant.id, cachedParticipant.name);
		}
		
		const result = await get(id);
		
		if (result) {
			const sport = new Participant(result.id, result.name);
			
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
		const participant = new Participant(result.id, result.name);
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, result.id);
		
		await cacheService.set(cacheKey, participant, this.CACHE_TTL);
		
		return participant;
	}
	
	static async exists(name) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, `name:${name}`);
		const cachedExists = await cacheService.get(cacheKey);
		
		if (cachedExists !== null) {
			return true;
		}
		
		const existsResult = await exists(name);
		
		if (existsResult){
			const participant = await this.getByName(name);
			
			if (participant) {
				const cacheKeyId = cacheService.generateKey(this.ENTITY_NAME, participant.id);
				
				await cacheService.set(cacheKeyId, participant, this.CACHE_TTL);
				await cacheService.set(cacheKey, participant, this.CACHE_TTL);
				
				return true;
			}
		}
		
		return existsResult;
	}
	
	static async getByName(name) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, `name:${name}`);
		const cachedParticipant = await cacheService.get(cacheKey);
		
		if (cachedParticipant) {
			return new Participant(cachedParticipant.id, cachedParticipant.name);
		}
		
		const result = await getByName(name);
		
		if (result) {
			const participant = new Participant(result.id, result.name);
			
			await cacheService.set(cacheKey, participant, this.CACHE_TTL);
			
			return participant;
		}
		
		return null;
	}
	
	static async getAll() {
		const cachedParticipants = await cacheService.getAll(this.ENTITY_NAME);
		
		if (cachedParticipants) {
			return cachedParticipants.map(sport => new Participant(sport.id, sport.name));
		}
		
		const results = await getAll();
		const participantsList = results.map(result => new Participant(result.id, result.name));
		const cachePromises = participantsList.map(participant => {
			const cacheKey = cacheService.generateKey(this.ENTITY_NAME, participant.id);
			
			return cacheService.set(cacheKey, participant, this.CACHE_TTL);
		});
		
		await Promise.all(cachePromises);
		
		return participantsList;
	}
}

module.exports = Participant;