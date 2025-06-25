const { get, add, exists, update, getAll } = require('./match.database');
const cacheService = require('../services/cache.service.js');
const League = require('./league.entity.js');

class Match {
	static CACHE_TTL = 60 * 60 * 24 * 7 * 1000; // 7 days
	static ENTITY_NAME = 'match';

	constructor(id, league_id, match_date, home_participant_id, away_participant_id, home_score, away_score, status) {
		this.id = id;
		this.league_id = league_id;
		this.match_date = match_date;
		this.home_participant_id = home_participant_id;
		this.away_participant_id = away_participant_id;
		this.home_score = home_score;
		this.away_score = away_score;
		this.status = status;
	}
	
	static async get(id){
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, id);
		const cachedMatch = await cacheService.get(cacheKey);
		
		if (cachedMatch) {
			return new Match(
				cachedMatch.id,
				cachedMatch.league_id,
				cachedMatch.match_date,
				cachedMatch.home_participant_id,
				cachedMatch.away_participant_id,
				cachedMatch.home_score,
				cachedMatch.away_score,
				cachedMatch.status
			);
		}
		
		const result = await get(id);
		
		if (result) {
			const match = new Match(
				result.id,
				result.league_id,
				result.match_date,
				result.home_participant_id,
				result.away_participant_id,
				result.home_score,
				result.away_score,
				result.status
			);
			
			await cacheService.set(cacheKey, match, this.CACHE_TTL);
			
			return match;
		}
		
		return null;
	}
	
	static async add(id, league_name, sport_name, match_date, home_participant_id, away_participant_id, home_score, away_score, status) {
		if (await this.exists(id)){
			return await this.update(id, match_date, home_score, away_score, status);
		}
		
		const league = await League.getByNameAndSport(league_name, sport_name);
		
		if (!league) {
			throw new Error(`League ${league_name} for sport ${sport_name} does not exist.`);
		}
		
		const result = await add(id, league.id, match_date, home_participant_id, away_participant_id, home_score, away_score, status);
		const match = new Match(
			result.id,
			result.league_id,
			result.match_date,
			result.home_participant_id,
			result.away_participant_id,
			result.home_score,
			result.away_score,
			result.status
		);
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, id);
		
		await cacheService.set(cacheKey, match, this.CACHE_TTL);
		
		return match;
	}
	
	static async exists(id) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, id);
		const cachedExists = await cacheService.get(cacheKey);
		
		if (cachedExists !== null) {
			return cachedExists;
		}
		
		const existsResult = await exists(id);
		
		if (existsResult) {
			const match = await get(id);
			
			if (match) {
				await cacheService.set(cacheKey, true, this.CACHE_TTL);
				
				return true;
			}
		}
		
		return existsResult;
	}
	
	async static update(id, match_date, home_score, away_score, status) {
		const cacheKey = cacheService.generateKey(this.ENTITY_NAME, id);
		const match = await Match.get(id);
		
		if (!match) {
			throw new Error(`Match with ID ${id} does not exist.`);
		}
		
		if (match.match_date !== null){
			match_date = match.match_date;
		}
		
		const result = await update(id, {
			'match_date': match_date,
			'home_score': home_score,
			'away_score': away_score,
			'status': status
		});
		
		if (result) {
			const updatedMatch = new Match(
				result.id,
				result.league_id,
				result.match_date,
				result.home_participant_id,
				result.away_participant_id,
				result.home_score,
				result.away_score,
				result.status
			);
			
			await cacheService.set(cacheKey, updatedMatch, this.CACHE_TTL);
			
			return updatedMatch;
		}
		
		return null;
	}
}

module.exports = Match;