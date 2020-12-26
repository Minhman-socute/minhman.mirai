module.exports = function({ api }) {
	const options = {
		forceLogin: true,
		listenEvents: true,
		logLevel: "error",
		updatePresence: false,
		selfListen: false,
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
	}
	api.setOptions(options);
}
