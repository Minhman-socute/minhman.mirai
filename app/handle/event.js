const fs = require("fs-extra");
module.exports = function({ api, config, __GLOBAL, User, Thread }) {
	return async function({ event }) {
		let threadInfo = await api.getThreadInfo(event.threadID);
		let threadName = threadInfo.threadName;
		switch (event.logMessageType) {
			case "log:subscribe":
				if (event.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
					await Thread.createThread(event.threadID);
					api.changeNickname(config.botName, event.threadID, api.getCurrentUserID());
					api.sendMessage(`Đã kết nối thành công!\nVui lòng sử dụng ${config.prefix}help để biết các lệnh của bot >w<`, event.threadID);
					let deleteMe = event.logMessageData.addedParticipants.find(i => i.userFbId == api.getCurrentUserID());
					event.logMessageData.addedParticipants.splice(deleteMe, 1);
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				var mentions = [], nameArray = [], memLength = [];
				for (var i = 0; i < event.logMessageData.addedParticipants.length; i++) {
					let id = event.logMessageData.addedParticipants[i].userFbId;
					let userName = event.logMessageData.addedParticipants[i].fullName;
					await User.createUser(id);
					nameArray.push(userName);
					mentions.push({ tag: userName, id });
					memLength.push(threadInfo.participantIDs.length - i);
				}
				memLength.sort((a, b) => a - b);
				var body = `Welcome aboard ${nameArray.join(', ')}.\nChào mừng ${(memLength.length > 1) ?  'các bạn' : 'bạn'} đã đến với ${threadName}.\n${(memLength.length > 1) ?  'Các bạn' : 'Bạn'} là thành viên thứ ${memLength.join(', ')} của nhóm 🥳`;
				api.sendMessage({ body, mentions }, event.threadID);
				break;
			case "log:unsubscribe":
				if (event.author == event.logMessageData.leftParticipantFbId) api.sendMessage(`${event.logMessageBody.split(' đã rời khỏi nhóm.')[0]} có vẻ chán nản nên đã rời khỏi nhóm 🥺`, event.threadID);
				else api.sendMessage(`${/đã xóa (.*?) khỏi nhóm/.exec(event.logMessageBody)[1]} vừa bị đá khỏi nhóm 🤔`, event.threadID);
				break;
			case "log:thread-icon":
				break;
			case "log:user-nickname":
				break;
			case "log:thread-color":
				break;
			case "log:thread-name":
				await Thread.updateName(event.threadID, threadName);
				break;
		}
	}
}