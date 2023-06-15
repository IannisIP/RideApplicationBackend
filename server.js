const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
var cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("./config");
const DBHelpers = require("./helpers");

require("events").EventEmitter.prototype._maxListeners = 100;

const pool = mysql.createPool({
	host: "localhost",
	port: "3306",
	user: "root",
	password: "admin",
	database: "rideapp",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const whitelist = ["http://localhost:8080"];
const corsOptions = {
	origin: function (origin, callback) {
		if (whitelist.indexOf(origin) !== -1 || origin === undefined) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS, origin: " + origin));
		}
	},
};

app.get("/", cors(corsOptions), (req, res, next) => {
	res.send("<h1>Ride App Backend</h1>");
});

app.post("/user", cors(corsOptions), async (req, res) => {
	try {
		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const user = {
			email: req.body.email,
			password: hashedPassword,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
		};
		const users = await DBHelpers.getAllUsers(pool);
		const exists = users.find((dbUser) => dbUser.email === user.email);
		res.contentType("application/json");

		if (exists) {
			res.status(500).send({ message: "User already exists", type: "error" });
			return;
		}

		const token = jwt.sign({ email: user.email }, config.secret, {
			expiresIn: 86400, // expires in 24 hours
		});

		await DBHelpers.addUser(pool, user);
		res
			.status(200)
			.send({ message: "User created", auth: true, token: token, user: user });
	} catch (err) {
		console.log(err);

		res.status(500).send();
	}
});

app.post("/user/login", cors(corsOptions), async (req, res) => {
	const email = req.body.email;
	const users = await DBHelpers.getAllUsers(pool);
	const user = users.find((dbUser) => dbUser.email === email);

	res.contentType("application/json");

	if (!user) {
		return res.status(400).send({ message: "Cannot find user", type: "error" });
	}
	try {
		const passwordIsValid = bcrypt.compareSync(
			req.body.password,
			user.password
		);
		if (passwordIsValid) {
			let token = jwt.sign({ email: user.email }, config.secret, {
				expiresIn: 86400, // expires in 24 hours
			});
			res
				.status(200)
				.send({ message: "Auth ok", auth: true, token: token, user: user });
		} else {
			res.status(401).send({
				message: "Username or password wrong",
				auth: false,
				token: null,
				type: "error",
			});
		}
	} catch (e) {
		res.status(500).send(e);
	}
});

app.post("/driver", cors(corsOptions), async (req, res) => {
	try {
		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const driver = {
			email: req.body.email,
			password: hashedPassword,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
		};
		const drivers = await DBHelpers.getAllDrivers(pool);
		const exists = drivers.find((dbDriver) => dbDriver.email === driver.email);
		res.contentType("application/json");

		if (exists) {
			res.status(500).send({ message: "Driver already exists", type: "error" });
			return;
		}

		const token = jwt.sign({ email: user.email }, config.secret, {
			expiresIn: 86400, // expires in 24 hours
		});

		await DBHelpers.addUser(pool, user);
		res
			.status(200)
			.send({ message: "User created", auth: true, token: token, user: user });
	} catch (err) {
		console.log(err);

		res.status(500).send();
	}
});

app.post("/driver/login", cors(corsOptions), async (req, res) => {
	const email = req.body.email;
	const drivers = await DBHelpers.getAllDrivers(pool);
	const driver = drivers.find((dbDriver) => dbDriver.email === email);

	res.contentType("application/json");

	if (!driver) {
		return res.status(400).send({ message: "Cannot find user", type: "error" });
	}
	try {
		const passwordIsValid = bcrypt.compareSync(
			req.body.password,
			user.password
		);
		if (passwordIsValid) {
			let token = jwt.sign({ email: user.email }, config.secret, {
				expiresIn: 86400, // expires in 24 hours
			});
			res
				.status(200)
				.send({ message: "Auth ok", auth: true, token: token, user: user });
		} else {
			res.status(401).send({
				message: "Username or password wrong",
				auth: false,
				token: null,
				type: "error",
			});
		}
	} catch (e) {
		res.status(500).send(e);
	}
});

const validateUser = async (token) => {
	if (!token) return { auth: false, message: "No token provided." };

	return await new Promise((resolve) => {
		jwt.verify(token, config.secret, async (err, userInfo) => {
			if (err)
				return resolve({
					auth: false,
					message: "Failed to authenticate token.",
				});

			const users = await DBHelpers.getAllUsers(pool);
			const user = users.find((user) => user.email === userInfo.email);

			resolve(user);
		});
	});
};

const validJWTNeeded = (req, res, next) => {
	if (req.headers["x-access-token"]) {
		try {
			let authorization = req.headers["x-access-token"];
			req.jwt = jwt.verify(authorization, config.secret);

			return next();
		} catch (err) {
			return res.status(403).send({
				message: "Forbidden: Authentication token expired or non existent",
				type: "error",
			});
		}
	} else {
		return res.status(401).send();
	}
};

app.get("/user-info", async (req, res) => {
	const token = req.headers["x-access-token"];
	const results = await validateUser(token);

	if (results.message === "No token provided.") {
		return res.status(401).send(results);
	} else if (results.message === "Failed to authenticate token.") {
		return res.status(500).send(results);
	}

	res.status(200).send(results);
});

// Create a new ride
app.post("/rides", cors(corsOptions), validJWTNeeded, (req, res) => {
	const {
		user_id,
		driver_id,
		pickup_location,
		dropoff_location,
		ride_datetime,
		ride_status,
		ride_type,
		vehicle_type,
		payment_type,
		payment_amount,
	} = req.body;

	const newRide = {
		user_id,
		driver_id,
		pickup_location,
		dropoff_location,
		ride_datetime,
		ride_status,
		ride_type,
		vehicle_type,
		payment_type,
		payment_amount,
	};

	pool.query("INSERT INTO ride SET ?", newRide, (err, result) => {
		if (err) {
			res.status(500).json({ error: "Failed to create ride" });
		} else {
			res.status(201).json({ message: "Ride created successfully" });
		}
	});
});

// Get all rides
app.get("/rides", cors(corsOptions), validJWTNeeded, (req, res) => {
	pool.query("SELECT * FROM ride", (err, result) => {
		if (err) {
			res.status(500).json({ error: "Failed to fetch rides" });
		} else {
			res.status(200).json(result);
		}
	});
});

// Get a specific ride by ID
app.get("/rides/:id", cors(corsOptions), validJWTNeeded, (req, res) => {
	const rideId = req.params.id;

	pool.query("SELECT * FROM ride WHERE id = ?", rideId, (err, result) => {
		if (err) {
			res.status(500).json({ error: "Failed to fetch ride" });
		} else if (result.length === 0) {
			res.status(404).json({ error: "Ride not found" });
		} else {
			res.status(200).json(result[0]);
		}
	});
});

// Update a ride
app.put("/rides/:id", cors(corsOptions), validJWTNeeded, (req, res) => {
	const rideId = req.params.id;
	const {
		user_id,
		driver_id,
		pickup_location,
		dropoff_location,
		ride_datetime,
		ride_status,
		ride_type,
		vehicle_type,
		payment_type,
		payment_amount,
	} = req.body;

	const updatedRide = {
		user_id,
		driver_id,
		pickup_location,
		dropoff_location,
		ride_datetime,
		ride_status,
		ride_type,
		vehicle_type,
		payment_type,
		payment_amount,
	};

	pool.query(
		"UPDATE ride SET ? WHERE id = ?",
		[updatedRide, rideId],
		(err, result) => {
			if (err) {
				res.status(500).json({ error: "Failed to update ride" });
			} else if (result.affectedRows === 0) {
				res.status(404).json({ error: "Ride not found" });
			} else {
				res.status(200).json({ message: "Ride updated successfully" });
			}
		}
	);
});

// Delete a ride
app.delete("/rides/:id", cors(corsOptions), validJWTNeeded, (req, res) => {
	const rideId = req.params.id;

	pool.query("DELETE FROM ride WHERE id = ?", rideId, (err, result) => {
		if (err) {
			res.status(500).json({ error: "Failed to delete ride" });
		} else if (result.affectedRows === 0) {
			res.status(404).json({ error: "Ride not found" });
		} else {
			res.status(200).json({ message: "Ride deleted successfully" });
		}
	});
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
