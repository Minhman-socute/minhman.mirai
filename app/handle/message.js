module.exports = function({ api, config, __GLOBAL, models, User, Thread, Rank, Economy, Fishing, Nsfw, Image }) {
	/* ================ Config ==================== */
	let {prefix, googleSearch, wolfarm, yandex, openweather, tenor, saucenao, waketime, sleeptime, admins, nsfwGodMode} = config;
	const fs = require("fs-extra");
	const moment = require("moment-timezone");
	const request = require("request");
	const ms = require("parse-ms");
	const stringSimilarity = require('string-similarity');
	const axios = require('axios');
	const logger = require("../modules/log.js");
	var resetNSFW = false;

	setInterval(() => {
		var timer = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm");
		if (timer == "00:00") {
			if (resetNSFW == false) {
				resetNSFW = true;
				Nsfw.resetNSFW();
			}
		}
	}, 1000);

	if (!fs.existsSync(__dirname + "/src/shortcut.json")) {
		var template = [];
		fs.writeFileSync(__dirname + "/src/shortcut.json", JSON.stringify(template));
		logger('Tạo file shortcut mới thành công!');
	}

	return async function({ event }) {
		let { body: contentMessage, senderID, threadID, messageID } = event;
		senderID = parseInt(senderID);
		threadID = parseInt(threadID);

		if (__GLOBAL.userBlocked.includes(senderID) && !admins.includes(senderID) || __GLOBAL.threadBlocked.includes(threadID) && !admins.includes(senderID)) return;

		await User.createUser(senderID);
		await Thread.createThread(threadID);
		await Rank.updatePoint(senderID, 1);

		if (event.mentions) {
			var mentions = Object.keys(event.mentions);
			mentions.forEach(async mention => {
				if (__GLOBAL.afkUser.includes(parseInt(mention))) {
					var reason = await User.getReason(mention);
					var name = await User.getName(mention);
					reason == "none" ? api.sendMessage(`${name} Hiện tại đang bận!`, threadID, messageID) : api.sendMessage(`${name} Hiện tại đang bận với lý do: ${reason}`, threadID, messageID);
					return;
				}
			});
		}

		if (__GLOBAL.afkUser.includes(parseInt(senderID))) {
			await User.nonafk(senderID);
			await User.updateReason(senderID, "");
			__GLOBAL.afkUser.splice(__GLOBAL.afkUser.indexOf(senderID), 1);
			var name = await User.getName(senderID);
			return api.sendMessage(`Chào mừng bạn đã quay trở lại, ${name}`,threadID);
		}

	/* ================ Staff Commands ==================== */
		//lấy shortcut
		if (contentMessage.length !== -1) {
			let shortcut = JSON.parse(fs.readFileSync(__dirname + "/src/shortcut.json"));
			if (shortcut.some(item => item.id == threadID)) {
				let getThread = shortcut.find(item => item.id == threadID).shorts;
				let output, random;
				if (getThread.some(item => item.in == contentMessage)) {
					let shortOut = getThread.find(item => item.in == contentMessage).out;
					if (shortOut.indexOf(" | ") !== -1) {
						var arrayOut = shortOut.split(" | ");
						return api.sendMessage(`${arrayOut[Math.floor(Math.random() * arrayOut.length)]}`, threadID);
					}
					else return api.sendMessage(`${shortOut}`, threadID);
				}
			}
		}

		//sim on/off
		if (__GLOBAL.simOn.includes(threadID)) request(`https://simsumi.herokuapp.com/api?text=${encodeURIComponent(contentMessage)}&lang=vi`, (err, response, body) => api.sendMessage((JSON.parse(body).success != '') ? JSON.parse(body).success : 'Không có câu trả lời nào.', threadID, messageID)); 

		//lấy file cmds
		var nocmdData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));

		//tạo 1 đối tượng mới nếu group chưa có trong file cmds
		if (!nocmdData.banned.some(item => item.id == threadID)) {
			let addThread = {
				id: threadID,
				cmds: []
			};
			nocmdData.banned.push(addThread);
			fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(nocmdData));
		}

		//lấy lệnh bị cấm trong group
		var cmds = nocmdData.banned.find(item => item.id == threadID).cmds;
		for (const item of cmds) if (contentMessage.indexOf(prefix + item) == 0) return api.sendMessage("Lệnh này đã bị cấm!", threadID, messageID);

		//giúp thành viên thông báo lỗi về admin
		if (contentMessage.indexOf(`${prefix}report`) == 0) {
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (!content) return api.sendMessage("Có vẻ như bạn chưa nhập thông tin, vui lòng nhập thông tin lỗi mà bạn gặp!", threadID, messageID);
			var userName = await User.getName(senderID);
			var threadName = await Thread.getName(threadID);
			api.sendMessage(
				"Báo cáo từ: " + userName +
				"\nGroup gặp lỗi: " + threadName +
				"\nLỗi gặp phải: " + content +
				"\nThời gian báo: " + moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss"),
				admins[0]
			);
			return api.sendMessage("Thông tin lỗi của bạn đã được gửi về admin!", threadID, messageID);
		}

		//nsfw
		if (contentMessage.indexOf(`${prefix}nsfw`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content == 'off') {
				if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đã bị tắt NSFW từ trước!", threadID, messageID);
				Thread.blockNSFW(threadID).then((success) => {
					if (!success) return api.sendMessage("Oops, không thể tắt NSFW ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã tắt NSFW thành công!", threadID, messageID);
					__GLOBAL.NSFWBlocked.push(threadID);
				})
			}
			else if (content == 'on') {
				if (!__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này chưa bị tắt NSFW", threadID, messageID);
				Thread.unblockNSFW(threadID).then(success => {
					if (!success) return api.sendMessage("Oops, không thể bật NSFW ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã bật NSFW thành công!", threadID, messageID);
					__GLOBAL.NSFWBlocked.splice(__GLOBAL.NSFWBlocked.indexOf(threadID), 1);
				});
			}
			return;
		}

		//admin command
		if (contentMessage.indexOf(`${prefix}admin`) == 0 && admins.includes(senderID)) {
			var contentSplit = contentMessage.split(" ");
			var content = contentSplit[1];
			var arg = contentSplit[2];
			var helpList = JSON.parse(fs.readFileSync(__dirname + "/src/help/listAC.json"));
			if (content.indexOf("all") == 0) {
				var commandAdmin = [];
				helpList.forEach(help => (!commandAdmin.some(item => item.name == help.name)) ? commandAdmin.push(help.name) : commandAdmin.find(item => item.name == help.name).push(help.name));
				return api.sendMessage(commandAdmin.join(', '), threadID, messageID);
			}
			else if (content.indexOf("help") == 0) {
				if (helpList.some(item => item.name == arg))
					return api.sendMessage(
						'=== Thông tin lệnh bạn đang tìm ===\n' +
						'- Tên lệnh: ' + helpList.find(item => item.name == arg).name + '\n' +
						'- Thông tin: ' + helpList.find(item => item.name == arg).decs + '\n' +
						'- Cách dùng: ' + prefix + helpList.find(item => item.name == arg).usage + '\n' +
						'- Hướng dẫn: ' + prefix + helpList.find(item => item.name == arg).example,
						threadID, messageID
					);
				else return api.sendMessage(`Lệnh bạn nhập không hợp lệ, hãy gõ ${prefix}admin all để xem tất cả các lệnh có trong bot.`, threadID, messageID);
			}
			else if (content.indexOf("settings") == 0) {
				return api.sendMessage(
					'🛠 | Đây là toàn bộ cài đặt của bot | 🛠\n' +
					'\n=== Quản Lý Cài Đặt ===' +
					'\n[1] Prefix.' +
					'\n[2] Tên của bot.' +
					'\n[3] Danh sách admins.' +
					'\n[4] Khởi động lại.' +
					'\n=== Quản Lý Hoạt Động ===' +
					'\n[6] Kiểm tra cập nhật.' +
					'\n[7] Lấy danh sách các user bị ban.' +
					'\n[8] Lấy danh sách các nhóm bị ban.' +
					'\n[9] Gửi thông báo đến toàn bộ nhóm ' +
					'\n[10] Tìm kiếm uid qua tên user.' +
					'\n[11] Tìm kiếm threadID qua tên nhóm.' +
					'\n[12] Áp dụng toàn bộ cài đặt.' +
					'\n-> Để chọn bạn hãy reply tin nhắn này kèm với số bạn muốn <-',
					threadID, (err, info) => {
						if (err) throw err;
						__GLOBAL.reply.push({
							type: "admin_settings",
							messageID: info.messageID,
							target: parseInt(threadID),
							author: senderID
						});
					}
				);
			}
			else if (content.indexOf("banUser") == 0) {
				const mentions = Object.keys(event.mentions);
				if (mentions.length == 0) {
					return User.ban(parseInt(arg)).then(success => {
						User.getName(parseInt(arg)).then(name => {
							__GLOBAL.userBlocked.push(parseInt(arg));
							logger(arg, 'Ban User');
							if (!name) name = 'Người lạ nào đấy';
							if (__GLOBAL.userBlocked.includes(arg)) return api.sendMessage(`${name} - ${arg} đã bị ban từ trước!`, threadID);
							if (!success) return api.sendMessage("Không thể ban người này!", threadID, messageID);
							api.sendMessage(`${name} - ${arg} đã bị ban`, threadID, messageID);
						});
					});
				}
				else {
					return mentions.forEach(id => {
						id = parseInt(id);
						if (__GLOBAL.userBlocked.includes(id)) return api.sendMessage(`${event.mentions[id]} đã bị ban từ trước!`, threadID, messageID);
						User.ban(id).then((success) => {
							if (!success) return api.sendMessage("Không thể ban người này!", threadID, messageID);
							api.sendMessage({
								body: `${event.mentions[id]} đã bị ban!`,
								mentions: [{ tag: event.mentions[id], id }]
							}, threadID, messageID);
							__GLOBAL.userBlocked.push(id);
							logger(id, 'Ban User');
						});
					});
				};
			}
			else if (content.indexOf("unbanUser") == 0) {
				const mentions = Object.keys(event.mentions);
				if (mentions == 0) {
					return User.unban(parseInt(arg)).then(success => {
						User.getName(parseInt(arg)).then(name => {
							const indexOfUser = __GLOBAL.userBlocked.indexOf(parseInt(arg));
							if (indexOfUser == -1) return api.sendMessage(`${name} - ${arg} chưa bị ban từ trước!`, threadID, messageID);
							if (!success) return api.sendMessage(`không thể unban ${name} - ${arg}!`, threadID, messageID);
							api.sendMessage(`${name} - ${arg} đã được unban`, threadID, messageID);
							__GLOBAL.userBlocked.splice(indexOfUser, 1);
							logger(arg, "Unban User");
						});
					});
				}
				else {
					return mentions.forEach(id => {
						id = parseInt(id);
						const indexOfUser = __GLOBAL.userBlocked.indexOf(id);
						if (indexOfUser == -1)
							return api.sendMessage({
								body: `${event.mentions[id]} chưa bị ban, vui lòng ban trước!`,
								mentions: [{ tag: event.mentions[id], id }]
							}, threadID, messageID);
						User.unban(id).then(success => {
							if (!success) return api.sendMessage("Không thể unban người này!", threadID, messageID);
							api.sendMessage({
								body: `Đã unban ${event.mentions[id]}!`,
								mentions: [{ tag: event.mentions[id], id }]
							}, threadID, messageID);
							__GLOBAL.userBlocked.splice(indexOfUser, 1);
							logger(mentions, "Unban User");
						});
					});
				}
			}
			else if (content.indexOf("banThread") == 0) {
				if (arg) return Thread.ban(parseInt(arg)).then(success => {
					if (!success) return api.sendMessage("Không thể ban group này!", threadID, messageID);
					api.sendMessage("Nhóm này đã bị chặn tin nhắn!.", threadID, messageID);
					__GLOBAL.threadBlocked.push(parseInt(arg));
				});
				else return Thread.ban(threadID).then(success => {
					if (!success) return api.sendMessage("Không thể ban group này!", threadID, messageID);
					api.sendMessage("Nhóm này đã bị chặn tin nhắn!.", threadID, messageID);
					__GLOBAL.threadBlocked.push(threadID);
				});
			}
			else if (content.indexOf("unbanThread") == 0) {
				if (arg) return Thread.unban(parseInt(arg)).then(success => {
					const indexOfThread = __GLOBAL.threadBlocked.indexOf(parseInt(arg));
					if (indexOfThread == -1) return api.sendMessage("Nhóm này chưa bị chặn!", threadID, messageID);
					if (!success) return api.sendMessage("Không thể bỏ chặn nhóm này!", threadID, messageID);
					api.sendMessage("Nhóm này đã được bỏ chặn!", threadID, messageID);
					__GLOBAL.threadBlocked.splice(indexOfThread, 1);
					logger(arg, "Unban Thread");
				});
				return Thread.unban(threadID).then(success => {
					const indexOfThread = __GLOBAL.threadBlocked.indexOf(threadID);
					if (indexOfThread == -1) return api.sendMessage("Nhóm này chưa bị chặn!", threadID, messageID);
					if (!success) return api.sendMessage("Không thể bỏ chặn nhóm này!", threadID, messageID);
					api.sendMessage("Nhóm này đã được bỏ chặn!", threadID, messageID);
					__GLOBAL.threadBlocked.splice(indexOfThread, 1);
					logger(threadID, "Unban Thread");
				});
			}
			else if (content.indexOf("banCmd") == 0) {
				if (!arg) return api.sendMessage("Hãy nhập lệnh cần cấm!", threadID, messageID);
				var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
				if (arg == "list") return api.sendMessage(`Đây là danh sách các command hiện đang bị ban tại group này: ${nocmdData.banned.find(item => item.id == threadID).cmds}`, threadID, messageID);
				if (!jsonData.cmds.includes(arg)) return api.sendMessage("Không có lệnh " + arg + " trong cmds.json nên không thể cấm", threadID, messageID);
				else {
					if (jsonData.banned.some(item => item.id == threadID)) {
						let getThread = jsonData.banned.find(item => item.id == threadID);
						getThread.cmds.push(arg);
					}
					else {
						let addThread = {
							id: threadID,
							cmds: []
						};
						addThread.cmds.push(arg);
						jsonData.banned.push(addThread);
					}
					api.sendMessage("Đã cấm " + arg + " trong group này", threadID, messageID);
				}
				return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
			}
			else if (content.indexOf("unbanCmd") == 0) {
				if (!arg) return api.sendMessage("Hãy nhập lệnh cần bỏ cấm!", threadID, messageID);
				var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
				var getCMDS = jsonData.banned.find(item => item.id == threadID).cmds;
				if (!getCMDS.includes(arg)) return api.sendMessage("Lệnh " + arg + " chưa bị cấm", threadID, messageID);
				else {
					let getIndex = getCMDS.indexOf(arg);
					getCMDS.splice(getIndex, 1);
					api.sendMessage("Đã bỏ cấm " + arg + " trong group này", threadID, messageID);
				}
				return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
			}
			else if (content.indexOf("resend") == 0) {
				if (arg == 'off') {
					if (__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage("Nhóm này đã bị tắt resend từ trước!", threadID, messageID);
					return Thread.blockResend(threadID).then((success) => {
						if (!success) return api.sendMessage("Oops, không thể tắt resend ở nhóm này!", threadID, messageID);
						api.sendMessage("Đã tắt resend tin nhắn thành công!", threadID, messageID);
						__GLOBAL.resendBlocked.push(threadID);
					})
				}
				else if (arg == 'on') {
					if (!__GLOBAL.resendBlocked.includes(threadID)) return api.sendMessage("Nhóm này chưa bị tắt resend trước đó", threadID, messageID);
					return Thread.unblockResend(threadID).then(success => {
						if (!success) return api.sendMessage("Oops, không thể bật resend ở nhóm này!", threadID, messageID);
						api.sendMessage("Đã bật resend tin nhắn, tôi sẽ nhắc lại tin nhắn bạn đã xoá 😈", threadID, messageID);
						__GLOBAL.resendBlocked.splice(__GLOBAL.resendBlocked.indexOf(threadID), 1);
					});
				}
			}
			else if (content.indexOf("createUser") == 0) {
				const mentions = Object.keys(event.mentions);
				if (mentions.length == 0) {
					if (isNaN(arg)) return api.sendMessage("Không phải là ID.", threadID, messageID);
					let success = await User.createUser(arg);
					let name = await User.getName(arg);
					(success) ? api.sendMessage("Đã thêm " + name + " vào database.", threadID, messageID) : api.sendMessage(name + " đã có sẵn trong database.", threadID, messageID);
				}
				else {
					for (let i of mentions) {
						let success = await User.createUser(i);
						let name = await User.getName(i);
						(success) ? api.sendMessage("Đã thêm " + name + " vào database.", threadID, messageID) : api.sendMessage(name + " đã có sẵn trong database.", threadID, messageID);
					}
				}
				return;
			}
			else if (content.indexOf("addUser") == 0) return api.addUserToGroup(arg, threadID);
			else if (content.indexOf("restart") == 0) return api.sendMessage(`Hệ thống restart khẩn ngay bây giờ!`, threadID, () => require("node-cmd").run("pm2 restart 0"), messageID);
			else return api.sendMessage(`Lệnh không tồn tại!`, threadID, messageID);
		}

		if (contentMessage.indexOf(`${prefix}levelup`) == 0) {
			var arg = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (arg == 'off') {
				if (__GLOBAL.blockLevelUp.includes(threadID)) return api.sendMessage("Nhóm này đã bị tắt thông báo levelup từ trước!", threadID, messageID);
				return Thread.blockLevelUp(threadID).then((success) => {
					if (!success) return api.sendMessage("Oops, không thể tắt thông báo levelup ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã tắt thông báo levelup thành công!", threadID, messageID);
					__GLOBAL.blockLevelUp.push(threadID);
				})
			}
			else if (arg == 'on') {
				if (!__GLOBAL.blockLevelUp.includes(threadID)) return api.sendMessage("Nhóm này chưa tắt thông báo levelup từ trước", threadID, messageID);
				return Thread.unblockLevelUp(threadID).then(success => {
					if (!success) return api.sendMessage("Oops, không thể bật thông báo levelup ở nhóm này!", threadID, messageID);
					api.sendMessage("Đã bật thông báo levelup", threadID, messageID);
					__GLOBAL.blockLevelUp.splice(__GLOBAL.blockLevelUp.indexOf(threadID), 1);
				});
			}
		}

	/* ==================== Help Commands ================*/

		//help
		if (contentMessage.indexOf(`${prefix}help`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var helpList = JSON.parse(fs.readFileSync(__dirname + "/src/help/listCommands.json"));
			if (content.length == 0) {
				var helpGroup = [];
				var helpMsg = "";
				helpList.forEach(help => (!helpGroup.some(item => item.group == help.group)) ? helpGroup.push({ group: help.group, cmds: [help.name] }) : helpGroup.find(item => item.group == help.group).cmds.push(help.name));
				helpGroup.forEach(help => helpMsg += `===== ${help.group.charAt(0).toUpperCase() + help.group.slice(1)} =====\n${help.cmds.join(', ')}\n\n`);
				return api.sendMessage(` Hiện tại đang có ${helpList.length} lệnh có thể sử dụng trên bot này \n\n` + helpMsg, threadID, messageID);
			}
			else {
				if (helpList.some(item => item.name == content))
					return api.sendMessage(
						'=== Thông tin lệnh bạn đang tìm ===\n' +
						'- Tên lệnh: ' + helpList.find(item => item.name == content).name + '\n' +
						'- Nhóm lệnh: ' + helpList.find(item => item.name == content).group + '\n' +
						'- Thông tin: ' + helpList.find(item => item.name == content).decs + '\n' +
						'- Cách dùng: ' + prefix + helpList.find(item => item.name == content).usage + '\n' +
						'- Hướng dẫn: ' + prefix + helpList.find(item => item.name == content).example,
						threadID, messageID
					);
				else return api.sendMessage(`Lệnh bạn nhập không hợp lệ, hãy gõ ${prefix}help để xem tất cả các lệnh có trong bot.`, threadID, messageID);
			}
		}

		//yêu cầu công việc cho bot
		if (contentMessage.indexOf(`${prefix}request`) == 0) {
			var content = contentMessage.slice(prefix.length + 8,contentMessage.length);
			if (!fs.existsSync(__dirname + "/src/requestList.json")) {
				let requestList = [];
				fs.writeFileSync(__dirname + "/src/requestList.json",JSON.stringify(requestList));
			}
			if (content.indexOf("add") == 0) {
				var addnew = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				getData.push(addnew);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage("Đã thêm: " + addnew, threadID, () => api.sendMessage("ID " + senderID + " Đã thêm '" + addnew + "' vào request list", admins[0]), messageID);
			}
			else if (content.indexOf("del") == 0 && admins.includes(senderID)) {
				var deletethisthing = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage("Không tìm thấy " + deletethisthing, threadID, messageID);
				var itemIndex = getData.indexOf(deletethisthing);
				getData.splice(itemIndex, 1);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage("Đã xóa: " + deletethisthing, threadID, messageID);
			}
			else if (content.indexOf("list") == 0) {
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage("Không có việc cần làm", threadID, messageID);
				let allWorks = "";
				getData.map(item => allWorks = allWorks + `\n- ` + item);
				return api.sendMessage("Đây là toàn bộ yêu cầu mà các bạn đã gửi:" + allWorks, threadID, messageID);
			}
		}

	/* ==================== Cipher Commands ================*/

		//morse
		if (contentMessage.indexOf(`${prefix}morse`) == 0) {
			const morsify = require('morsify');
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help morse`, threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help morse`, threadID, messageID);
		}

		//caesar
		if (contentMessage.indexOf(`${prefix}caesar`) == 0) {
			if (process.env.CAESAR == '' || process.env.CAESAR == null) return api.sendMessage('Chưa đặt mật khẩu CAESAR trong file .env', threadID, messageID);
			const Caesar = require('caesar-salad').Caesar;
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (event.type == "message_reply")(content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help caesar`, threadID, messageID);
			else(content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help caesar`, threadID, messageID);
		}

		//vigenere
		if (contentMessage.indexOf(`${prefix}vigenere`) == 0) {
			if (process.env.VIGENERE == '' || process.env.VIGENERE == null) return api.sendMessage('Chưa đặt mật khẩu VIGENERE trong file .env', threadID, messageID);
			const Vigenere = require('caesar-salad').Vigenere;
			var content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (event.type == "message_reply")(content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help vigenere`, threadID, messageID)
			else(content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help vigenere`, threadID, messageID);
		}

		//rot47
		if (contentMessage.indexOf(`${prefix}rot47`) == 0) {
			const ROT47 = require('caesar-salad').ROT47;
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
		}

	/* ==================== Media Commands ==================== */

		//youtube music
		if (contentMessage.indexOf(`${prefix}audio`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
			var ytdl = require("ytdl-core");
			var ffmpeg = require("fluent-ffmpeg");
			var ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
			ffmpeg.setFfmpegPath(ffmpegPath);
			if (content.indexOf("http") == -1) {
				return request(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&key=${googleSearch}&q=${encodeURIComponent(content)}`, function(err, response, body) {
					var retrieve = JSON.parse(body), msg = '', num = 0, link = [];
					if (!retrieve) return api.sendMessage(`tạch api!`, threadID);
					if (retrieve.items.length < 1) return api.sendMessage(`không có kết quả với từ khoá trên!`, threadID, messageID);
					for (var i = 0; i < 5; i++) {
						if (typeof retrieve.items[i].id.videoId != 'undefined') {
							link.push(retrieve.items[i].id.videoId);
							msg += `${num += 1}. ${decodeURIComponent(retrieve.items[i].snippet.title)} [https://youtu.be/${retrieve.items[i].id.videoId}]\n\n`;
						}
					}
					api.sendMessage(`Có ${link.length} kết quả, Chọn 1 trong ${link.length} bên dưới đây:\n\n` + msg, threadID, (err, info) => __GLOBAL.reply.push({ type: "media_audio", messageID: info.messageID, target: parseInt(threadID), author: senderID, url: link }));
				});
			}
			ytdl.getInfo(content, (err, info) => (info.length_seconds > 360) ? api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID) : '');
			api.sendMessage(`video của bạn đang được xử lý, nếu video dài có thể sẽ mất vài phút!`, threadID);
			return ffmpeg().input(ytdl(content)).toFormat("mp3").pipe(fs.createWriteStream(__dirname + "/src/music.mp3")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/music.mp3")}, threadID, () => fs.unlinkSync(__dirname + "/src/music.mp3"), messageID));
		}

		//youtube video
		if (contentMessage.indexOf(`${prefix}video`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
			var ytdl = require("ytdl-core");
			if (content.indexOf("http") == -1) {
				return request(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&key=${googleSearch}&q=${encodeURIComponent(content)}`, function(err, response, body) {
					var retrieve = JSON.parse(body), msg = '', num = 0, link = [];
					if (!retrieve) return api.sendMessage(`tạch api!`, threadID);
					if (retrieve.items < 1) return api.sendMessage(`không có kết quả với từ khoá trên!`, threadID, messageID);
					for (var i = 0; i < 5; i++) {
						if (typeof retrieve.items[i].id.videoId != 'undefined') {
							link.push(retrieve.items[i].id.videoId);
							msg += `${num += 1}. ${decodeURIComponent(retrieve.items[i].snippet.title)} [https://youtu.be/${retrieve.items[i].id.videoId}]\n\n`;
						}
					}
					api.sendMessage(`Có ${link.length} kết quả, Chọn 1 trong ${link.length} bên dưới đây:\n\n` + msg, threadID, (err, info) => __GLOBAL.reply.push({ type: "media_video", messageID: info.messageID, target: parseInt(threadID), author: senderID, url: link }));
				});
			}
			ytdl.getInfo(content, (err, info) => (info.length_seconds > 360) ? api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID) : '');
			api.sendMessage(`video của bạn đang được xử lý, nếu video dài có thể sẽ mất vài phút!`, threadID);
			return ytdl(content).pipe(fs.createWriteStream(__dirname + "/src/video.mp4")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/video.mp4")}, threadID, () => fs.unlinkSync(__dirname + "/src/video.mp4"), messageID));
		}

		//anime
		if (contentMessage.indexOf(`${prefix}anime`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var jsonData = fs.readFileSync(__dirname + "/src/anime.json");
			var data = JSON.parse(jsonData).sfw;
			if (!content || !data.hasOwnProperty(content)) {
				let sfwList = [];
				Object.keys(data).forEach(endpoint => sfwList.push(endpoint));
				let sfwTags = sfwList.join(', ');
				return api.sendMessage(`=== Tất cả các tag Anime ===\n` + sfwTags, threadID, messageID);
			}
			return request(data[content], (error, response, body) => {
				let picData = JSON.parse(body);
				let getURL = "";
				(!picData.data) ? getURL = picData.url : getURL = picData.data.response.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID));
			});
		}

		//meme
		if (contentMessage == `${prefix}meme`)
			return request("https://meme-api.herokuapp.com/gimme/memes", (err, response, body) => {
				if (err) throw err;
				var content = JSON.parse(body);
				let title = content.title;
				var baseurl = content.url;
				let callback = function() {
					api.sendMessage({
						body: `${title}`,
						attachment: fs.createReadStream(__dirname + "/src/meme.jpg")
					}, threadID, () => fs.unlinkSync(__dirname + "/src/meme.jpg"), messageID);
				};
				request(baseurl).pipe(fs.createWriteStream(__dirname + `/src/meme.jpg`)).on("close", callback);
			});

		//gif
		if (contentMessage.indexOf(`${prefix}gif`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (content.length == -1) return api.sendMessage(`Bạn đã nhập sai format, vui lòng ${prefix}help gif để biết thêm chi tiết!`, threadID, messageID);
			if (content.indexOf(`cat`) !== -1) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=cat&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + `/src/randompic.gif`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`dog`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=dog&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`capoo`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=capoo&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`mixi`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=mixigaming&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`bomman`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=bommanrage&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else return api.sendMessage(`Tag của bạn nhập không tồn tại, vui lòng đọc hướng dẫn sử dụng trong ${prefix}help gif`, threadID, messageID);
		}

		//hug
		if (contentMessage.indexOf(`${prefix}hug`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/hug', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", I wanna hug you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//kiss
		if (contentMessage.indexOf(`${prefix}kiss`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/kiss', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 6, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", I wanna kiss you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//tát
		if (contentMessage.indexOf(`${prefix}slap`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/slap', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", take this slap 😈",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//meow
		if (contentMessage.indexOf(`${prefix}meow`) == 0)
			return request('http://aws.random.cat/meow', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.file;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let callback = function() {
					api.sendMessage({
						attachment: fs.createReadStream(__dirname + `/src/meow.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/meow.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/meow.${ext}`)).on("close", callback);
			});

		//sauce
		if (contentMessage == `${prefix}sauce`) {
			const sagiri = require('sagiri'), search = sagiri(saucenao);
			if (event.type != "message_reply") return api.sendMessage(`Vui lòng bạn reply bức ảnh cần phải tìm!`, threadID, messageID);
			if (event.messageReply.attachments.length > 1) return api.sendMessage(`Vui lòng reply chỉ một ảnh!`, threadID, messageID);
			if (event.messageReply.attachments[0].type == 'photo') {
				if (saucenao == '' || typeof saucenao == 'undefined') return api.sendMessage(`Chưa có api của saucenao!`, threadID, messageID);
				return search(event.messageReply.attachments[0].url).then(response => {
					let data = response[0];
					let results = {
						similarity: data.similarity,
						material: data.raw.data.material || 'Không có',
						characters: data.raw.data.characters || 'Original',
						creator: data.raw.data.creator || 'Không biết',
						site: data.site,
						url: data.url
					};
					const minSimilarity = 50;
					if (minSimilarity <= ~~results.similarity) {
						api.sendMessage(
							'Đây là kết quả tìm kiếm được\n' +
							'-------------------------\n' +
							'- Độ tương tự: ' + results.similarity + '%\n' +
							'- Material: ' + results.material + '\n' +
							'- Characters: ' + results.characters + '\n' +
							'- Creator: ' + results.creator + '\n' +
							'- Original site: ' + results.site + ' - ' + results.url,
							threadID, messageID
						);
					}
					else api.sendMessage(`Không thấy kết quả nào trùng với ảnh bạn đang tìm kiếm :'(`, threadID, messageID);
				});
			}
		}

		//change-my-mind
		if (contentMessage.indexOf(`${prefix}change-mind`) == 0) {
			var content = contentMessage.slice(prefix.length + 12, contentMessage.length);
			const { createCanvas, loadImage, registerFont } = require('canvas');
			const path = require('path');
			const __root = path.resolve(__dirname, "../material");
			let pathImg = __root + `/result.png`;
			registerFont(__root + '/fonts/Noto-Regular.ttf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-CJK.otf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-Emoji.ttf', { family: 'Noto' });
			const base = await loadImage(__root + "/meme/change-my-mind.png");
			const canvas = createCanvas(base.width, base.height);
			const ctx = canvas.getContext('2d');
			ctx.textBaseline = 'top';
			ctx.drawImage(base, 0, 0);
			ctx.rotate(-6 * (Math.PI / 180));
			ctx.font = '28px Noto';
			let fontSize = 28;
			while (ctx.measureText(content).width > 309) {
				fontSize--;
				ctx.font = `${fontSize}px Noto`;
			}
			const lines = await Image.wrapText(ctx, content, 206);
			ctx.fillText(lines.join('\n'), 184, 253, 206);
			ctx.rotate(6 * (Math.PI / 180));
			const imageBuffer = canvas.toBuffer();
			fs.writeFileSync(pathImg, imageBuffer);
			return api.sendMessage({
				attachment: fs.createReadStream(pathImg)
			}, threadID, () => fs.unlinkSync(pathImg), messageID);
		}

		//two-buttons
		if (contentMessage.indexOf(`${prefix}buttons`) == 0) {
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var split = content.split(" | ");
			var first = split[0];
			var second = split[1];
			const { createCanvas, loadImage, registerFont } = require('canvas');
			const path = require('path');
			const __root = path.resolve(__dirname, "../material");
			let pathImg = __root + `/result.png`;
			registerFont(__root + '/fonts/Noto-Regular.ttf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-CJK.otf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-Emoji.ttf', { family: 'Noto' });
			const base = await loadImage(__root + "/meme/two-buttons.png");
			const canvas = createCanvas(base.width, base.height);
			const ctx = canvas.getContext('2d');
			ctx.textBaseline = 'top';
			ctx.drawImage(base, 0, 0);
			ctx.rotate(-12 * (Math.PI / 180));
			ctx.font = '34px Noto';
			let fontSize = 34;
			while (ctx.measureText(first).width > 366) {
				fontSize--;
				ctx.font = `${fontSize}px Noto`;
			}
			const firstLines = await Image.wrapText(ctx, first, 183);
			let lineOffset = 0;
			for (let i = 0; i < firstLines.length; i++) {
				ctx.fillText(firstLines[i], 25 + lineOffset, 116 + (fontSize * i) + (10 * i), 183);
				lineOffset += 5;
			}
			ctx.font = '34px Noto';
			fontSize = 34;
			while (ctx.measureText(second).width > 244) {
				fontSize--;
				ctx.font = `${fontSize}px Noto`;
			}
			const secondLines = await Image.wrapText(ctx, second, 118);
			lineOffset = 0;
			for (let i = 0; i < secondLines.length; i++) {
				ctx.fillText(secondLines[i], 254 + lineOffset, 130 + (fontSize * i) + (10 * i), 118);
				lineOffset += 5;
			}
			ctx.rotate(12 * (Math.PI / 180));
			const imageBuffer = canvas.toBuffer();
			fs.writeFileSync(pathImg, imageBuffer);
			return api.sendMessage({
				attachment: fs.createReadStream(pathImg)
			}, threadID, () => fs.unlinkSync(pathImg), messageID);
		}

		//new-password
		if (contentMessage.indexOf(`${prefix}new-pwd`) == 0) {
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var split = content.split(" | ");
			var weak = split[0];
			var strong = split[1];
			const { createCanvas, loadImage, registerFont } = require('canvas');
			const path = require('path');
			const __root = path.resolve(__dirname, "../material");
			let pathImg = __root + `/result.png`;
			registerFont(__root + '/fonts/Noto-Regular.ttf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-CJK.otf', { family: 'Noto' });
			registerFont(__root + '/fonts/Noto-Emoji.ttf', { family: 'Noto' });
			const base = await loadImage(__root + "/meme/new-password.png");
			const canvas = createCanvas(base.width, base.height);
			const ctx = canvas.getContext('2d');
			ctx.drawImage(base, 0, 0);
			ctx.font = '25px Noto';
			ctx.fillText(Image.shortenText(ctx, weak, 390), 40, 113);
			ctx.fillText(Image.shortenText(ctx, strong, 390), 40, 351);
			const imageBuffer = canvas.toBuffer();
			fs.writeFileSync(pathImg, imageBuffer);
			return api.sendMessage({
				attachment: fs.createReadStream(pathImg)
			}, threadID, () => fs.unlinkSync(pathImg), messageID);
		}

	/* ==================== General Commands ================*/
	
		//shortcut
		if (contentMessage.indexOf(`${prefix}short`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (!content) return api.sendMessage(`Không đúng format. Hãy tìm hiểu thêm tại ${prefix}help short.`, threadID, messageID);
			if (content.indexOf(`del`) == 0) {
				let delThis = contentMessage.slice(prefix.length + 10, contentMessage.length);
				if (!delThis) return api.sendMessage("Chưa nhập shortcut cần xóa.", threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					var getThread = oldData.find(item => item.id == threadID).shorts;
					if (!getThread.some(item => item.in == delThis)) return api.sendMessage("Shortcut này không tồn tại.", threadID, messageID);
					getThread.splice(getThread.findIndex(item => item.in === delThis), 1);
					fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Xóa shortcut thành công!", threadID, messageID));
				});
			}
			else if (content.indexOf(`all`) == 0) 
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					let allData = JSON.parse(data);
					let msg = '';
					if (!allData.some(item => item.id == threadID)) return api.sendMessage('Hiện tại không có shortcut nào.', threadID, messageID);
					if (allData.some(item => item.id == threadID)) {
						let getThread = allData.find(item => item.id == threadID).shorts;
						getThread.forEach(item => msg = msg + item.in + ' -> ' + item.out + '\n');
					}
					if (!msg) return api.sendMessage('Hiện tại không có shortcut nào.', threadID, messageID);
					msg = 'Tất cả shortcut đang có trong group là:\n' + msg;
					api.sendMessage(msg, threadID, messageID);
				});
			else {
				let narrow = content.indexOf(" => ");
				if (narrow == -1) return api.sendMessage(`Không đúng format. Hãy tìm hiểu thêm tại ${prefix}help short.`, threadID, messageID);
				let shortin = content.slice(0, narrow);
				let shortout = content.slice(narrow + 4, content.length);
				if (shortin == shortout) return api.sendMessage('Input và output giống nhau', threadID, messageID);
				if (!shortin) return api.sendMessage("Bạn chưa nhập input.", threadID, messageID);
				if (!shortout) return api.sendMessage("Bạn chưa nhập output.", threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					if (!oldData.some(item => item.id == threadID)) {
						let addThis = {
							id: threadID,
							shorts: []
						}
						addThis.shorts.push({ in: shortin, out: shortout });
						oldData.push(addThis);
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Tạo shortcut mới thành công!", threadID, messageID));
					}
					else {
						let getShort = oldData.find(item => item.id == threadID);
						if (getShort.shorts.some(item => item.in == shortin)) {
							let index = getShort.shorts.indexOf(getShort.shorts.find(item => item.in == shortin));
							let output = getShort.shorts.find(item => item.in == shortin).out;
							getShort.shorts[index].out = output + " | " + shortout;
							api.sendMessage('phát hiện shortcut đã tồn tại, tiến hành ghi trùng!', threadID, messageID);
							return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8");
						}
						getShort.shorts.push({ in: shortin, out: shortout });
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Tạo shortcut mới thành công!", threadID, messageID));
					}
				});
			}
		}

		//wake time calculator
		if (contentMessage.indexOf(`${prefix}sleep`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var wakeTime = [];
			if (!content) {
				for (var i = 1; i < 7; i++) wakeTime.push(moment().utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage("Nếu bạn đi ngủ bây giờ, những thời gian hoàn hảo nhất để thức dậy là:\n" + wakeTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
			}
			else {
				if (content.indexOf(":") == -1) return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
				var contentHour = content.split(":")[0];
				var contentMinute = content.split(":")[1];
				if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2)  return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);				var getTime = moment().utcOffset("+07:00").format();
				var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
				var sleepTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
				for (var i = 1; i < 7; i++) wakeTime.push(moment(sleepTime).utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage("Nếu bạn đi ngủ vào lúc " + content + ", những thời gian hoàn hảo nhất để thức dậy là:\n" + wakeTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
			}
		}

		//sleep time calculator
		if (contentMessage.indexOf(`${prefix}wake`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content.indexOf(":") == -1) return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
			var sleepTime = [];
			var contentHour = content.split(":")[0];
			var contentMinute = content.split(":")[1];
			if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2)  return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
			var getTime = moment().utcOffset("+07:00").format();
			var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
			var wakeTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
			for (var i = 6; i > 0; i--) sleepTime.push(moment(wakeTime).utcOffset("+07:00").subtract(90 * i + 15, 'm').format("HH:mm"));
			return api.sendMessage("Nếu bạn muốn thức dậy vào lúc " + content + ", những thời gian hoàn hảo nhất để đi ngủ là:\n" + sleepTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
		}

		//prefix
		if (contentMessage == 'prefix') return api.sendMessage(`Prefix là: ${prefix}`, threadID, messageID);

		//credits
		if (contentMessage == "credits") return api.sendMessage("Project Mirai được thực hiện bởi:\nSpermLord: https://fb.me/MyNameIsSpermLord\nCatalizCS: https://fb.me/Cataliz2k\nFull source code at: https://github.com/roxtigger2003/mirai", threadID, messageID);

		//random name
		if (contentMessage.indexOf(`${prefix}rname`) == 0) return request(`https://uzby.com/api.php?min=4&max=12`, (err, response, body) => api.changeNickname(`${body}`, threadID, senderID));

		//sim on
		if (contentMessage == `${prefix}sim on`) {
			__GLOBAL.simOn.push(threadID);
			return api.sendMessage(`đã bật sim`, threadID);
		}

		//sim off
		if (contentMessage == `${prefix}sim off`) {
			__GLOBAL.simOn.splice(__GLOBAL.simOn.indexOf(threadID), 1);
			return api.sendMessage(`đã tắt sim`, threadID);
		}

		//simsimi
		if (contentMessage.indexOf(`${prefix}sim`) == 0) return request(`https://simsumi.herokuapp.com/api?text=${encodeURIComponent(contentMessage.slice(prefix.length + 4, contentMessage.length))}&lang=vi`, (err, response, body) => api.sendMessage((JSON.parse(body).success != '') ? JSON.parse(body).success : 'Không có câu trả lời nào.', threadID, messageID));

		//mit
		if (contentMessage.indexOf(`${prefix}mit`) == 0) return request(`https://kakko.pandorabots.com/pandora/talk-xml?input=${encodeURIComponent(contentMessage.slice(prefix.length + 4, contentMessage.length))}&botid=9fa364f2fe345a10&custid=${senderID}`, (err, response, body) => api.sendMessage((/<that>(.*?)<\/that>/.exec(body)[1]), threadID, messageID));

		//penis
		if (contentMessage.indexOf(`${prefix}penis`) == 0) return api.sendMessage(`8${'='.repeat(Math.floor(Math.random() * 10))}D`, threadID, messageID);

		//reminder
		if (contentMessage.indexOf(`${prefix}reminder`) == 0) {
			const time = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (isNaN(time)) return api.sendMessage(`thời gian bạn nhập không phải là một con số!`, threadID, messageID);
			const display = time > 59 ? `${time / 60} phút` : `${time} giây`;
			api.sendMessage(`tôi sẽ nhắc bạn sau: ${display}`, threadID, messageID);
			await new Promise(resolve => setTimeout(resolve, time * 1000));
			api.sendMessage({
				body: `Người lạ ơi, có vẻ bạn đã nhờ tôi nhắc bạn làm việc gì đó thì phải?`,
				mentions: [{
					tag: 'Người lạ ơi',
					id: senderID
				}]
			}, threadID, messageID);
		}

		//random màu cho theme chat
		if (contentMessage == `${prefix}randomcolor`) {
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			return api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID, (err) => (err) ? api.sendMessage('Đã có lỗi không mong muốn đã xảy ra', threadID, messageID) : '');
		}

		//poll
		if (contentMessage.indexOf(`${prefix}poll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var title = content.slice(0, content.indexOf(" -> "));
			var options = content.substring(content.indexOf(" -> ") + 4)
			var option = options.split(" | ");
			var object = {};
			if (option.length == 1 && option[0].includes(' |')) option[0] = option[0].replace(' |', '');
			for (var i = 0; i < option.length; i++) object[option[i]] = false;
			return api.createPoll(title, threadID, object, (err) => (err) ? api.sendMessage("Có lỗi xảy ra vui lòng thử lại", threadID, messageID) : '');
		}

		//rainbow
		if (contentMessage.indexOf(`${prefix}rainbow`) == 0) {
			var value = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (isNaN(value)) return api.sendMessage('Dữ liệu không phải là một con số', threadID, messageID);
			if (value > 10000) return api.sendMessage('Dữ liệu phải nhỏ hơn 10000!', threadID, messageID);
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			for (var i = 0; i < value; i++) {
				api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID)
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
			return;
		}

		//giveaway
		if (contentMessage.indexOf(`${prefix}ga`) == 0) {
			var content = contentMessage.slice(prefix.length + 3, contentMessage.length);
			api.getThreadInfo(threadID,async function(err, info) {
				if (err) return api.sendMessage(`Đã xảy ra lỗi không mong muốn`, threadID, messageID);
				let winner = info.participantIDs[Math.floor(Math.random() * info.participantIDs.length)];
				let userInfo = await User.getInfo(winner);
				var name = userInfo.name;
				api.sendMessage({
					body: `Yahoo ${name}, bạn đã thắng giveaway! phần thưởng là: "${content}" 🥳🥳.`,
					mentions: [{
						tag: name,
						id: winner
					}]
				}, threadID, messageID);
			});
			return;
		}

		//thời tiết
		if (contentMessage.indexOf(`${prefix}weather`) == 0) {
			var city = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (city.length == 0) return api.sendMessage(`Bạn chưa nhập địa điểm, hãy đọc hướng dẫn tại ${prefix}help weather!`,threadID, messageID);
			request(encodeURI("https://api.openweathermap.org/data/2.5/weather?q=" + city + "&appid=" + openweather + "&units=metric&lang=vi"), (err, response, body) => {
				if (err) throw err;
				var weatherData = JSON.parse(body);
				if (weatherData.cod !== 200) return api.sendMessage(`Địa điểm ${city} không tồn tại!`, threadID, messageID);
				var sunrise_date = moment.unix(weatherData.sys.sunrise).tz("Asia/Ho_Chi_Minh");
				var sunset_date = moment.unix(weatherData.sys.sunset).tz("Asia/Ho_Chi_Minh");
				api.sendMessage({
					body: '🌡 Nhiệt độ: ' + weatherData.main.temp + '°C' + '\n' +
								'🌡 Nhiệt độ cơ thể cảm nhận được: ' + weatherData.main.feels_like + '°C' + '\n' +
								'☁️ Bầu trời hiện tại: ' + weatherData.weather[0].description + '\n' +
								'💦 Độ ẩm: ' + weatherData.main.humidity + '%' + '\n' +
								'💨 Tốc độ gió: ' + weatherData.wind.speed + 'km/h' + '\n' +
								'🌅 Mặt trời mọc vào lúc: ' + sunrise_date.format('HH:mm:ss') + '\n' +
								'🌄 Mặt trời lặn vào lúc: ' + sunset_date.format('HH:mm:ss') + '\n',
					location: {
						latitude: weatherData.coord.lat,
						longitude: weatherData.coord.lon,
						current: true
					},
				}, threadID, messageID);
			});
			return;
		}

		//say
		if (contentMessage.indexOf(`${prefix}say`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 4, contentMessage.length);
			var languageToSay = (["ru","en","ko","ja"].some(item => content.indexOf(item) == 0)) ? content.slice(0, content.indexOf(" ")) : 'vi';
			var msg = (languageToSay != 'vi') ? content.slice(3, contentMessage.length) : content;
			var callback = () => api.sendMessage({body: "", attachment: fs.createReadStream(__dirname + "/src/say.mp3")}, threadID, () => fs.unlinkSync(__dirname + "/src/say.mp3"));
			return request(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(msg)}&tl=${languageToSay}&client=tw-ob`).pipe(fs.createWriteStream(__dirname+'/src/say.mp3')).on('close',() => callback());
		}

		//cập nhật tình hình dịch
		if (contentMessage == `${prefix}covid-19`)
			return request("https://code.junookyo.xyz/api/ncov-moh/data.json", (err, response, body) => {
				if (err) throw err;
				var data = JSON.parse(body);
				api.sendMessage(
					"Thế giới:" +
					"\n- Nhiễm: " + data.data.global.cases +
					"\n- Chết: " + data.data.global.deaths +
					"\n- Hồi phục: " + data.data.global.recovered +
					"\nViệt Nam:" +
					"\n- Nhiễm: " + data.data.vietnam.cases +
					"\n- Chết: " + data.data.vietnam.deaths +
					"\n- Phục hồi: " + data.data.vietnam.recovered,
					threadID, messageID
				);
			});

		//chọn
		if (contentMessage.indexOf(`${prefix}choose`) == 0) {
			var input = contentMessage.slice(prefix.length + 7, contentMessage.length).trim();
			if (!input)return api.sendMessage(`Bạn không nhập đủ thông tin kìa :(`,threadID,messageID);
			var array = input.split(" | ");
			return api.sendMessage(`Hmmmm, em sẽ chọn giúp cho là: ` + array[Math.floor(Math.random() * array.length)] + `.`,threadID,messageID);
		}

		//waifu
		if (contentMessage == `${prefix}waifu`) {
			var route = Math.round(Math.random() * 10);
			if (route == 1 || route == 0 || route == 3) return api.sendMessage("Dạ em sẽ làm vợ anh <3\nYêu chàng nhiều <3", threadID, messageID);
			else if (route == 2 || route > 4) return api.sendMessage("Chúng ta chỉ là bạn thôi :'(", threadID, messageID);
		}

		//ramdom con số
		if (contentMessage.indexOf(`${prefix}roll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (!content) return api.sendMessage(`uwu con số đẹp nhất em chọn được là: ${Math.floor(Math.random() * 99)}`, threadID, messageID);
			var splitContent = content.split(" ");
			if (splitContent.length != 2) return api.sendMessage(`Sai format, bạn hãy đọc hướng dẫn trong ${prefix}help roll để biết thêm chi tiết.`, threadID, messageID)
			var min = parseInt(splitContent[0]);
			var max = parseInt(splitContent[1]);
			if (isNaN(min) || isNaN(max)) return api.sendMessage('Dữ liệu bạn nhập không phải là một con số.', threadID, messageID);
			if (min >= max) return api.sendMessage('Oops, số kết thúc của bạn lớn hơn hoặc bằng số bắt đầu.', threadID, messageID);
			return api.sendMessage(`uwu con số đẹp nhất em chọn được là: ${Math.floor(Math.random() * (max - min + 1) + min)}`, threadID, messageID);
		}

		//Khiến bot nhái lại tin nhắn bạn
		if (contentMessage.indexOf(`${prefix}echo`) == 0) return api.sendMessage(contentMessage.slice(prefix.length + 5, contentMessage.length), threadID);

		//rank
		if (contentMessage.indexOf(`${prefix}rank`) == 0) {
			const createCard = require("../controllers/rank_card.js");
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			let all = await User.getUsers(['uid', 'point']);
			let target;
			all.sort((a, b) => {
				if (a.point > b.point) return -1;
				if (a.point < b.point) return 1;
				if (a.uid > b.uid) return 1;
				if (a.uid < b.uid) return -1;
			});
			if (!content) {
				let rank = all.findIndex(item => item.uid == senderID) + 1;
				let name = await User.getName(senderID);
				if (rank == 0) api.sendMessage('Bạn hiện chưa có trong database nên không thể xem rank, hãy thử lại sau 5 giây.', threadID, messageID);
				else Rank.getInfo(senderID).then(point => createCard({ id: senderID, name, rank, ...point })).then(path => api.sendMessage({attachment: fs.createReadStream(path)}, threadID, () => fs.unlinkSync(path), messageID));
			}
			else {
				let mentions = Object.keys(event.mentions);
				mentions.forEach(i => {
					let name = event.mentions[i].replace('@', '');
					let rank = all.findIndex(item => item.uid == i) + 1;
					if (rank == 0) api.sendMessage(name + ' chưa có trong database nên không thể xem rank.', threadID, messageID);
					else Rank.getInfo(i).then(point => createCard({ id: parseInt(i), name, rank, ...point })).then(path => api.sendMessage({attachment: fs.createReadStream(path)}, threadID, () => fs.unlinkSync(path), messageID));
				});
			}
			return;
		}

		//dịch ngôn ngữ
		if (contentMessage.indexOf(`${prefix}trans`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (content.length == 0 && event.type != "message_reply") return api.sendMessage(`Bạn chưa nhập thông tin, vui lòng đọc ${prefix}help để biết thêm chi tiết!`, threadID,messageID);
			var translateThis = content.slice(0, content.indexOf(" ->"));
			var lang = content.substring(content.indexOf(" -> ") + 4);
			if (event.type == "message_reply") {
				translateThis = event.messageReply.body
				if (content.indexOf(" -> ") != -1) lang = content.substring(content.indexOf(" -> ") + 4);
				else lang = 'vi';
			}
			else if (content.indexOf(" -> ") == -1) {
				translateThis = content.slice(0, content.length)
				lang = 'vi';
			}
			return request(encodeURI(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${translateThis}`), (err, response, body) => {
				if (err) return api.sendMessage("Đã có lỗi xảy ra!", threadID, messageID)
				var retrieve = JSON.parse(body);
				var fromLang = retrieve[0][0][8][0][0][1].split("_")[0];
				api.sendMessage(`Bản dịch: ${retrieve[0][0][0]}\n - được dịch từ ${fromLang} sang ${lang}`, threadID, messageID);
			});
		}

		//uptime
		if (contentMessage == `${prefix}uptime`) {
			var time = process.uptime();
			var hours = Math.floor(time / (60*60));
			var minutes = Math.floor((time % (60 * 60)) / 60);
			var seconds = Math.floor(time % 60);
			return api.sendMessage("Bot đã hoạt động được " + hours + " giờ " + minutes + " phút " + seconds + " giây.", threadID, messageID);
		}

		//unsend message
		if (contentMessage.indexOf(`${prefix}gỡ`) == 0) {
			if (event.messageReply.senderID != api.getCurrentUserID()) return api.sendMessage("Không thể gỡ tin nhắn của người khác", threadID, messageID);
			if (event.type != "message_reply") return api.sendMessage("Phản hồi tin nhắn cần gỡ", threadID, messageID);
			return api.unsendMessage(event.messageReply.messageID, err => (err) ? api.sendMessage("Không thể gỡ tin nhắn này vì đã quá 10 phút!", threadID, messageID) : '');
		}

		//get uid
		if (contentMessage.indexOf(`${prefix}uid`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (!content) return api.sendMessage(`${senderID}`, threadID, messageID);
			else if (content.indexOf("@") !== -1) {
				for (var i = 0; i < Object.keys(event.mentions).length; i++) api.sendMessage(`${Object.keys(event.mentions)[i]}`, threadID, messageID);
				return;
			}
		}

		//wiki
		if (contentMessage.indexOf(`${prefix}wiki`) == 0) {
			const wiki = require("wikijs").default;
			var url = 'https://vi.wikipedia.org/w/api.php';
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (contentMessage.indexOf("-en") == 6) {
				url = 'https://en.wikipedia.org/w/api.php';
				content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			}
			if (!content) return api.sendMessage("Nhập thứ cần tìm!", threadID, messageID);
			return wiki({apiUrl: url}).page(content).catch((err) => api.sendMessage("Không tìm thấy " + content, threadID, messageID)).then(page => (typeof page != 'undefined') ? Promise.resolve(page.summary()).then(val => api.sendMessage(val, threadID, messageID)) : '');
		}

		//ping
		if (contentMessage.indexOf(`${prefix}ping`) == 0)
			return api.getThreadInfo(threadID, (err, info) => {
				if (err) return api.sendMessage('Đã có lỗi xảy ra!.', threadID, messageID);
				var ids = info.participantIDs;
				ids.splice(ids.indexOf(api.getCurrentUserID()), 1);
				var body = 'Minh Man Yeu Tat Ca Moi Nguoi', mentions = [];
				for (let i = 0; i < ids.length; i++) {
					if (i == body.length) body += ' i ';
					mentions.push({
						tag: body[i],
						id: ids[i],
						fromIndex: i
					});
				}
				api.sendMessage({body, mentions}, threadID, messageID);
			});

		//look earth
		if (contentMessage == `${prefix}earth`)
			return request(`https://api.nasa.gov/EPIC/api/natural/images?api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				var randomNumber = Math.floor(Math.random() * ((jsonData.length -1) + 1));
				var image_name = jsonData[randomNumber].image
				var date = jsonData[randomNumber].date;
				var date_split = date.split("-")
				var year = date_split[0];
				var month = date_split[1];
				var day_and_time = date_split[2];
				var sliced_date = day_and_time.slice(0, 2);
				var image_link = `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${sliced_date}/png/` + image_name + ".png";
				let callback = function() {
					api.sendMessage({
						body: `${jsonData[randomNumber].caption} on ${date}`,
						attachment: fs.createReadStream(__dirname + `/src/randompic.png`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/randompic.png`), messageID);
				};
				request(image_link).pipe(fs.createWriteStream(__dirname + `/src/randompic.png`)).on("close", callback);
			});

		//localtion iss
		if (contentMessage == `${prefix}iss`) {
			return request(`http://api.open-notify.org/iss-now.json`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(`Vị trí hiện tại của International Space Station 🌌🌠🌃\nVĩ độ: ${jsonData.iss_position.latitude} | Kinh độ: ${jsonData.iss_position.longitude}`, threadID, messageID);
			});
		}

		//near-earth obj
		if (contentMessage == `${prefix}neo`) {
			return request(`https://api.nasa.gov/neo/rest/v1/feed/today?detailed=true&api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(`Hiện tại đang có tổng cộng: ${jsonData.element_count} vật thể đang ở gần trái đất ngay lúc này!`, threadID, messageID);
			});
		}

		//spacex
		if (contentMessage == `${prefix}spacex`) {
			return request(`https://api.spacexdata.com/v3/launches/latest`, (err, response, body) => {
				if (err) throw err;
				var data = JSON.parse(body);
				api.sendMessage(
					"Thông tin đợt phóng mới nhất của SpaceX:" +
					"\n- Mission: " + data.mission_name +
					"\n- Năm phóng: " + data.launch_year +
					"\n- Thời gian phóng: " + data.launch_date_local +
					"\n- Tên lửa: " + data.rocket.rocket_name +
					"\n- Link Youtube: " + data.links.video_link,
				threadID, messageID);
			});
		}

		//afk
		if (contentMessage.indexOf(`${prefix}afk`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (content) {
				await User.updateReason(senderID, content);
				api.sendMessage(`🛠 | Bạn đã bật mode afk với lý do: ${content}`, threadID, messageID);
			}
			else {
				await User.updateReason(senderID, 'none');
				api.sendMessage(`🛠 | Bạn đã bật mode afk`, threadID, messageID);
			}
			await User.afk(senderID);
			__GLOBAL.afkUser.push(parseInt(senderID));
			return;
		}

		/* ==================== Game Commands ==================== */

		//osu!
		if (contentMessage.indexOf(`osu!`) == 0) {
			if (!contentMessage.slice(5, contentMessage.length)) return api.sendMessage(`Bạn chưa nhập username!`, threadID, messageID);
			return request(`http://lemmmy.pw/osusig/sig.php?colour=hex8866ee&uname=${contentMessage.slice(5, contentMessage.length)}&pp=1&countryrank&rankedscore&onlineindicator=undefined&xpbar&xpbarhex`).pipe(fs.createWriteStream(__dirname + `/src/osu!.png`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/osu!.png`)}, threadID, () => fs.unlinkSync(__dirname + `/src/osu!.png`), messageID))
		}

		/* ==================== Study Commands ==================== */

		//toán học
		if (contentMessage.indexOf(`${prefix}math`) == 0) {
			const wolfram = "http://api.wolframalpha.com/v2/result?appid=" + wolfarm + "&i=";
			var m = contentMessage.slice(prefix.length + 5, contentMessage.length);
			request(wolfram + encodeURIComponent(m), function(err, response, body) {
				if (body.toString() === "Wolfram|Alpha did not understand your input") return api.sendMessage("Tôi chả hiểu bạn đang đưa thứ gì cho tôi nữa", threadID, messageID);
				else if (body.toString() === "Wolfram|Alpha did not understand your input") return api.sendMessage("Tôi không hiểu câu hỏi của bạn", threadID, messageID);
				else if (body.toString() === "My name is Wolfram Alpha.") return api.sendMessage("Tên tôi là Mirai", threadID, messageID);
				else if (body.toString() === "I was created by Stephen Wolfram and his team.") return api.sendMessage("Tôi được làm ra bởi CatalizCS và SpermLord", threadID, messageID);
				else if (body.toString() === "I am not programmed to respond to this dialect of English.") return api.sendMessage("Tôi không được lập trình để nói những thứ như này", threadID, messageID);
				else if (body.toString() === "StringJoin(CalculateParse`Content`Calculate`InternetData(Automatic, Name))") return api.sendMessage("Tôi không biết phải trả lời như nào", threadID, messageID);
				else return api.sendMessage(body, threadID, messageID);
			});
		}

		//cân bằng phương trình hóa học
		if (contentMessage.indexOf(`${prefix}chemeb`) == 0) {
			console.log = () => {};
			const chemeb = require('chem-eb');
			if (event.type == "message_reply") {
				var msg = event.messageReply.body;
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage('Hiện tại không hỗ trợ phương trình tối giản. Hãy chuyển (XY)z về dạng XzYz.', threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
			else {
				var msg = contentMessage.slice(prefix.length + 7, contentMessage.length);
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage('Hiện tại không hỗ trợ phương trình tối giản. Hãy chuyển (XY)z về dạng XzYz.', threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
		}

		//do math
		if (contentMessage.indexOf(`${prefix}domath`) == 0) {
			const content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			let difficulty, answer, value1, value2;
			const difficulties = ['baby', 'easy', 'medium', 'hard', 'extreme', 'impossible'];
			(difficulties.some(item => content == item)) ? difficulty = content : difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
			const operations = ['+', '-', '*'];
			const maxValues = { baby: 10, easy: 50, medium: 100, hard: 500, extreme: 1000, impossible: Number.MAX_SAFE_INTEGER };
			const maxMultiplyValues = { baby: 5, easy: 12, medium: 30, hard: 50, extreme: 100, impossible: Number.MAX_SAFE_INTEGE };
			const operation = operations[Math.floor(Math.random() * operations.length)];
			value1 = Math.floor(Math.random() * maxValues[difficulty] - 1) + 1;
			value2 = Math.floor(Math.random() * maxValues[difficulty] -1 ) + 1;
			switch (operation) {
				case '+':
				answer = value1 + value2;
				break;
				case '-':
				answer = value1 - value2;
				break;
				case '*':
				answer = value1 * value2;
				break;
			}
			return api.sendMessage(
				'== Bạn có 50 giây để trả lời ==' +
				`\n ${value1} ${operation} ${value2} = ?`,
				threadID, (err, info) => __GLOBAL.reply.push({ type: "domath", messageID: info.messageID, target: parseInt(threadID), author: senderID, answer }),
				messageID
			)
		}

	/* ==================== NSFW Commands ==================== */

		//nhentai search
		if (contentMessage.indexOf(`${prefix}nhentai`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			let id = contentMessage.slice(prefix.length + 8, contentMessage.length).trim();
			if (!id) return api.sendMessage(`Code lý tưởng để bắn tung toé là: ${Math.floor(Math.random() * 99999)}`, threadID, messageID);
			return request(`https://nhentai.net/api/gallery/${id}`, (error, response, body) => {
				var codeData = JSON.parse(body);
				if (codeData.error == true) return api.sendMessage("Không tìm thấy truyện này", threadID, messageID);
				let title = codeData.title.pretty;
				let tagList = [];
				let artistList = [];
				let characterList = [];
				codeData.tags.forEach(item => (item.type == "tag") ? tagList.push(item.name) : (item.type == "artist") ? artistList.push(item.name) : (item.type == "character") ? characterList.push(item.name) : '');
				var tags = tagList.join(', ');
				var artists = artistList.join(', ');
				var characters = characterList.join(', ');
				if (characters == '') characters = 'Original';
				api.sendMessage("Tiêu đề: " + title, threadID, () => {
					api.sendMessage("Tác giả: " + artists, threadID, () => {
						api.sendMessage("Nhân vật: " + characters, threadID, () => {
							api.sendMessage("Tags: " + tags, threadID, () => {
								api.sendMessage("Link: https://nhentai.net/g/" + id, threadID);
							});
						});
					});
				}, messageID);
			});
		}

		//hentaivn
		if (contentMessage.indexOf(`${prefix}hentaivn`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			const cheerio = require('cheerio');
			var id = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (!id) return api.sendMessage("Nhập id!", threadID, messageID);
			if (!id) return api.sendMessage(`Code lý tưởng để bắn tung toé là: ${Math.floor(Math.random() * 21553)}`, threadID, messageID);
			axios.get(`https://hentaivn.net/id${id}`).then((response) => {
				if (response.status == 200) {
					const html = response.data;
					const $ = cheerio.load(html);
					var getContainer = $('div.container');
					var getURL = getContainer.find('form').attr('action');
					if (getURL == `https://hentaivn.net/${id}-doc-truyen-.html`) return api.sendMessage("Không tìm thấy truyện này", threadID, messageID);
					axios.get(getURL).then((response) => {
						if (response.status == 200) {
							const html = response.data;
							const $ = cheerio.load(html);
							var getInfo = $('div.container div.main div.page-info');
							var getUpload = $('div.container div.main div.page-uploader');
							var getName = getInfo.find('h1').find('a').text();
							var getTags = getInfo.find('a.tag').contents().map(function() {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							var getArtist = getInfo.find('a[href^="/tacgia="]').contents().map(function () {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							var getChar = getInfo.find('a[href^="/char="]').contents().map(function () {
								return (this.type === 'text') ? $(this).text() + '' : '';
							}).get().join(', ');
							if (getChar == '') getChar = 'Original';
							var getLikes = getUpload.find('div.but_like').text();
							var getDislikes = getUpload.find('div.but_unlike').text();
							return api.sendMessage("Tên: " + getName.substring(1), threadID, () => {
								api.sendMessage("Tác giả: " + getArtist, threadID, () => {
									api.sendMessage("Nhân vật: " + getChar, threadID, () => {
										api.sendMessage("Tags: " + getTags, threadID, () => {
											api.sendMessage("Số Like: " + getLikes.substring(1) + "\nSố Dislike: " + getDislikes.substring(1), threadID, () => {
												api.sendMessage(getURL.slice(0, 17) + " " + getURL.slice(17), threadID);
											});
										});
									});
								});
							}, messageID);
						}
					}, (error) => console.log(error));
				}
			}, (error) => console.log(error));
			return;
		}

		//porn pics
		if (contentMessage.indexOf(`${prefix}porn`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			return Nsfw.pornUseLeft(senderID).then(useLeft => {
				if (useLeft == 0) return api.sendMessage(`Bạn đã hết số lần dùng ${prefix}porn.\nHãy nâng cấp lên Hạng NSFW cao hơn hoặc chờ đến ngày mai.`, threadID, messageID);
				const cheerio = require('cheerio');
				const ffmpeg = require("fluent-ffmpeg");
				const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
				ffmpeg.setFfmpegPath(ffmpegPath);
				var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
				var album = {
					'asian': "9057591",
					'ass': "2830292",
					'bdsm': "17510771",
					'bj': "3478991",
					'boobs': "15467902",
					'cum': "1036491",
					'feet': "852341",
					'gay': "19446301",
					'pornstar': "20404671",
					'pussy': "1940602",
					'sex': "2132332",
					'teen': "17887331"
				};
				if (!content || !album.hasOwnProperty(content)) {
					let allTags = [];
					Object.keys(album).forEach((item) => allTags.push(item));
					var pornTags = allTags.join(', ');
					return api.sendMessage('=== Tất cả các tag Porn ===\n' + pornTags, threadID, messageID);
				}
				axios.get(`https://www.pornhub.com/album/${album[content]}`).then((response) => {
					if (useLeft != -1) Nsfw.subtractPorn(senderID);
					if (response.status == 200) {
						const html = response.data;
						const $ = cheerio.load(html);
						var result = [];
						let list = $('ul.photosAlbumsListing li.photoAlbumListContainer div.photoAlbumListBlock');
						list.map(index => {
							let item = list.eq(index);
							if (!item.length) return;
							let photo = `${item.find('a').attr('href')}`;
							result.push(photo);
						});
						let getURL = "https://www.pornhub.com" + result[Math.floor(Math.random() * result.length)];
						axios.get(getURL).then((response) => {
							if (response.status == 200) {
								const html = response.data;
								const $ = cheerio.load(html);
								if (content == 'sex') {
									let video = $('video.centerImageVid');
									let mp4URL = video.find('source').attr('src');
									let ext = mp4URL.substring(mp4URL.lastIndexOf('.') + 1);
									request(mp4URL).pipe(fs.createWriteStream(__dirname + `/src/porn.${ext}`)).on('close', () => {
										ffmpeg().input(__dirname + `/src/porn.${ext}`).toFormat("gif").pipe(fs.createWriteStream(__dirname + "/src/porn.gif")).on("close", () => {
											return api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/porn.gif`)}, threadID, () => {
												fs.unlinkSync(__dirname + `/src/porn.gif`);
												fs.unlinkSync(__dirname + `/src/porn.${ext}`);
											}, messageID);
										});
									});
								}
								else {
									let image = $('div#photoWrapper');
									let imgURL = image.find('img').attr('src');
									let ext = imgURL.substring(imgURL.lastIndexOf('.') + 1);
									return request(imgURL).pipe(fs.createWriteStream(__dirname + `/src/porn.${ext}`)).on('close', () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/porn.${ext}`)}, threadID, () => fs.unlinkSync(__dirname + `/src/porn.${ext}`), messageID));
								}
							}
						}, (error) => console.log(error));
					}
					else return api.sendMessage("Đã xảy ra lỗi!", threadID, messageID);
				}, (error) => console.log(error));
			});
		}

		//hentai
		if (contentMessage.indexOf(`${prefix}hentai`) == 0) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			return Nsfw.hentaiUseLeft(senderID).then(useLeft => {
				if (useLeft == 0) return api.sendMessage(`Bạn đã hết số lần dùng ${prefix}hentai.\nHãy nâng cấp lên Hạng NSFW cao hơn hoặc chờ đến ngày mai.`, threadID, messageID);
				var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
				var jsonData = fs.readFileSync(__dirname + "/src/anime.json");
				var data = JSON.parse(jsonData).nsfw;
				if (!content || !data.hasOwnProperty(content)) {
					let nsfwList = [];
					Object.keys(data).forEach(endpoint => nsfwList.push(endpoint));
					let nsfwTags = nsfwList.join(', ');
					return api.sendMessage('=== Tất cả các tag Hentai ===\n' + nsfwTags, threadID, messageID);
				}
				request(data[content], (error, response, body) => {
					if (useLeft != -1) Nsfw.subtractHentai(senderID);
					let picData = JSON.parse(body);
					let getURL = "";
					(!picData.data) ? getURL = picData.url : getURL = picData.data.response.url;
					let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
					request(getURL).pipe(fs.createWriteStream(__dirname + `/src/hentai.${ext}`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/hentai.${ext}`)}, threadID, () => fs.unlinkSync(__dirname + `/src/hentai.${ext}`), messageID));
				});
			});
		}

		//get nsfw tier
		if (contentMessage == `${prefix}mynsfw`) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			let tier = await Nsfw.getNSFW(senderID);
			let hentai = await Nsfw.hentaiUseLeft(senderID);
			let porn = await Nsfw.pornUseLeft(senderID);
			if (tier == -1) api.sendMessage('Bạn đang ở God Mode.\nBạn sẽ không bị giới hạn số lần dùng lệnh NSFW.', threadID, messageID);
			else api.sendMessage(`Hạng NSFW của bạn là ${tier}.\nSố lần sử dụng ${prefix}porn còn lại: ${porn}.\nSố lần sử dụng ${prefix}hentai còn lại: ${hentai}.`, threadID, messageID);
			return;
		}

		//buy nsfw tier
		if (contentMessage == `${prefix}buynsfw`) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			let tier = await Nsfw.getNSFW(senderID);
			if (tier == -1) api.sendMessage('Bạn đang ở God Mode nên sẽ không thể mua.', threadID, messageID);
			else {
				let buy = await Nsfw.buyNSFW(senderID);
				if (buy == false) api.sendMessage('Đã có lỗi xảy ra!', threadID, messageID);
				else api.sendMessage(buy.toString(), threadID, messageID);
			}
			return;
		}

		//set nsfw tier
		if (contentMessage.indexOf(`${prefix}setnsfw`) == 0 && admins.includes(senderID)) {
			if (__GLOBAL.NSFWBlocked.includes(threadID)) return api.sendMessage("Nhóm này đang bị tắt NSFW!", threadID, messageID);
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var sender = content.slice(0, content.lastIndexOf(" "));
			var tierSet = content.substring(content.lastIndexOf(" ") + 1);
			if (isNaN(tierSet)) return api.sendMessage('Số hạng NSFW cần set của bạn không phải là 1 con số!', threadID, messageID);
			if (tierSet > 5 || tierSet < -1) return api.sendMessage('Hạng NSFW không được dưới -1 và vượt quá 5', threadID, messageID);
			if (tierSet == -1 && nsfwGodMode == false) return api.sendMessage('Bạn chưa bật NSFW God Mode trong config.', threadID, messageID);
			if (!mention && sender == 'me' && tierSet != -1) return api.sendMessage("Đã sửa hạng NSFW của bản thân thành " + tierSet, threadID, () => Nsfw.setNSFW(senderID, parseInt(tierSet)), messageID);
			if (!mention && sender == 'me' && tierSet == -1) return api.sendMessage("Đã bật God Mode cho bản thân!\nBạn sẽ không bị trừ số lần sử dụng lệnh NSFW.", threadID, () => Nsfw.setNSFW(senderID, parseInt(tierSet)), messageID);
			if (sender != 'me' && tierSet != -1)
				api.sendMessage({
					body: `Bạn đã sửa hạng NSFW của ${event.mentions[mention].replace("@", "")} thành ${tierSet}.`,
					mentions: [{
						tag: event.mentions[mention].replace("@", ""),
						id: mention
					}]
				}, threadID, () => Nsfw.setNSFW(mention, parseInt(tierSet)), messageID);
			if (senderID != 'me' && tierSet == -1)
				api.sendMessage({
					body: `Bạn đã bật God Mode cho ${event.mentions[mention].replace("@", "")}!\nGiờ người này có thể dùng lệnh NSFW mà không bị giới hạn!`,
					mentions: [{
						tag: event.mentions[mention].replace("@", ""),
						id: mention
					}]
				}, threadID, () => Nsfw.setNSFW(mention, parseInt(tierSet)), messageID);
		}

		/* ==================== Economy and Minigame Commands ==================== */

		//coinflip
		if (contentMessage.indexOf(`${prefix}coinflip`) == 0) return (Math.random() > 0.5) ? api.sendMessage("Mặt ngửa!", threadID, messageID) : api.sendMessage("Mặt sấp!", threadID, messageID);

		//money
		if (contentMessage.indexOf(`${prefix}money`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var mention = Object.keys(event.mentions)[0];
			if (!content) return Economy.getMoney(senderID).then((moneydb) => api.sendMessage(`Số tiền của bạn hiện đang có là: ${moneydb} đô`, threadID, messageID));
			else if (content.indexOf("@") !== -1)
				return Economy.getMoney(mention).then((moneydb) => {
					api.sendMessage({
						body: `Số tiền của ${event.mentions[mention].replace("@", "")} hiện đang có là: ${moneydb} đô.`,
						mentions: [{
							tag: event.mentions[mention].replace("@", ""),
							id: mention
						}]
					}, threadID, messageID);
				});
		}

		//daily gift
		if (contentMessage == `${prefix}daily`) {
			let cooldown = 8.64e7;
			return Economy.getDailyTime(senderID).then((lastDaily) => {
				if (lastDaily !== null && cooldown - (Date.now() - lastDaily) > 0) {
					let time = ms(cooldown - (Date.now() - lastDaily));
					api.sendMessage("Bạn đã nhận phần thưởng của ngày hôm nay, vui lòng quay lại sau: " + time.hours + " giờ " + time.minutes + " phút " + time.seconds + " giây ", threadID, messageID);
				}
				else
					api.sendMessage("Bạn đã nhận phần thưởng của ngày hôm nay. Cố gắng lên nhé <3", threadID, () => {
						Economy.addMoney(senderID, 200);
						Economy.updateDailyTime(senderID, Date.now());
						logger("User: " + senderID + " nhận daily thành công!");
					}, messageID);
			});
		}

		//work
		if (contentMessage == `${prefix}work`) {
			return Economy.getWorkTime(senderID).then((lastWork) => {
				let cooldown = 1200000;
				if (lastWork !== null && cooldown - (Date.now() - lastWork) > 0) {
					let time = ms(cooldown - (Date.now() - lastWork));
					api.sendMessage("Bạn đã thăm ngàn, để tránh bị kiệt sức vui lòng quay lại sau: " + time.minutes + " phút " + time.seconds + " giây ", threadID, messageID);
				}
				else {
					let job = [
						"bán vé số",
						"sửa xe",
						"lập trình",
						"hack facebook",
						"thợ sửa ống nước ( ͡° ͜ʖ ͡°)",
						"đầu bếp",
						"thợ hồ",
						"fake taxi",
						"gangbang người khác",
						"re sờ chym mờ",
						"bán hàng online",
						"nội trợ",
						"vả mấy thằng sao đỏ, giun vàng",
						"bán hoa",
						"tìm jav/hentai code cho SpermLord",
						"chơi Yasuo trong rank và gánh team"
					];
					let amount = Math.floor(Math.random() * 400);
					api.sendMessage(`Bạn đã làm công việc: "${job[Math.floor(Math.random() * job.length)]}" và đã nhận được số tiền là: ${amount} đô`, threadID, () => {
						Economy.addMoney(senderID, parseInt(amount));
						Economy.updateWorkTime(senderID, Date.now());
						logger("User: " + senderID + " nhận job thành công!");
					}, messageID);
				}
			});
		}

		//roulette
		if (contentMessage.indexOf(`${prefix}roul`) == 0) {
			return Economy.getMoney(senderID).then(function(moneydb) {
				var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
				if (!content) return api.sendMessage(`Bạn chưa nhập thông tin đặt cược!`, threadID, messageID);
				var color = content.split(" ")[0];
				var money = content.split(" ")[1];
				if (isNaN(money) || money.indexOf("-") !== -1) return api.sendMessage(`Số tiền đặt cược của bạn không phải là một con số, vui lòng xem lại cách sử dụng tại ${prefix}help roul`, threadID, messageID);
				if (!money || !color) return api.sendMessage("Sai format", threadID, messageID);
				if (money > moneydb) return api.sendMessage(`Số tiền của bạn không đủ`, threadID, messageID);
				if (money < 50) return api.sendMessage(`Số tiền đặt cược của bạn quá nhỏ, tối thiểu là 50 đô`, threadID, messageID);
				var check = (num) => (num == 0) ? '💙' : (num % 2 == 0 && num % 6 != 0 && num % 10 != 0) ? '♥️' : (num % 3 == 0 && num % 6 != 0) ? '💚' : (num % 5 == 0 && num % 10 != 0) ? '💛' : (num % 10 == 0) ? '💜' : '🖤️';
				let random = Math.floor(Math.random() * 50);
				
				if (color == "e" || color == "blue") color = 0;
				else if (color == "r" || color == "red") color = 1;
				else if (color == "g" || color == "green") color = 2;
				else if (color == "y" || color == "yellow") color = 3;
				else if (color == "v" || color == "violet") color = 4;
				else if (color == "b" || color == "black") color = 5;
				else return api.sendMessage("Bạn chưa nhập thông tin cá cược!, black [x0.5] red [x1] green [x1.25] yellow [x1.5] violet [x1.75] blue [x2]", threadID, messageID);
				
				if (color == 0 && check(random) == '💙') api.sendMessage(`Bạn đã chọn màu 💙, bạn đã thắng với số tiền được nhân lên 2: ${money * 2} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 2)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 2)), messageID);
				else if (color == 1 && check(random) == '♥️') api.sendMessage(`Bạn đã chọn màu ♥️, bạn đã thắng với số tiền nhân lên 1.75: ${money * 1.75} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 1.75)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 1.75)), messageID);
				else if (color == 2 && check(random) == '💚') api.sendMessage(`Bạn đã chọn màu 💚, bạn đã thắng với số tiền nhân lên 1.5: ${money * 1.5} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 1.5)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 1.5)), messageID);
				else if (color == 3 && check(random) == '💛') api.sendMessage(`Bạn đã chọn màu 💛, bạn đã thắng với số tiền nhân lên 1.25: ${money * 1.25} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 1.25)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 1.25)), messageID);
				else if (color == 4 && check(random) == '💜') api.sendMessage(`Bạn đã chọn màu 💜, bạn đã thắng với số tiền nhân lên 1: ${money} đô\nSố tiền hiện tại của bạn là: ${moneydb + money} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money)), messageID);
				else if (color == 5 && check(random) == '🖤️') api.sendMessage(`Bạn đã chọn màu 🖤️, bạn đã thắng với số tiền nhân lên 0.5: ${money * 0.5} đô\nSố tiền hiện tại của bạn là: ${moneydb + (money * 0.5)} đô.`, threadID, () => Economy.addMoney(senderID, parseInt(money * 0.5)), messageID);
				else api.sendMessage(`Màu ${check(random)}\nBạn đã ra đê ở và mất trắng số tiền: ${money} đô :'(\nSố tiền hiện tại của bạn là: ${moneydb - money} đô.`, threadID, () => Economy.subtractMoney(senderID, money), messageID)
			});
		}

		//slot
		if (contentMessage.indexOf(`${prefix}sl`) == 0) {
			const slotItems = ["🍇","🍉","🍊","🍏","7⃣","🍓","🍒","🍌","🥝","🥑","🌽"];
			return Economy.getMoney(senderID).then((moneydb) => {
				var money = contentMessage.slice(prefix.length + 3, contentMessage.length);
				if (!money) return api.sendMessage(`Bạn chưa nhập số tiền đặt cược!`, threadID, messageID);
				let win = false;
				if (isNaN(money)|| money.indexOf("-") !== -1) return api.sendMessage(`Số tiền đặt cược của bạn không phải là một con số, vui lòng xem lại cách sử dụng tại ${prefix}help sl`, threadID, messageID);
				if (!money) return api.sendMessage("Chưa nhập số tiền đặt cược!", threadID, messageID);
				if (money > moneydb) return api.sendMessage(`Số tiền của bạn không đủ`, threadID, messageID);
				if (money < 50) return api.sendMessage(`Số tiền đặt cược của bạn quá nhỏ, tối thiểu là 50 đô!`, threadID, messageID);
				let number = [];
				for (i = 0; i < 3; i++) number[i] = Math.floor(Math.random() * slotItems.length);
				if (number[0] == number[1] && number[1] == number[2]) {
					money *= 9;
					win = true;
				}
				else if (number[0] == number[1] || number[0] == number[2] || number[1] == number[2]) {
					money *= 2;
					win = true;
				}
				(win) ? api.sendMessage(`${slotItems[number[0]]} | ${slotItems[number[1]]} | ${slotItems[number[2]]}\n\nBạn đã thắng, toàn bộ ${money} đô thuộc về bạn. Số tiền hiện tại bạn có: ${moneydb + money}`, threadID, () => Economy.addMoney(senderID, parseInt(money)), messageID) : api.sendMessage(`${slotItems[number[0]]} | ${slotItems[number[1]]} | ${slotItems[number[2]]}\n\nBạn đã thua, toàn bộ ${money} đô bay vào không trung xD. Số tiền hiện tại bạn có: ${moneydb - money}`, threadID, () => Economy.subtractMoney(senderID, parseInt(money)), messageID);
			});
		}

		//pay
		if (contentMessage.indexOf(`${prefix}pay`) == 0) {
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			var moneyPay = content.substring(content.lastIndexOf(" ") + 1);
			Economy.getMoney(senderID).then((moneydb) => {
				if (!moneyPay) return api.sendMessage("Bạn chưa nhập số tiền cần chuyển!", threadID, messageID);
				if (isNaN(moneyPay) || moneyPay.indexOf("-") !== -1) return api.sendMessage(`Số tiền bạn nhập không hợp lệ, vui lòng xem lại cách sử dụng tại ${prefix}help pay`, threadID, messageID);
				if (moneyPay > moneydb) return api.sendMessage('Số tiền mặt trong người bạn không đủ, vui lòng kiểm tra lại số tiền bạn đang có!', threadID, messageID);
				if (moneyPay < 50) return api.sendMessage(`Số tiền cần chuyển của bạn quá nhỏ, tối thiểu là 50 đô!`, threadID, messageID);
				return api.sendMessage({
					body: `Bạn đã chuyển ${moneyPay} đô cho ${event.mentions[mention].replace("@", "")}.`,
					mentions: [{
						tag: event.mentions[mention].replace("@", ""),
						id: mention
					}]
				}, threadID, () => {
					Economy.addMoney(mention, parseInt(moneyPay));
					Economy.subtractMoney(senderID, parseInt(moneyPay));
				}, messageID);
			});
		}

		//setmoney
		if (contentMessage.indexOf(`${prefix}setmoney`) == 0 && admins.includes(senderID)) {
			var mention = Object.keys(event.mentions)[0];
			var content = contentMessage.slice(prefix.length + 9,contentMessage.length);
			var sender = content.slice(0, content.lastIndexOf(" "));
			var moneySet = content.substring(content.lastIndexOf(" ") + 1);
			if (isNaN(moneySet)) return api.sendMessage('Số tiền cần set của bạn không phải là 1 con số!', threadID, messageID);
			if (!mention && sender == 'me') return api.sendMessage("Đã sửa tiền của bản thân thành " + moneySet, threadID, () => Economy.setMoney(senderID, parseInt(moneySet)), messageID);
			return api.sendMessage({
				body: `Bạn đã sửa tiền của ${event.mentions[mention].replace("@", "")} thành ${moneySet} đô.`,
				mentions: [{
					tag: event.mentions[mention].replace("@", ""),
					id: mention
				}]
			}, threadID, () => Economy.setMoney(mention, parseInt(moneySet)), messageID);
		}

		// steal
		if (contentMessage == `${prefix}steal`) {
			let cooldown = 1800000;
			Economy.getStealTime(senderID).then(async function(lastSteal) {
				if (lastSteal !== null && cooldown - (Date.now() - lastSteal) > 0) {
					let time = ms(cooldown - (Date.now() - lastSteal));
					api.sendMessage("Bạn vừa ăn trộm, để tránh bị lên phường vui lòng quay lại sau: " + time.minutes + " phút " + time.seconds + " giây ", threadID, messageID);
				}
				else {
					Economy.updateStealTime(senderID, Date.now());
					let all = await User.getUsers(['uid']);
					let victim = all[Math.floor(Math.random() * all.length)].uid;
					let nameVictim = await User.getName(victim);
					if (victim == api.getCurrentUserID() && senderID == victim) return api.sendMessage("Bạn đã quay vào ô mất lượt", threadID, messageID);
					var route = Math.floor(Math.random() * 5);
					if (route > 1 || route == 0) {
						let moneydb = await Economy.getMoney(victim);
						var money = Math.floor(Math.random() * 200) + 1;
						if (moneydb <= 0 || moneydb == undefined) return api.sendMessage("Bạn trộm trúng ngay thằng nhà nghèo chả có đồng nào", threadID, messageID);
						else if (moneydb >= money) return api.sendMessage(`Bạn vừa trộm ${money} đô từ 1 thành viên trong nhóm`, threadID, () => {
							Economy.subtractMoney(victim, money);
							Economy.addMoney(senderID, parseInt(money));
						}, messageID);
						else if (moneydb < money) return api.sendMessage(`Bạn vừa trộm TẤT CẢ ${moneydb} đô của 1 thành viên trong nhóm`, threadID, () => {
							Economy.subtractMoney(victim, parseInt(moneydb));
							Economy.addMoney(senderID, parseInt(moneydb));
						}, messageID);
						else return api.sendMessage("Bạn đen vl, trộm được cục cứt xD", threadID, messageID);
					}
					else if (route == 1) {
						Economy.getMoney(senderID).then(moneydb => {
							if (moneydb <= 0) return api.sendMessage("Cần lao vi tiên thủ\nNăng cán dĩ đắc thực\nVô vi thực đầu buồi\nThực cứt thế cho nhanh", threadID, messageID);
							else if (moneydb > 0) return api.sendMessage(`Bạn bị tóm vì tội ăn trộm, mất ${moneydb} đô`, threadID, () => api.sendMessage({body: `Chúc mừng anh hùng ${nameVictim} tóm gọn tên trộm ${name} và đã nhận được tiền thưởng ${Math.floor(moneydb / 2)} đô`, mentions: [{ tag: nameVictim, id: victim}, {tag: name, id: senderID}]}, threadID, () => {
								Economy.subtractMoney(senderID, moneydb);
								Economy.addMoney(victim, parseInt(Math.floor(moneydb / 2)));
							}), messageID);
						});
					}
				}
			});
		}

		//fishing
		if (contentMessage.indexOf(`${prefix}fishing`) == 0) {
			let inventory = await Fishing.getInventory(senderID);
			let timeout = ['30000','25000','20000','15000','5000'];
			var content = contentMessage.slice(prefix.length + 8, contentMessage.length);
			var rodLevel = inventory.rod - 1;
			if (!content) {
				if (inventory.rod == 0) return api.sendMessage(`Có vẻ bạn chưa có cần câu để câu cá, bạn hãy mua trong shop!`, threadID, messageID);
				let lastTimeFishing = await Fishing.lastTimeFishing(senderID);
				if (new Date() - new Date(lastTimeFishing) <= timeout[rodLevel]) return api.sendMessage(`Bạn bị giới hạn thời gian, chỉ được câu cá mỗi ${timeout[rodLevel] / 1000} giây một lần`, threadID, messageID);
				if (inventory.durability <= 0) return api.sendMessage(`Cần câu của bạn có vẻ đã bị gãy, hãy vào shop và sửa lại cần câu để tiếp tục sử dụng`, threadID);
				let stats = await Fishing.getStats(senderID);
				var roll = Math.floor(Math.random() * 1008);
				inventory.exp += Math.floor(Math.random() * 500);
				inventory.durability -= Math.floor(Math.random() * 9) + 1;
				stats.exp += Math.floor(Math.random() * 500);
				stats.casts += 1;
				if (Math.floor(Math.random() * 51) == 51) {
					let difficulty, answer, value1, value2;
					var difficulties = ['baby', 'easy', 'medium', 'hard', 'extreme'];
					difficulty =  difficulties[Math.floor(Math.random() * difficulties.length)];
					var operations = ['+', '-', '*'];
					var maxValues = { baby: 10,easy: 50,medium: 100,hard: 500,extreme: 1000 };
					var maxMultiplyValues = { baby: 5,easy: 12,medium: 30,hard: 50,extreme: 100 };
					var operation = operations[Math.floor(Math.random() * operations.length)];
					value1 = Math.floor(Math.random() * maxValues[difficulty] - 1) + 1;
					value2 = Math.floor(Math.random() * maxValues[difficulty] - 1) + 1;
					switch (operation) {
						case '+':
						answer = value1 + value2;
						break;
						case '-':
						answer = value1 - value2;
						break;
						case '*':
						answer = value1 * value2;
						break;
					}
					await Fishing.updateLastTimeFishing(senderID, new Date());
					return api.sendMessage(
						'== Oh no, bạn gặp phải con quái vật của hồ này và có độ khó ' + difficulty + ', bạn có 15 giây để trả lời câu hỏi này và hạ ngục con quái vật này ==' +
						`\n ${value1} ${operation} ${value2} = ?`,
						threadID, (err, info) => __GLOBAL.reply.push({ type: "fishing_domath", messageID: info.messageID, target: parseInt(threadID), author: senderID, answer }),
						messageID
					)
				}
				if (roll <= 400) {
					var arrayTrash = ["🏐","💾","📎","💩","🦴","🥾","🥾","🌂"];
					inventory.trash += 1;
					stats.trash += 1;
					api.sendMessage(arrayTrash[Math.floor(Math.random() * arrayTrash.length)] + ' | Oh, xung quanh bạn toàn là rác êii', threadID, messageID);
				}
				else if (roll > 400 && roll <= 700) {
					inventory.fish1 += 1;
					stats.fish1 += 1;
					api.sendMessage('🐟 | Bạn đã bắt được một con cá cỡ bình thường 😮', threadID, messageID);
				}
				else if (roll > 700 && roll <= 900) {
					inventory.fish2 += 1;
					stats.fish2 += 1;
					api.sendMessage('🐠 | Bạn đã bắt được một con cá hiếm 😮', threadID, messageID);
				}
				else if (roll > 900 && roll <= 960) {
					inventory.crabs += 1;
					stats.crabs += 1;
					api.sendMessage('🦀 | Bạn đã bắt được một con cua siêu to khổng lồ 😮', threadID, messageID);
				}
				else if (roll > 960 && roll <= 1001) {
					inventory.blowfish += 1;
					stats.blowfish += 1;
					api.sendMessage('🐡 | Bạn đã bắt được một con cá nóc *insert meme cá nóc ăn carot .-.*', threadID, messageID);
				}
				else if (roll == 1002) {
					inventory.crocodiles += 1;
					stats.crocodiles += 1;
					api.sendMessage('🐊 | Bạn đã bắt được một con cá sấu đẹp trai hơn cả bạn 😮', threadID, messageID);
				}
				else if (roll == 1003) {
					inventory.whales += 1;
					stats.whales += 1;
					api.sendMessage('🐋 | Bạn đã bắt được một con cá voi siêu to khổng lồ 😮', threadID, messageID);
				}
				else if (roll == 1004) {
					inventory.dolphins += 1;
					stats.dolphins += 1;
					api.sendMessage('🐬 | Damn bro, tại sao bạn lại bắt một con cá heo dễ thương thế kia 😱', threadID, messageID);
				}
				else if (roll == 1006) {
					inventory.squid += 1;
					stats.squid += 1;
					api.sendMessage('🦑 | Bạn đã bắt được một con mực 🤤', threadID, messageID);
				}
				else if (roll == 1007) {
					inventory.sharks += 1;
					stats.sharks += 1;
					api.sendMessage('🦈 | Bạn đã bắt được một con cá mập nhưng không mập 😲', threadID, messageID);
				}
				await Fishing.updateLastTimeFishing(senderID, new Date());
				await Fishing.updateInventory(senderID, inventory);
				await Fishing.updateStats(senderID, stats);
			}
			else if (content.indexOf('bag') == 0) {
				if (inventory.rod == 0) return api.sendMessage(`Có vẻ bạn chưa có cần câu để câu cá, bạn hãy mua trong shop!`, threadID, messageID);
				let durability = ['50','70','100','130','200','400'];
				let expToLevelup = ['1000','2000','4000','6000','8000'];
				var total = inventory.trash + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfish * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squid * 1000 + inventory.sharks * 1000;
				api.sendMessage(
					"===== Inventory Của Bạn =====" +
					`\n- Item cần câu bạn đang sử dụng: level ${inventory.rod} (Độ bền: ${inventory.durability}/${durability[rodLevel]})` +
					`\n- Exp hiện đang có: ${inventory.exp}/${expToLevelup[inventory.rod]}` +
					"\n- Sản lượng đang có trong túi:" +
					"\n+ Rác | 🗑️: " + inventory.trash +
					"\n+ Cá cỡ bình thường | 🐟: " + inventory.fish1 +
					"\n+ Cá hiếm | 🐠: " + inventory.fish2 +
					"\n+ Cua | 🦀: " + inventory.crabs +
					"\n+ Cá nóc | 🐡: " + inventory.blowfish +
					"\n+ Cá sấu | 🐊: " + inventory.crocodiles +
					"\n+ Cá voi | 🐋: " + inventory.whales +
					"\n+ Cá heo | 🐬: " + inventory.dolphins +
					"\n+ Mực | 🦑: " + inventory.squid +
					"\n+ Cá mập | 🦈: " + inventory.sharks +
					"\n- Tổng số tiền bạn có thể thu được sau khi bán: " + total + " đô ",
					threadID, messageID
				);
			}
			else if (content.indexOf('sell') == 0) {
				var choose = content.split(' ')[1];
				if (!choose) return api.sendMessage('Chưa nhập thứ cần bán.', threadID, messageID);
				else if (choose == 'trash' || choose == '1') {
					var y = inventory.trash;
					inventory.trash = 0;
					var money = parseInt(1 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' rác và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'common' || choose == '2') {
					var y = inventory.fish1;
					inventory.fish1 = 0;
					var money = parseInt(30 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá bình thường và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'rare' || choose == '3') {
					var y = inventory.fish2;
					inventory.fish2 = 0;
					var money = parseInt(100 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá hiếm và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'crabs' || choose == '4') {
					var y = inventory.crabs;
					inventory.crabs = 0;
					var money = parseInt(250 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cua và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'blowfish' || choose == '8') {
					var y = inventory.blowfish;
					inventory.blowfish = 0;
					var money = parseInt(300 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá nóc và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'crocodiles' || choose == '5') {
					var y = inventory.crocodiles;
					inventory.crocodiles = 0;
					var money = parseInt(500 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá sấu và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'whales' || choose == '6') {
					var y = inventory.whales;
					inventory.whales = 0;
					var money = parseInt(750 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá voi và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'dolphins' || choose == '7') {
					var y = inventory.dolphins;
					inventory.dolphins = 0;
					var money = parseInt(750 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá heo và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'squid' || choose == '9') {
					var y = inventory.squid;
					inventory.squid = 0;
					var money = parseInt(1000 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con mực và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'sharks' || choose == '10') {
					var y = inventory.sharks;
					inventory.sharks = 0;
					var money = parseInt(1000 * y);
					api.sendMessage('🎣 | Bạn đã bán ' + y + ' con cá mập và nhận được ' + money + ' đô', threadID, messageID);
				}
				else if (choose == 'all') {
					var money = parseInt(inventory.trash + inventory.fish1 * 30 + inventory.fish2 * 100 + inventory.crabs * 250 + inventory.blowfish * 300 + inventory.crocodiles * 500 + inventory.whales * 750 + inventory.dolphins * 750 + inventory.squid * 1000 + inventory.sharks * 1000);
					return api.sendMessage(`🎣 | Bạn sẽ nhận về được ${money} đô sau khi bán toàn bộ hải sản có trong túi. Bạn muỗn tiếp tục chứ? \n ==== Like tin nhắn này để đồng ý giao dịch hoặc dislike để huỷ giao dịch ====`, threadID, (err, info) => {
						if (err) throw err;
						__GLOBAL.confirm.push({
							type: "fishing_sellAll",
							messageID: info.messageID,
							target: parseInt(threadID),
							author: senderID
						});
					}, messageID);
				}
				await Fishing.updateInventory(senderID, inventory);
				await Economy.addMoney(senderID, money);
			}
			else if (content.indexOf("list") == 0)
				return api.sendMessage(
					"===== Danh sách tiền của mọi loại cá =====" +
					"\n1/ Rác | 🗑️: 1 đô" +
					"\n2/ Cá cỡ bình thường | 🐟: 30 đô" +
					"\n3/ Cá hiếm | 🐠: 100 đô" +
					"\n4/ Cua | 🦀: 250 đô" +
					"\n5/ Cá nóc | 🐡: 300 đô" +
					"\n6/ Cá sấu | 🐊: 500 đô" +
					"\n7/ Cá voi | 🐋: 750 đô" +
					"\n8/ Cá heo | 🐬: 750 đô" +
					"\n9/ Mực | 🦑: 1000 đô" +
					"\n10/ Cá mập | 🦈: 1000 đô",
					threadID, messageID
				);
			else if (content.indexOf("steal") == 0) {
				let cooldown = 1800000;
				Fishing.getStealFishingTime(senderID).then(async function(lastStealFishing) {
					if (lastStealFishing !== null && cooldown - (Date.now() - lastStealFishing) > 0) {
						let time = ms(cooldown - (Date.now() - lastStealFishing));
						return api.sendMessage("Bạn vừa ăn trộm, để tránh bị bay hết cá vui lòng quay lại sau: " + time.minutes + " phút " + time.seconds + " giây ", threadID, messageID);
					}
					else {
						let all = await User.getUsers(['uid']);
						let victim = all[Math.floor(Math.random() * all.length)].uid;
						let inventoryStealer = await Fishing.getInventory(senderID);
						let inventoryVictim = await Fishing.getInventory(victim);
						let route = Math.floor(Math.random() * 3000);
						let swap = Math.floor(Math.random() * 51);
						if (victim == api.getCurrentUserID() || senderID == victim) return api.sendMessage("Cần lao vi tiên thủ\nNăng cán dĩ đắc thực\nVô vi thực đầu buồi\nThực cứt thế cho nhanh", threadID, messageID);
						else if (senderID != victim && victim != api.getCurrentUserID()) {
							if (swap >= 0 && swap <= 50) {
								if (route == 3000) {
									if (inventoryVictim.sharks == 0) return api.sendMessage("Bạn định trộm 1 con cá mập nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.sharks -= 1;
										inventoryStealer.sharks += 1;
										api.sendMessage("Bạn vừa trộm được 1 baby sharks du du du du =))", threadID, messageID);
									}
								}
								else if (route == 2999) {
									if (inventoryVictim.squid == 0) return api.sendMessage("Bạn định trộm 1 con mực nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.squid -= 1;
										inventoryStealer.squid += 1;
										api.sendMessage("Bạn vừa trộm được 1 con mực siu to khổng nồ", threadID, messageID);
									}
								}
								else if (route == 2998) {
									if (inventoryVictim.dolphins == 0) return api.sendMessage("Bạn định trộm 1 con cá heo nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.dolphins -= 1;
										inventoryStealer.dolphins += 1;
										api.sendMessage("Bạn vừa trộm được 1 bé cá heo siu cute", threadID, messageID);
									}
								}
								else if (route == 2997) {
									if (inventoryVictim.whales == 0) return api.sendMessage("Bạn định trộm 1 con cá voi nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.whales -= 1;
										inventoryStealer.whales += 1;
										api.sendMessage("Bạn vừa trộm được 1 con cá voi to chà bá", threadID, messageID);
									}
								}
								else if (route == 2996) {
									if (inventoryVictim.crocodiles == 0) return api.sendMessage("Bạn định trộm 1 con cá sấu nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.crocodiles -= 1;
										inventoryStealer.crocodiles += 1;
										api.sendMessage("Bạn vừa trộm được 1 con cá sấu nhưng không xấu :v", threadID, messageID);
									}
								}
								else if (route == 2995) {
									if (inventoryVictim.blowfish == 0) return api.sendMessage("Bạn định trộm 1 con cá nóc nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.blowfish -= 1;
										inventoryStealer.blowfish += 1;
										api.sendMessage("Bạn vừa trộm được 1 con cá nóc :v", threadID, messageID);
									}
								}
								else if (route == 2994) {
									if (inventoryVictim.crabs == 0) return api.sendMessage("Bạn định trộm 1 con cá cua nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.crabs -= 1;
										inventoryStealer.crabs += 1;
										api.sendMessage("Bạn vừa trộm được 1 con cua", threadID, messageID);
									}
								}
								else if (route >= 2000 && route < 2994) {
									if (inventoryVictim.fish2 == 0) return api.sendMessage("Bạn định trộm 1 con cá hiếm nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.fish2 -= 1;
										inventoryStealer.fish2 += 1;
										api.sendMessage("Bạn vừa trộm được 1 con cá hiếm", threadID, messageID);
									}
								}
								else if (route >= 1000 && route < 2000) {
									if (inventoryVictim.fish1 == 0) return api.sendMessage("Bạn định trộm 1 con cá bé nhưng có vẻ là nạn nhân chưa bắt được.", threadID, messageID);
									else {
										inventoryVictim.fish1 -= 1;
										inventoryStealer.fish1 += 1;
										api.sendMessage("Bạn vừa trộm được 1 con cá bé", threadID, messageID);
									}
								}
								else if (route >= 0 && route < 1000) {
									if (inventoryVictim.trash == 0) return api.sendMessage("Bạn định trộm 1 cục rác (?) nhưng có vẻ là nạn nhân chưa câu được.", threadID, messageID);
									else {
										inventoryVictim.trash -= 1;
										inventoryStealer.trash += 1;
										api.sendMessage("Bạn vừa trộm được 1 cục rác to tướng :v", threadID, messageID);
									}
								}
								await Fishing.updateInventory(victim, inventoryVictim);
								await Fishing.updateInventory(senderID, inventoryStealer);
							}
							else if (swap > 50) {
								inventoryStealer.trash = 0;
								inventoryStealer.fish1 = 0;
								inventoryStealer.fish2 = 0;
								inventoryStealer.crabs = 0;
								inventoryStealer.crocodiles = 0;
								inventoryStealer.whales = 0;
								inventoryStealer.dolphins = 0;
								inventoryStealer.blowfish = 0;
								inventoryStealer.squid = 0;
								inventoryStealer.sharks = 0;
								api.sendMessage("Đi trộm không để ý, gặp bảo vệ, bạn bị bay hết cá trong túi rồi xD", threadID, messageID);
								await Fishing.updateInventory(senderID, inventoryStealer);
							}
						}
					}
					await Fishing.updateStealFishingTime(senderID, Date.now());
				});
			}
			else if (content.indexOf('shop') == 0) 
				return api.sendMessage(
					"🎣| Cửa hàng câu cá |🎣" +
					"\n---------------------" +
					"\n[1] Nâng cấp cần câu" +
					"\n[2] Sửa chữa cần câu" +
					"\n[3] Mua cần câu mới" +
					"\n[4] Mua mồi nhử" +
					"\n[5] Nâng cấp mồi nhử",
					threadID, (err, info) => __GLOBAL.reply.push({ type: "fishing_shop", messageID: info.messageID, target: parseInt(threadID), author: senderID })
				);
		}
		

		/* ==================== System Check ==================== */

		//Check if command is correct
		if (contentMessage.indexOf(prefix) == 0) {
			var checkCmd, findSpace = contentMessage.indexOf(' ');
			if (findSpace == -1) {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, contentMessage.length), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, contentMessage.length)) return;
			}
			else {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, findSpace), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, findSpace)) return;
			}
			if (checkCmd.bestMatch.rating >= 0.3) return api.sendMessage(`Lệnh bạn nhập không tồn tại.\nÝ bạn là lệnh "${prefix + checkCmd.bestMatch.target}" phải không?`, threadID, messageID);
		}

		if (contentMessage && !__GLOBAL.blockLevelUp.includes(threadID)) {
			let point = await Rank.getPoint(senderID);
			var curLevel = Math.floor((Math.sqrt(1 + (4 * point) / 3) + 1) / 2);
			var level =  Math.floor((Math.sqrt(1 + (4 * (point + 1)) / 3) + 1) / 2);
			if (level > curLevel) {
				let name = await User.getName(senderID);
				return api.sendMessage({
					body: name + `, Độ tương tác của bạn với đã lên level ${level} . Nếu muốn tắt thì dùng lệnh .levelup off`,
					attachment: fs.createReadStream(__dirname + "/src/levelup.GIF"),
					mentions: [{
						tag: name,
						id: senderID,
					}],
				}, threadID)
			}
		}
		__GLOBAL.messages.push({
			msgID: messageID,
			msgBody: contentMessage
		});
	}
}
/* This bot was made by Catalizcs(roxtigger2003) and SpermLord(spermlord) with love <3, pls dont delete this credits! THANKS */
