const FlashScoreProvider = require("./providers/FlashScoreProvider");
const { analyzeMatches } = require("./utils");
const Sport = require("./repository/sport.entity")
const League = require("./repository/league.entity");
const Participant = require("./repository/participant.entity");

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
			
			console.log(sport);
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
			
			console.log(league);
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
			
			console.log(participant);
		})
	);
}

main();