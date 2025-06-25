const { database } = require('./config');

/*
CREATE TABLE IF NOT EXISTS participants (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_participants_name ON participants (name);
*/

async function get(id){
	const query = 'SELECT * FROM participants WHERE id = $1';
	const result = await database.query(query, [id]);
	
	return result.rows[0] || null;
}

async function add(name) {
	const query = 'INSERT INTO participants (name) VALUES ($1) RETURNING *';
	const result = await database.query(query, [name]);
	
	return result.rows[0];
}

async function exists(name) {
	const query = 'SELECT COUNT(*) FROM participants WHERE name LIKE $1';
	const result = await database.query(query, [name]);
	
	return result.rowCount > 0;
}

async function getByName(name) {
	const query = 'SELECT * FROM participants WHERE name = $1';
	const result = await database.query(query, [name]);
	
	return result.rows[0] || null;
}

async function getAll() {
	const query = 'SELECT * FROM participants ORDER BY name ASC';
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