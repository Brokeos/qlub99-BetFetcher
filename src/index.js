const FlashScoreProvider = require("./providers/FlashScoreProvider");
const { analyzeMatches } = require("./utils");
const Sports = require("./repository/sports.entity")
const Leagues = require("./repository/leagues.entity");

async function main() {
	/*const provider = new FlashScoreProvider();
	
	await provider.initialize();
	
	const matches = await provider.fetchMatchs();
	const matchesData = analyzeMatches(matches);*/
	
	const matchesData = {
		sports: ["Football", "Basketball", "Tennis"],
		leagues: [{
			"name": "Wimbledon", "sport": "Tennis",
		}]
	}
	
	await Promise.all(
		matchesData.sports.map(async (sport) => {
			if (!(await Sports.exists(sport))) {
				sport = await Sports.add(sport);
				
				console.log(`New sport added: ${sport.name}`);
			} else {
				sport = await Sports.getByName(sport);
			}
			
			console.log(sport);
		})
	);
	
	await Promise.all(
		matchesData.leagues.map(async (league) => {
			if (!(await Leagues.exists(league.name, league.sport))) {
				league = await Leagues.add(league.name, league.sport);
				
				console.log(`New league added: ${league.name}`);
			} else {
				league = await Leagues.getByNameAndSport(league.name, league.sport);
			}
			
			console.log(league);
		})
	)
}

main();