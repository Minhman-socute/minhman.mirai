module.exports = function({ api, config, __GLOBAL, User, Thread, Economy, Fishing, Nsfw }) {
	return async function({ event }) {
		const { confirm } = __GLOBAL;
		if (__GLOBAL.threadBlocked.indexOf(event.threadID) != -1) return;
		const { senderID, userID, threadID, reaction, messageID } = event;
		if (confirm.length != 0) {
			const indexOfConfirm = confirm.findIndex(e => e.messageID == messageID && e.author == userID);
			if (indexOfConfirm < 0) return;
			const confirmMessage = confirm[indexOfConfirm];
			switch (confirmMessage.type) {
				case 'fishing_sellAll': {
					if (reaction == '👍') {
						let inventory = await Fishing.getInventory(confirmMessage.author);
						var money = parseInt(inventory.trash + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfish * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squid * 1000 + inventory.sharks * 1000);
						inventory.trash = 0;
						inventory.fish1 = 0;
						inventory.fish2 = 0;
						inventory.crabs = 0;
						inventory.crocodiles = 0;
						inventory.whales = 0;
						inventory.dolphins = 0;
						inventory.blowfish = 0;
						inventory.squid = 0;
						inventory.sharks = 0;
						api.sendMessage('🎣 | Bạn đã bán toàn bộ sản lượng trong túi và thu về được ' + money + ' đô', threadID, messageID);
						await Fishing.updateInventory(confirmMessage.author, inventory);
						await Economy.addMoney(confirmMessage.author, money);
					}
					else api.sendMessage('🎣 | Rất tiếc, bạn đã huỷ giao dịch này', threadID, messageID)
					break;
				}
				case "fishing_upgradeRod": {
					if (reaction !== '👍') return api.sendMessage(`🎣 | Rất tiếc, bạn đã huỷ buổi nâng cấp này`, threadID);
					let inventory = await Fishing.getInventory(confirmMessage.author);
					let moneydb = await Economy.getMoney(confirmMessage.author);
					if (moneydb - confirmMessage.money <= 0) return api.sendMessage(`Bạn chưa đủ điều kiện, bạn còn thiếu ${confirmMessage.money - moneydb} đô để nâng cấp`, threadID);
					if (inventory.exp - confirmMessage.exp <= 0) return api.sendMessage(`Bạn chưa đủ điều kiện, bạn còn thiếu ${confirmMessage.exp - inventory.exp} exp để nâng cấp`, threadID);
					if (inventory.rod <= 0) return api.sendMessage(`Bạn chưa có cần câu để nâng cấp, hãy mua cần câu mới tại shop!`, threadID);
					if (inventory.rod == 5) return api.sendMessage(`Cần câu của bạn đã được nâng cấp tối đa từ trước!`, threadID);
					inventory.rod += 1;
					inventory.exp -= confirmMessage.exp;
					inventory.durability = confirmMessage.durability;
					api.sendMessage(`Đã nâng cấp cần câu của bạn thành công!`, threadID);
					await Economy.subtractMoney(confirmMessage.author, confirmMessage.money);
					await Fishing.updateInventory(confirmMessage.author, inventory);
					break;
				}
				case "fishing_fixRod": {
					if (reaction !== '👍') return api.sendMessage(`🎣 | Rất tiếc, bạn đã huỷ buổi sửa chữa này`, threadID);
					let moneydb = await Economy.getMoney(confirmMessage.author);
					if (moneydb - confirmMessage.moneyToFix <= 0) return api.sendMessage(`Bạn không đủ điều kiện để sửa chữa, bạn còn thiếu ${confirmMessage.moneyToFix - moneydb} đô nữa`, threadID);
					let inventory = await Fishing.getInventory(confirmMessage.author);
					inventory.durability = confirmMessage.durability;
					api.sendMessage(`Đã sửa cần câu của bạn thành công!!`, threadID);
					await Economy.subtractMoney(confirmMessage.author, confirmMessage.moneyToFix);
					await Fishing.updateInventory(confirmMessage.author, inventory);
					break;
				}
				case "fishing_buyRod": {
					if (reaction !== '👍') return api.sendMessage(`🎣 | Rất tiếc, bạn đã huỷ cuộc mua bán này`, threadID);
					let moneydb = await Economy.getMoney(confirmMessage.author);
					let inventory = await Fishing.getInventory(confirmMessage.author);
					if (inventory.rod >= 1) return api.sendMessage(`Bạn đã có cần câu từ trước!`, threadID);
					if (moneydb - 1000 < 0) return api.sendMessage(`Bạn không đủ điều kiện để mua, bạn còn thiếu ${1000 - moneydb} đô nữa`, threadID);
					inventory.durability = 50;
					inventory.rod = 1;
					api.sendMessage(`Bạn đã mua thành công một cây cần câu mới, đây là bước khởi đầu trên con đường trở thành người câu cá giỏi nhất tại nơi đây!\nGood Luck <3`, threadID);
					await Economy.subtractMoney(confirmMessage.author, 1000);
					await Fishing.updateInventory(confirmMessage.author, inventory);
					break;
				}
			}
			__GLOBAL.confirm.splice(indexOfConfirm, 1);
			return;
		}
	}
}