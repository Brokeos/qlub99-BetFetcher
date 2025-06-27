const { database } = require('./config');

/*
CREATE TABLE IF NOT EXISTS matches (
	id VARCHAR(20) PRIMARY KEY,
	league_id INT NOT NULL,
	match_date TIMESTAMP DEFAULT NULL,
	home_participant_id INT NOT NULL,
	away_participant_id INT NOT NULL,
	home_score INT DEFAULT NULL,
	away_score INT DEFAULT NULL,
	status VARCHAR(20) DEFAULT 'scheduled',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE matches
ADD CONSTRAINT fk_league
FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE matches
ADD CONSTRAINT fk_home_participant
FOREIGN KEY (home_participant_id) REFERENCES participants(id) ON DELETE CASCADE;

ALTER TABLE matches
ADD CONSTRAINT fk_away_participant
FOREIGN KEY (away_participant_id) REFERENCES participants(id) ON DELETE CASCADE;
*/

async function get(id){
	const query = 'SELECT * FROM matches WHERE id = $1';
	const result = await database.query(query, [id]);
	
	return result.rows[0] || null;
}

async function add(id, league_id, match_date, home_participant_id, away_participant_id, home_score, away_score, status) {
	const query = `
		INSERT INTO matches (id, league_id, match_date, home_participant_id, away_participant_id, home_score, away_score, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING *`;
	const values = [id, league_id, match_date, home_participant_id, away_participant_id, home_score, away_score, status];
	const result = await database.query(query, values);
	
	return result.rows[0];
}

async function exists(id) {
	const query = 'SELECT COUNT(*) FROM matches WHERE id = $1';
	const result = await database.query(query, [id]);
	
	return result.rows[0].count > 0;
}

async function update(id, updates = {}) {
	const allowedFields = {
		match_date: 'match_date',
		home_score: 'home_score',
		away_score: 'away_score',
		status: 'status'
	};
	
	const fieldsToUpdate = Object.keys(updates).filter(key =>
		allowedFields[key] && updates[key] !== undefined
	);
	
	if (fieldsToUpdate.length === 0) {
		throw new Error('No valid fields to update');
	}
	
	const setClause = fieldsToUpdate
		.map((field, index) => `${allowedFields[field]} = $${index + 2}`)
		.join(', ');
	const query = `
    UPDATE matches
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *`;
	const values = [id, ...fieldsToUpdate.map(field => updates[field])];
	const result = await database.query(query, values);
	
	return result.rows[0];
}

async function getAll() {
	const query = 'SELECT * FROM matches ORDER BY match_date DESC';
	const result = await database.query(query);
	
	return result.rows;
}

async function getTodayMatches() {
	const query = `
		SELECT m.*, l.name as league_name, s.name as sport_name
		FROM matches m
		JOIN leagues l ON m.league_id = l.id
		JOIN sports s ON l.sport_id = s.id
		WHERE DATE(m.match_date) = CURRENT_DATE
		ORDER BY m.match_date ASC`;
	const result = await database.query(query);
	
	return result.rows;
}

async function getLeaguesWithTodayMatches() {
	const query = `
		SELECT DISTINCT l.id, l.name, s.name as sport_name
		FROM matches m
		JOIN leagues l ON m.league_id = l.id
		JOIN sports s ON l.sport_id = s.id
		WHERE DATE(m.match_date) = CURRENT_DATE`;
	const result = await database.query(query);
	
	return result.rows;
}

module.exports = {
	get,
	add,
	exists,
	update,
	getAll,
	getTodayMatches,
	getLeaguesWithTodayMatches
}