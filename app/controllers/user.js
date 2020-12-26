const logger = require("../modules/log.js");
module.exports = function({ models, api }) {
	const User = models.use('user');

	async function createUser(uid) {
		if (!await User.findOne({ where: { uid } })) {
			let userInfo = await getInfo(uid);
			var name = userInfo.name;
			var inventory = {"fish1": 0,"fish2": 0,"trash": 0,"crabs": 0,"crocodiles": 0,"whales": 0,"dolphins": 0,"blowfish": 0,"squid": 0,"sharks": 0, "exp": 0, "rod": 0, "durability": 0};
			var stats = {"casts": 0, ...inventory};
			var [ user, created ] = await User.findOrCreate({ where : { uid }, defaults: { name, inventory, stats, reasonafk: '' }});
			if (created) {
				logger(`${name} - ${uid}`, 'New User');
				return true;
			}
			else return false;
		}
		else return;
	}

	async function getInfo(id) {
		return (await api.getUserInfo(id))[id];
	}

	async function setUser(uid, options = {}) {
		try {
			(await User.findOne({ where: { uid } })).update(options);
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function delUser(uid) {
		return (await User.findOne({ where: { uid } })).destroy();
	}

	async function getUsers(...data) {
		var where, attributes;
		for (let i of data) {
			if (typeof i != 'object') throw 'Phải là 1 Array hoặc Object hoặc cả 2.';
			if (Array.isArray(i)) attributes = i;
			else where = i;
		}
		try {
			return (await User.findAll({ where, attributes })).map(e => e.get({ plain: true }));
		}
		catch (err) {
			logger(err, 2);
			return [];
		}
	}

	async function getName(uid) {
		return (await User.findOne({ where: { uid } })).get({ plain: true }).name;
	}

	async function getGender(uid) {
		return (await getInfo(uid)).gender;
	}

	async function unban(uid, block = false) {
		try {
			await createUser(uid);
			(await User.findOne({ where: { uid } })).update({ block });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function ban(uid) {
		return await unban(uid, true);
	}

	async function nonafk(uid, afk = false) {
		try {
			(await User.findOne({ where: { uid } })).update({ afk });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function afk(uid) {
		return await nonafk(uid, true);
	}

	async function getReason(uid) {
		return (await User.findOne({ where: { uid } })).get({ plain: true }).reasonafk;
	}

	async function updateReason(uid, reasonafk) {
		try {
			(await User.findOne({ where: { uid } })).update({ reasonafk });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	return {
		createUser,
		getInfo,
		setUser,
		delUser,
		getUsers,
		getName,
		getGender,
		unban,
		ban,
		afk,
		nonafk,
		getReason,
		updateReason
	}
}