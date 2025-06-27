const FlashScoreProvider = require("./providers/FlashScoreProvider");
const { analyzeMatches } = require("./utils");
const Sport = require("./repository/sport.entity")
const League = require("./repository/league.entity");
const Participant = require("./repository/participant.entity");
const Match = require("./repository/match.entity");

async function main() {
	const provider = new FlashScoreProvider();
	
	await provider.initialize();
	
	const matches = await provider.fetchMatchs();
	const matchesData = analyzeMatches(matches);
	
	await Promise.all(
		matchesData.sports.map(async (sport) => {
			if (!(await Sport.exists(sport))) {
				sport = await Sport.add(sport);
				
				console.log(`New sport added: ${sport.name}`);
			} else {
				sport = await Sport.getByName(sport);
			}
		})
	);
	
	await Promise.all(
		matchesData.leagues.map(async (league) => {
			if (!(await League.exists(league.name, league.sport))) {
				league = await League.add(league.name, league.sport);
				
				console.log(`New league added: ${league.name}`);
			} else {
				league = await League.getByNameAndSport(league.name, league.sport);
			}
		})
	);
	
	await Promise.all(
		matchesData.participants.map(async (participant) => {
			if (!(await Participant.exists(participant))) {
				participant = await Participant.add(participant);
				
				console.log(`New participant added: ${participant.name}`);
			} else {
				participant = await Participant.getByName(participant);
			}
		})
	);
	
	await Promise.all(
		matches.map(async (match) => {
			if (!(await Match.exists(match.id))) {
				match = await Match.add(match.id, match.league, match.sport, match.date, match.homeParticipant, match.awayParticipant, match.homeScore, match.awayScore, match.status)
				
				console.log(`New match added: ${match.id}`);
			} else {
				const matchDatabase = await Match.get(match.id);
				
				if (match.homeScore !== matchDatabase.home_score ||
					match.awayScore !== matchDatabase.away_score ||
					match.status !== matchDatabase.status) {
					
					match = await Match.update(match.id, null, match.homeScore, match.awayScore, match.status);
					
					console.log(`Match updated: ${match.id}`);
				}
			}
		})
	)
}

main();