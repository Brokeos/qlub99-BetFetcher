const FlashScoreProvider = require("./providers/FlashScoreProvider");
const { MonitorManager, FlashScoreMonitor } = require("./monitors");
const { analyzeMatches } = require("./utils");
const Sport = require("./repository/sport.entity")
const League = require("./repository/league.entity");
const Participant = require("./repository/participant.entity");
const Match = require("./repository/match.entity");

async function processMatches(matches) {
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

async function performStaticFetch() {
	console.log('Starting static fetch...');
	
	const staticProvider = new FlashScoreProvider();
	
	try {
		await staticProvider.initialize();
		const matches = await staticProvider.fetchMatchs();
		
		console.log(`Static fetch completed with ${matches.length} matches`);
		
		await processMatches(matches);
		
		console.log('Static fetch processing completed');
	} catch (error) {
		console.error(`Error during static fetch: ${error.message}`);
	} finally {
		try {
			await staticProvider.cleanup();
		} catch (cleanupError) {
			console.error(`Error cleaning up static provider: ${cleanupError.message}`);
		}
	}
}

async function setupMonitoring(manager) {
	const provider = new FlashScoreProvider();
	provider.setMonitoring(true);
	
	const flashScoreMonitor = new FlashScoreMonitor(provider);
	manager.addMonitor(flashScoreMonitor);
	
	return { provider, flashScoreMonitor };
}

async function main() {
	const manager = new MonitorManager();
	let currentProvider = null;
	
	manager.on('monitorUpdate', async (monitor, updateData) => {
		try {
			console.log(`Processing ${updateData.changes.length} changes from monitor ${monitor.name}`);
			
			await processMatches(updateData.data);
			
			console.log(`Successfully processed update from monitor ${monitor.name}`);
		} catch (error) {
			console.error(`Error processing update from monitor ${monitor.name}: ${error.message}`);
		}
	});
	
	manager.on('monitorError', (monitor, error) => {
		console.error(`Monitor ${monitor.name} encountered error: ${error.message}`);
	});
	
	manager.on('monitorStarted', (monitor) => {
		console.log(`Monitor ${monitor.name} has started successfully`);
	});
	
	manager.on('monitorStopped', (monitor) => {
		console.log(`Monitor ${monitor.name} has stopped`);
	});
	
	const startMonitoring = async () => {
		try {
			console.log('Starting FlashScore monitoring system...');
			
			const { provider } = await setupMonitoring(manager);
			currentProvider = provider;
			
			await manager.startAll();
			
			console.log('FlashScore monitoring system started successfully');
		} catch (error) {
			console.error(`Failed to start monitoring system: ${error.message}`);
		}
	};
	
	const restartMonitoring = async () => {
		try {
			console.log('Restarting monitoring system...');
			
			await manager.stopAll();
			
			if (currentProvider) {
				await currentProvider.cleanup();
			}
			
			manager.getAllMonitors().forEach(monitor => {
				manager.removeMonitor(monitor.name);
			});
			
			await startMonitoring();
			
			console.log('Monitoring system restarted successfully');
		} catch (error) {
			console.error(`Error restarting monitoring system: ${error.message}`);
		}
	};
	
	try {
		console.log('Performing initial data fetch...');
		await performStaticFetch();
		
		await startMonitoring();
		
		console.log('Press Ctrl+C to stop monitoring');
		
		setInterval(() => {
			const status = manager.getStatus();
			console.log(`Monitor status: ${status.running}/${status.total} running`);
		}, 60000);
		
		setInterval(async () => {
			console.log('Performing hourly static fetch...');
			await performStaticFetch();
		},60 * 60 * 1000);
		
		setInterval(async () => {
			console.log('Performing 6-hour monitoring restart...');
			await restartMonitoring();
		},6 * 60 * 60 * 1000);
		
		console.log('Scheduled tasks configured:');
		console.log('- Static fetch: every 1 hour');
		console.log('- Monitoring restart: every 6 hours');
		
	} catch (error) {
		console.error(`Failed to start monitoring system: ${error.message}`);
		process.exit(1);
	}
}

main();