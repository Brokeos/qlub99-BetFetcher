const { get, add, exists, getByNameAndSport, getAll } = require('./league.database.js');
const cacheService = require('../services/cache.service.js');
const Sport = require('./sport.entity.js');

class League {
	static CACHE_TTL = 60 * 60 * 24 * 7 * 1000; // 7 days
	static ENTITY_NAME = 'leagues';

	constructor(id, name, sport_id) {
		this.id = id;
		this.name = name;
		this.sport_id = sport_id;
	}

	static async get(id) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, id);
		const cachedLeague = await cacheService.get(cacheKey);

		if (cachedLeague) {
			return new League(cachedLeague.id, cachedLeague.name, cachedLeague.sport_id);
		}

		const result = await get(id);

		if (result) {
			const league = new League(result.id, result.name, result.sport_id);
			await cacheService.set(cacheKey, league, this.CACHE_TTL);
			return league;
		}

		return null;
	}

	static async add(name, sport_name) {
		if (await this.exists(name, sport_name)) {
			return this.getByNameAndSport(name, sport_name);
		}
		
		const sport = await Sport.getByName(sport_name);
		
		if (!sport) {
			throw new Error(`Sport with name ${sport_name} does not exist.`);
		}
		
		const result = await add(name, sport.id);
		const league = new League(result.id, result.name, result.sport_id);
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, result.id);

		await cacheService.set(cacheKey, league, this.CACHE_TTL);
		return league;
	}

	static async exists(name, sport_name) {
		const sport = await Sport.getByName(sport_name);
		
		if (!sport) {
			throw new Error(`Sport with name ${sport_name} does not exist.`);
		}
		
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, `name-sport_id:${name}-${sport.id}`);
		const cachedExists = await cacheService.get(cacheKey);

		if (cachedExists !== null) {
			return true;
		}

		const existsResult = await exists(name, sport.id);
		
		if (existsResult) {
			const league = await this.getByNameAndSport(name, sport.name);
			
			if (league){
				const cacheKeyId = cacheService.generateKey(this.ENTITY_NAME, league.id);
				
				await cacheService.set(cacheKeyId, league, this.CACHE_TTL);
				await cacheService.set(cacheKey, league, this.CACHE_TTL);
				
				return true;
			}
		}
		
		return existsResult;
	}

	static async getByNameAndSport(name, sport_name) {
		const sport = await Sport.getByName(sport_name);
		
		if (!sport) {
			throw new Error(`Sport with name ${sport_name} does not exist.`);
		}
		
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, `name-sport_id:${name}-${sport.id}`);
		const cachedLeague = await cacheService.get(cacheKey);

		if (cachedLeague) {
			return new League(cachedLeague.id, cachedLeague.name, cachedLeague.sport_id);
		}

		const result = await getByNameAndSport(name, sport.id);

		if (result) {
			const league = new League(result.id, result.name, result.sport_id);
			
			await cacheService.set(cacheKey, league, this.CACHE_TTL);
			
			return league;
		}

		return null;
	}

	static async getAll() {
		const cachedLeagues = await cacheService.getAll(this.ENTITY_NAME);

		if (cachedLeagues) {
			return cachedLeagues.map(league => new League(league.id, league.name, league.sport_id));
		}

		const results = await getAll();
		const leaguesList = results.map(result => new League(result.id, result.name, result.sport_id));
		const cachePromises = leaguesList.map(league => {
			const cacheKey = cacheService.generateKey(this.ENTITY_NAME, league.id);
			
			return cacheService.set(cacheKey, league, this.CACHE_TTL);
		});
		
		await Promise.all(cachePromises);

		return leaguesList;
	}
}

module.exports = League;