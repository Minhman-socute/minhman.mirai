const fs = require("fs-extra");
function writeENV(tag, input) {
	return fs.readFile('./.env', { encoding: 'utf-8' }, function(err, data) {
		if (err) throw err;
		data = data.split('\n');
		let lastIndex = -1;
		for (let i = 0; i < data.length; i++) {
			if (data[i].includes(`${tag}=`)) {
				lastIndex = i;
				break;
			}
		}
		data[lastIndex] = `${tag}=${input}`;
		const dataJoin = data.join('\n');
		fs.writeFileSync('./.env', dataJoin);
	});
}

module.exports = function({ api, config, __GLOBAL, User, Thread, Economy, Fishing, Nsfw }) {
	return async function({ event }) {
		const cmd = require("node-cmd");
		const axios = require('axios');
		const { reply } = __GLOBAL;
		const restart = (process.env.API_SERVER_EXTERNAL == 'https://api.glitch.com') ? "refresh" : "pm2 restart 0";
		if (__GLOBAL.threadBlocked.indexOf(event.threadID) != -1) return;
		const { senderID, threadID, body, messageID } = event;
		if (reply.length != 0) {
			if (!event.messageReply) return;
			const indexOfReply = reply.findIndex(e => e.messageID == event.messageReply.messageID && e.author == senderID);
			if (indexOfReply < 0) return;
			const replyMessage = reply[indexOfReply];
			switch (replyMessage.type) {
				case "admin_settings": {
					if (body == '1') {
						api.sendMessage(`Prefix hiện tại của bot là: ${config.prefix}\n=== Để đổi bạn hãy reply đoạn tin nhắn này với prefix bạn muốn đổi thành ===`, threadID, (err, info) => {
							if (err) throw err;
							__GLOBAL.reply.push({
								type: "admin_prefix",
								messageID: info.messageID,
								target: parseInt(threadID),
								author: senderID
							});
						});
					}
					else if (body == '2') {
						api.sendMessage(`Tên hiện tại của bot là: ${config.botName}\n=== Để đổi bạn hãy reply đoạn tin nhắn này với tên bạn muốn đổi thành ===`, threadID, (err, info) => {
							if (err) throw err;
							__GLOBAL.reply.push({
								type: "admin_setName",
								messageID: info.messageID,
								target: parseInt(threadID),
								author: senderID
							});
						});
					}
					else if (body == '3') {
						let admins = '';
						for (let i of config.admins) await User.createUser(i);
						let users = await User.getUsers(['name', 'uid']);
						for (let j of users) if (config.admins.includes(j.uid)) admins += `\n- ${j.name}`;
						api.sendMessage(`Admins hiện tại của bot là:${admins}\n=== Để đổi bạn hãy reply đoạn tin nhắn này với uid (hoặc uid1_uid2_...) bạn muốn đổi thành ===`, threadID, (err, info) => {
							if (err) throw err;
							__GLOBAL.reply.push({
								type: "admin_setAdmins",
								messageID: info.messageID,
								target: parseInt(threadID),
								author: senderID
							});
						});
					}
					else if (body == '4') {
						api.sendMessage(`Tự khởi động lại bot hiện tại đang là: ${process.env.REFRESHING}\n=== Để đổi bạn hãy reply đoạn tin nhắn này kèm với on hay off ===`, threadID, (err, info) => {
							if (err) throw err;
							__GLOBAL.reply.push({
								type: "admin_setRefresh",
								messageID: info.messageID,
								target: parseInt(threadID),
								author: senderID
							});
						});
					}
					else if (body == '6') {
						const semver = require('semver');
						axios.get('https://raw.githubusercontent.com/roxtigger2003/mirai/master/package.json').then((res) => {
							var local = JSON.parse(fs.readFileSync('./package.json')).version;
							if (semver.lt(local, res.data.version)) {
								api.sendMessage('Đã có bản cập nhật mới! Hãy bật terminal/cmd và gõ "node update" để cập nhật!', threadID);
								fs.writeFileSync('./.updateAvailable', '');
							}
							else api.sendMessage('Bạn đang sử dụng bản mới nhất!', threadID);
						}).catch(err => api.sendMessage('Không thể kiểm tra cập nhật!', threadID));
					}
					else if (body == '7') {
						var data = await User.getUsers(['name', 'uid'], {block: true});
						var userBlockMsg = "";
						data.forEach(user => userBlockMsg += `\n${user.name} - ${user.uid}`);
						api.sendMessage((userBlockMsg) ? `🛠 | Đây là danh sách các user bị ban:${userBlockMsg}` : 'Chưa có user nào bị bạn cấm!', threadID, messageID);
					}
					else if (body == '8') {
						var data = await Thread.getThreads(['name', 'threadID'], {block: true});
						var threadBlockMsg = "";
						data.forEach(thread => threadBlockMsg += `\n${thread.name} - ${thread.threadID}`);
						api.sendMessage((threadBlockMsg) ? `🛠 | Đây là danh sách các nhóm bị ban:${threadBlockMsg}` : 'Chưa có nhóm nào bị bạn cấm!', threadID, messageID);
					}
					else if (body == '9') {
						api.sendMessage(`Nhập thông báo bạn muốn gửi cho toàn bộ`, threadID, (err, info) => {
							if (err) throw err;
							__GLOBAL.reply.push({
								type: "admin_noti",
								messageID: info.messageID,
								target: parseInt(threadID),
								author: senderID
							});
						});
					}
					else if (body == '10') {
						api.sendMessage(`Nhập tên user cần tìm kiếm`, threadID, (err, info) => {
							if (err) throw err;
							__GLOBAL.reply.push({
								type: "admin_searchUser",
								messageID: info.messageID,
								target: parseInt(threadID),
								author: senderID
							});
						});
					}
					else if (body == '11') {
						api.sendMessage(`Nhập tên nhóm cần tìm kiếm`, threadID, (err, info) => {
							if (err) throw err;
							__GLOBAL.reply.push({
								type: "admin_searchThread",
								messageID: info.messageID,
								target: parseInt(threadID),
								author: senderID
							});
						});
					}
					else if (body == '12') api.sendMessage(`Tiến hành áp dụng thay đổi, vui lòng đợi một chút để bot đồng bộ!`, threadID, () => cmd.run(restart));
 					else {
						let array = ['Hình như bạn đang chơi đồ?', 'Đồ ngon quá à bạn?', 'Bú gì ngon vậy?'];
						api.sendMessage(array[Math.floor(Math.random() * array.length)], threadID);
					}
					break;
				}
				case "admin_prefix": {
					writeENV("PREFIX", body);
					api.sendMessage(`🛠 | Đã đổi prefix của bot thành: ${body}`, threadID);
					__GLOBAL.reply.splice(indexOfReply, 1);
					break;
				}
				case "admin_setName": {
					writeENV("BOT_NAME", body);
					api.sendMessage(`🛠 | Đã đổi tên của bot thành: ${body}`, threadID);
					__GLOBAL.reply.splice(indexOfReply, 1);
					break;
				}
				case "admin_setAdmins": {
					writeENV("ADMINS", body);
					api.sendMessage(`🛠 | Đã đổi admins của bot thành: ${body}`, threadID);
					__GLOBAL.reply.splice(indexOfReply, 1);
					break;
				}
				case "admin_setRefresh": {
					if (body != 'on' && body != 'off') return api.sendMessage(`Chỉ có thể là 'on' hoặc 'off'.`, threadID);
					if (body == process.env.REFRESHING) return api.sendMessage(`tuỳ chọn của bạn trùng với config đã từng đặt trước đó`, threadID);
					writeENV("REFRESHING", body);
					api.sendMessage(`🛠 | Đã đổi khởi động lại của bot thành: ${body}`, threadID);
					__GLOBAL.reply.splice(indexOfReply, 1);
					break;
				}
				case "admin_noti": {
					return api.getThreadList(100, null, ["INBOX"], (err, list) => {
						if (err) throw err;
						list.forEach(item => (item.isGroup == true && item.threadID != threadID) ? api.sendMessage(body, item.threadID) : '');
						api.sendMessage('Đã gửi thông báo với nội dung:\n' + body, threadID);
					});
					__GLOBAL.reply.splice(indexOfReply, 1);
					break;
				}
				case "admin_searchUser": {
					let getUsers = await User.getUsers(['uid', 'name']);
					let matchUsers = [], a = '', b = 0;
					getUsers.forEach(i => {
						if (i.name.toLowerCase().includes(body.toLowerCase())) {
							matchUsers.push({
								name: i.name,
								id: i.uid
							});
						}
					});
					matchUsers.forEach(i => a += `\n${b += 1}. ${i.name} - ${i.id}`);
					(matchUsers.length > 0) ? api.sendMessage(`Đã tìm thấy ${b} user${(b > 1) ? 's' : ''}:${a}`, threadID) : api.sendMessage(`Không tìm thấy user nào có tên ${body}`, threadID);
					break;
				}
				case "admin_searchThread": {
					let getThreads = (await Thread.getThreads(['threadID', 'name'])).filter(item => !!item.name);
					let matchThreads = [], a = '', b = 0;
					getThreads.forEach(i => {
						if (i.name.toLowerCase().includes(body.toLowerCase())) {
							matchThreads.push({
								name: i.name,
								id: i.threadID
							});
						}
					});
					matchThreads.forEach(i => a += `\n${b += 1}. ${i.name} - ${i.id}`);
					(matchThreads.length > 0) ? api.sendMessage(`Đã tìm thấy ${b} nhóm:${a}`, threadID) : api.sendMessage(`Không tìm thấy nhóm nào có tên ${body}`, threadID);
					break;
				}
				case "domath": {
					const timeout = event.messageReply.timestamp + 15000;
					if (event.timestamp - timeout >= 0) return api.sendMessage(`Bạn đã hết thời gian để trả lời câu hỏi này!`, threadID);
					(body == replyMessage.answer) ? api.sendMessage(`Bing bong, kết quả của bạn hoàn toàn chính xác!\nBạn đã trả lời câu hỏi này trong vòng ${(event.timestamp - event.messageReply.timestamp) / 1000} giây!`, threadID) : api.sendMessage(`ahh, có vẻ bạn đã trả lời sai, câu trả lời đúng là: ${replyMessage.answer}`, threadID);
					__GLOBAL.reply.splice(indexOfReply, 1);
					break;
				}
				case "fishing_shop": {
					let inventory = await Fishing.getInventory(senderID);
					let durability = ['50','70','100','130','200','400'];
					let moneyToUpgrade = ['1000','4000','6000','8000','10000'];
					let expToLevelup = ['1000','2000','4000','6000','8000'];
					
					let moneyToFix = Math.floor(Math.random() * (300 - 100)) + 100;
					if (body == 1) return api.sendMessage(`Bạn cần ${expToLevelup[inventory.rod]} exp và ${moneyToUpgrade[inventory.rod]} đô để nâng cấp từ level ${inventory.rod} lên level ${inventory.rod + 1}\nReaction 👍 để đồng ý hoặc chọn bất cứ reaction nào để huỷ!`, threadID, (err, info) => __GLOBAL.confirm.push({ type: "fishing_upgradeRod", messageID: info.messageID, author: senderID, exp: expToLevelup[inventory.rod], money: moneyToUpgrade[inventory.rod], durability: durability[inventory.rod] }));
					if (body == 2) return api.sendMessage(`Để sửa chữa loại cần câu này, bạn cần ${moneyToFix} đô, bạn đồng ý chứ?\nReaction 👍 để đồng ý hoặc chọn bất cứ reaction nào để huỷ`, threadID, (err, info) => __GLOBAL.confirm.push({ type: "fishing_fixRod", messageID: info.messageID, author: senderID, moneyToFix, durability: durability[inventory.rod - 1] }));
					if (body == 3) return api.sendMessage('Để mua cần câu loại 1, bạn cần tối thiếu 1000 đô, bạn đồng ý chứ?\nReaction 👍 để đồng ý hoặc chọn bất cứ reaction nào để huỷ', threadID, (err, info) => __GLOBAL.confirm.push({ type: "fishing_buyRod", messageID: info.messageID, author: senderID }));
					if (body == 4) return api.sendMessage('Coming soon!', threadID);
					if (body == 5) return api.sendMessage('Coming soon!', threadID);
					break;
				}
				case "fishing_domath": {
					let typeSteal;
					let inventory = await Fishing.getInventory(senderID);
					let stats = await Fishing.getStats(senderID);
					let valueSteal = Math.floor(Math.random() * 5) + 1;
					const timeout = event.messageReply.timestamp + 15000;
					const roll = Math.floor(Math.random() * 1008);
					inventory.exp += Math.floor(Math.random() * 500);
					stats.exp += Math.floor(Math.random() * 500);
					stats.casts += 1;
					if (event.timestamp - timeout >= 0 || parseInt(body) !==  parseInt(replyMessage.answer)) {
						if (roll <= 400) {
							if (inventory.trash - valueSteal <= 0) valueSteal = inventory.trash;
							inventory.trash -= valueSteal;
							typeSteal = "rác";
						}
						else if (roll > 400 && roll <= 700) {
							if (inventory.fish1 - valueSteal <= 0) valueSteal = inventory.fish1;
							inventory.fish1 -= valueSteal;
							typeSteal = "cá bình thường";
						}
						else if (roll > 700 && roll <= 900) {
							if (inventory.fish2 - valueSteal <= 0) valueSteal = inventory.fish2;
							inventory.fish2 -= valueSteal;
							typeSteal = "cá hiếm";
						}
						else if (roll > 900 && roll <= 960) {
							if (inventory.crabs - valueSteal < 0) valueSteal = inventory.crabs;
							inventory.crabs -= valueSteal;
							typeSteal = "cua";
						}
						else if (roll > 960 && roll <= 1001) {
							if (inventory.blowfish - valueSteal < 0) valueSteal = inventory.blowfish;
							inventory.blowfish -= valueSteal;
							typeSteal = "cá nóc";
						}
						else if (roll == 1002) {
							if (inventory.crocodiles - valueSteal < 0) valueSteal = inventory.crocodiles;
							inventory.crocodiles -= valueSteal;
							typeSteal = "cá sấu";
						}
						else if (roll == 1003) {
							if (inventory.whales - valueSteal < 0) valueSteal = inventory.whales;
							inventory.whales -= valueSteal;
							typeSteal = "cá voi";
						}
						else if (roll == 1004) {
							if (inventory.dolphins - valueSteal < 0) valueSteal = inventory.dolphins;
							inventory.dolphins -= valueSteal;
							typeSteal = "cá heo";
						}
						else if (roll == 1006) {
							if (inventory.squid - valueSteal < 0) valueSteal = inventory.squid;
							inventory.squid -= valueSteal;
							typeSteal = "mực";
						}
						else if (roll == 1007) {
							if (inventory.sharks - valueSteal < 0) valueSteal = inventory.sharks;
							inventory.sharks -= valueSteal;
							typeSteal = "cá mập";
						}
						api.sendMessage(`${(event.timestamp - timeout >= 0) ? "Bạn đã hết thời gian cho phép để trả lời câu hỏi này" : "Bạn đã trả lời sai câu hỏi này"} và bị quái vật cướp ${valueSteal} ${typeSteal}.`, threadID);
					}
					if (parseInt(body) == parseInt(replyMessage.answer)) {
						if (roll <= 400) {
							inventory.trash += valueSteal;
							typeSteal = "rác";
						}
						else if (roll > 400 && roll <= 700) {
							inventory.fish1 += valueSteal;
							typeSteal = "cá bình thường";
						}
						else if (roll > 700 && roll <= 900) {
							inventory.fish2 += valueSteal;
							typeSteal = "cá hiếm";
						}
						else if (roll > 900 && roll <= 960) {
							inventory.crabs += valueSteal;
							typeSteal = "cua";
						}
						else if (roll > 960 && roll <= 1001) {
							inventory.blowfish += valueSteal;
							typeSteal = "cá nóc";
						}
						else if (roll == 1002) {
							inventory.crocodiles += valueSteal;
							typeSteal = "cá sấu";
						}
						else if (roll == 1003) {
							inventory.whales += valueSteal;
							typeSteal = "cá voi";
						}
						else if (roll == 1004) {
							inventory.dolphins += valueSteal;
							typeSteal = "cá heo";
						}
						else if (roll == 1006) {
							inventory.squid += valueSteal;
							typeSteal = "mực";
						}
						else if (roll == 1007) {
							inventory.sharks += valueSteal;
							typeSteal = "cá mập";
						}
						api.sendMessage(`Bing bong, kết quả của bạn hoàn toàn chính xác và đã hạ ngục được quái vật. Phần thưởng của bạn là:\n- ${valueSteal} ${typeSteal}\n- Exp: ${stats.exp}\n\nBạn đã trả lời câu hỏi này trong ${(event.timestamp - event.messageReply.timestamp) / 1000} giây!`, threadID);
					}
					await Fishing.updateInventory(senderID, inventory);
					await Fishing.updateStats(senderID, stats);
					__GLOBAL.reply.splice(indexOfReply, 1);
					break;
				}
				case "media_video": {
					if (isNaN(body) || parseInt(body) <= 0 || parseInt(body) > 5) return api.sendMessage("chọn từ 1 đến 5", threadID);
					const ytdl = require("ytdl-core");
					var link = `https://www.youtube.com/watch?v=${replyMessage.url[body -1]}`
					ytdl.getInfo(link, (err, info) => { 
						if (info.length_seconds > 360) return api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID);
					});
					api.sendMessage(`video của bạn đang được xử lý, nếu video dài có thể sẽ mất vài phút!`, threadID);
					return ytdl(link).pipe(fs.createWriteStream(__dirname + "/src/video.mp4")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/video.mp4")}, threadID, () => fs.unlinkSync(__dirname + "/src/video.mp4"), messageID));
					break;
				}
				case "media_audio": {
					if (isNaN(body) || parseInt(body) <= 0 || parseInt(body) > 5) return api.sendMessage("chọn từ 1 đến 5", threadID);
					var ytdl = require("ytdl-core");
					var ffmpeg = require("fluent-ffmpeg");
					var ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
					ffmpeg.setFfmpegPath(ffmpegPath);
					var link = `https://www.youtube.com/watch?v=${replyMessage.url[body -1]}`
					ytdl.getInfo(link, (err, info) => { 
						if (info.length_seconds > 360) return api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID);
					});
					api.sendMessage(`video của bạn đang được xử lý, nếu video dài có thể sẽ mất vài phút!`, threadID);
					return ffmpeg().input(ytdl(link)).toFormat("mp3").pipe(fs.createWriteStream(__dirname + "/src/music.mp3")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/music.mp3")}, threadID, () => fs.unlinkSync(__dirname + "/src/music.mp3"), messageID));					break;
					break;
				}
			}
			return;
		}
	}
}