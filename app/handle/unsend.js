module.exports = function({ api, __GLOBAL, User }) {
	return async function({ event }) {
		if (__GLOBAL.resendBlocked.includes(parseInt(event.threadID))) return;
		if (!__GLOBAL.messages.some(item => item.msgID == event.messageID)) return;
		var getMsg = __GLOBAL.messages.find(item => item.msgID == event.messageID);
		let tag = await User.getName(event.senderID);
		if (event.senderID != api.getCurrentUserID())
			return api.sendMessage({
				body: tag + ((getMsg.msgBody == '') ? ' vừa gỡ một thứ gì đó 👀' : ' vừa gỡ một tin nhắn:\n' + getMsg.msgBody),
				mentions: [{ tag, id: event.senderID }]
			}, event.threadID);
	}
}
