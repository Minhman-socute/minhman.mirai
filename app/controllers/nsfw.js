const logger = require("../modules/log.js");
module.exports = function({ models, Economy }) {
	const Nsfw = models.use("user");

	/* ==================== NSFW ==================== */
	
	async function getNSFW(uid) {
		return (await Nsfw.findOne({ where: { uid } })).get({ plain: true }).nsfwTier;
	}

	async function setNSFW(uid, nsfwTier) {
		try {
			let nsfw = await Nsfw.findOne({ where: { uid } });
			if (nsfwTier == 0) return nsfw.update({ nsfwTier, hentaiLeft: 2, pornLeft: 1 });
			else if (nsfwTier == 1) return nsfw.update({ nsfwTier, hentaiLeft: 4, pornLeft: 2 });
			else if (nsfwTier == 2) return nsfw.update({ nsfwTier, hentaiLeft: 8, pornLeft: 4 });
			else if (nsfwTier == 3) return nsfw.update({ nsfwTier, hentaiLeft: 12, pornLeft: 6 });
			else if (nsfwTier == 4) return nsfw.update({ nsfwTier, hentaiLeft: 16, pornLeft: 8 });
			else if (nsfwTier == 5) return nsfw.update({ nsfwTier, hentaiLeft: -1, pornLeft: 10 });
			else if (nsfwTier == -1) return nsfw.update({ nsfwTier, hentaiLeft: -1, pornLeft: -1 }); //God Mode
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function buyNSFW(uid) {
		let myTier = await getNSFW(uid);
		var money = await Economy.getMoney(uid);
		if (myTier == 5) return 'Không thể mua thêm vì bạn đã ở Hạng 5';
		const price = [2000, 6000, 10000, 14000, 20000];
		const tier = [1, 2, 3, 4, 5];
		var needPrice = price[tier.indexOf(myTier + 1)];
		if (money < needPrice) return 'Làm chưa mà đòi ăn? Vẫn còn thiếu ' + (needPrice - money) + ' đô kìa.';
		else {
			var getReturn = await Economy.subtractMoney(uid, needPrice);
			if (getReturn == true) {
				setNSFW(uid, myTier + 1);
				return 'Đã làm thì phải có ăn! Mua thành công Hạng ' + (myTier + 1) + '!';
			}
		}
	}

	async function pornUseLeft(uid) {
		return (await Nsfw.findOne({ where: { uid } })).get({ plain: true }).pornLeft;
	}

	async function hentaiUseLeft(uid) {
		return (await Nsfw.findOne({ where: { uid } })).get({ plain: true }).hentaiLeft;
	}

	async function subtractHentai(uid) {
		try {
			var useLeft = await hentaiUseLeft(uid);
			return (await Nsfw.findOne({ where: { uid } })).update({ hentaiLeft: useLeft - 1 });
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	async function subtractPorn(uid) {
		try {
			var useLeft = await pornUseLeft(uid);
			return (await Nsfw.findOne({ where: { uid } })).update({ pornLeft: useLeft - 1 });
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	function resetNSFW() {
		try {
			Nsfw.update({ hentaiLeft: 2, pornLeft: 1 }, { where: { nsfwTier: 0 } });
			Nsfw.update({ hentaiLeft: 4, pornLeft: 2 }, { where: { nsfwTier: 1 } });
			Nsfw.update({ hentaiLeft: 8, pornLeft: 4 }, { where: { nsfwTier: 2 } });
			Nsfw.update({ hentaiLeft: 12, pornLeft: 6 },  {where: { nsfwTier: 3 } });
			Nsfw.update({ hentaiLeft: 16, pornLeft: 8 }, { where: { nsfwTier: 4 } });
			Nsfw.update({ hentaiLeft: -1, pornLeft: 10 }, { where: { nsfwTier: 5 } });
			return true;
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	return {
		getNSFW,
		buyNSFW,
		setNSFW,
		pornUseLeft,
		hentaiUseLeft,
		subtractPorn,
		subtractHentai,
		resetNSFW
	};
};
