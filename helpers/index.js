const getAllUsers = async (pool) => {
	const result = await pool.query("SELECT * from user");
	return result[0];
};

const getUserById = async (pool, userId) => {
	const result = await pool.query("SELECT * from user where id = ?", [userId]);
	return result[0];
};

const addUser = async (pool, { email, password, firstName, lastName }) => {
	const result = await pool.query("INSERT INTO user SET ?", {
		email,
		password,
		first_name: firstName,
		last_name: lastName,
	});
	return result;
};

const getAllDrivers = async (pool) => {
	const result = await pool.query("SELECT * from driver");
	return result[0];
};

const getDriverById = async (pool, userId) => {
	const result = await pool.query("SELECT * from driver where id = ?", [
		userId,
	]);
	return result[0];
};

const addDriver = async (pool, { email, password, firstName, lastName }) => {
	const result = await pool.query("INSERT INTO driver SET ?", {
		email,
		password,
		first_name: firstName,
		last_name: lastName,
	});
	return result;
};

module.exports = {
	addUser,
	getUserById,
	getAllUsers,
	getAllDrivers,
	getDriverById,
	addDriver,
};
