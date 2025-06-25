const { database } = require('./config');

/*
CREATE TABLE IF NOT EXISTS sports (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_sports_name ON sports (name);
*/

async function get(id){
	const query = 'SELECT * FROM sports WHERE id = $1';
	const result = await database.query(query, [id]);
	
	return result.rows[0] || null;
}

async function add(name) {
	const query = 'INSERT INTO sports (name) VALUES ($1) RETURNING *';
	const result = await database.query(query, [name]);
	
	return result.rows[0];
}

async function exists(name) {
	const query = 'SELECT COUNT(*) FROM sports WHERE name LIKE $1';
	const result = await database.query(query, [name]);
	
	return result.rows[0].count > 0;
}

async function getByName(name) {
	const query = 'SELECT * FROM sports WHERE name = $1';
	const result = await database.query(query, [name]);
	
	return result.rows[0] || null;
}

async function getAll() {
	const query = 'SELECT * FROM sports ORDER BY name ASC';
	const result = await database.query(query);
	
	return result.rows;
}

module.exports = {
	get,
	add,
	exists,
	getByName,
	getAll
}