const Pool = require("pg").Pool;
const redis = require("redis");
const dotenv = require("dotenv")

dotenv.config();

const pool = new Pool({
	user: process.env.PG_USERNAME,
	password: process.env.PG_PASSWORD,
	host: process.env.PG_HOSTNAME,
	database: process.env.PG_DATABASE,
	port: process.env.PG_PORT,
});

const redisClient = redis.createClient({
	socket: {
		host: process.env.REDIS_HOSTNAME,
		port: process.env.REDIS_PORT,
	},
});

(async () => {
	await redisClient.connect();
})();

module.exports = {
	database: pool,
	redis: redisClient
};