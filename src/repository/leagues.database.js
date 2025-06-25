const { database } = require('./config');

/*
CREATE TABLE IF NOT EXISTS leagues (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	sport_id INT NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE leagues
ADD CONSTRAINT fk_sport
FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX idx_league_name_sport ON leagues (name, sport_id);
*/

async function get(id) {
	const query = `SELECT * FROM leagues WHERE id = $1`;
	const result = await database.query(query, [id]);
		
	return result.rows[0] || null;
}

async function add(name, sport_id) {
	const query = `INSERT INTO leagues (name, sport_id) VALUES ($1, $2) RETURNING *`;
	const result = await database.query(query, [name, sport_id]);
	
	return result.rows[0];
}

async function exists(name, sport_id) {
	const query = `SELECT 1 FROM leagues WHERE name = $1 AND sport_id = $2`;
	const result = await database.query(query, [name, sport_id]);
	
	return result.rowCount > 0;
}

async function getByNameAndSport(name, sport_id) {
	const query = `SELECT * FROM leagues WHERE name = $1 AND sport_id = $2`;
	const result = await database.query(query, [name, sport_id]);
	
	return result.rows[0] || null;
}

async function getAll(){
	const query = 'SELECT * FROM leagues ORDER BY name ASC';
	const result = await database.query(query);
	
	return result.rows;
}

module.exports = {
	get,
	add,
	exists,
	getByNameAndSport,
	getAll
}