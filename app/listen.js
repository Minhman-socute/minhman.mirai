const logger = require("./modules/log.js");
const config = require("../config");
module.exports = function({ api, models, __GLOBAL }) {
	const User = require("./controllers/user")({ models, api }),
				Thread = require("./controllers/thread")({ models, api }),
				Rank = require("./controllers/rank")({ models, api }),
				Economy = require("./controllers/economy")({ models, api }),
				Fishing = require("./controllers/fishing")({ models, api }),
				Nsfw = require("./controllers/nsfw")({ models, api, Economy }),
				Image = require("./modules/image");

	(async () => {
		logger("Đang khởi tạo biến môi trường...");
		__GLOBAL.userBlocked = (await User.getUsers({ block: true })).map(e => e.uid);
		__GLOBAL.afkUser = (await User.getUsers({ afk: true })).map(e => e.uid);
		__GLOBAL.blockLevelUp = (await Thread.getThreads({ blocklevelup: true })).map(e => e.threadID);
		__GLOBAL.threadBlocked = (await Thread.getThreads({ block: true })).map(e => e.threadID);
		__GLOBAL.resendBlocked = (await Thread.getThreads({ blockResend: true })).map(e => e.threadID);
		__GLOBAL.NSFWBlocked = (await Thread.getThreads({ blockNSFW: true })).map(e => e.threadID);
		logger("Khởi tạo biến môi trường thành công!");
	})();

	const handleMessage = require("./handle/message")({ api, config, __GLOBAL, models, User, Thread, Rank, Economy, Fishing, Nsfw, Image });
	const handleEvent = require("./handle/event")({ api, config, __GLOBAL, User, Thread });
	const handleReply = require("./handle/message_reply")({ api, config, __GLOBAL, User, Thread, Economy, Fishing, Nsfw });
	const handleReaction = require("./handle/message_reaction")({ api, config, __GLOBAL, User, Thread, Economy, Fishing, Nsfw });
	const handleUnsend = require("./handle/unsend")({ api, __GLOBAL, User });

	logger(config.prefix || "[Không có]", "[ PREFIX ]");
	logger(`${api.getCurrentUserID()} - ${config.botName}`, "[ UID ]");
	logger("Bắt đầu hoạt động!");
	logger("This bot was made by Catalizcs(roxtigger2003) and SpermLord(spermlord)");

	return function(error, event) {
		if (error) return logger(error, 2);
		switch (event.type) {
			case "message":
			case "message_reply":
				handleMessage({ event });
				handleReply({ event });
				break;
			case "message_unsend":
				handleUnsend({ event });
				break;
			case "event":
				handleEvent({ event });
				break;
			case "message_reaction":
				handleReaction({ event });
				break;
			default:
				return;
				break;
		}
	};
};