function analyzeMatches(matches) {
	const leagues = new Map();
	const sports = new Set();
	const participants = new Set();
	
	matches.forEach(match => {
		if (match.league && match.sport) {
			const key = `${match.sport}-${match.league}`;
			leagues.set(key, { name: match.league, sport: match.sport });
		}
		if (match.sport) sports.add(match.sport);
		if (match.homeParticipant) participants.add(match.homeParticipant);
		if (match.awayParticipant) participants.add(match.awayParticipant);
	});
	
	return {
		leagues: Array.from(leagues.values()),
		sports: Array.from(sports),
		participants: Array.from(participants)
	};
}

module.exports = {
	analyzeMatches
};