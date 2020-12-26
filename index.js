require("dotenv").config();
const login = require("./app/login");
const { Sequelize, sequelize, Op } = require("./database");
const logger = require("./app/modules/log.js");
const { appStateFile } = require("./config");
const fs = require("fs-extra");
const express = require("express");
const app = express();
const cmd = require('node-cmd');
const __GLOBAL = new Object({
	threadBlocked: new Array(),
	userBlocked: new Array(),
	messages: new Array(),
	resendBlocked: new Array(),
	NSFWBlocked: new Array(),
	afkUser: new Array(),
	confirm: new Array(),
	reply: new Array(),
	simOn: new Array(),
	blockLevelUp: new Array()
});

app.get("/", (request, response) => response.sendFile(__dirname + "/config/dbviewer/index.html"));
app.use(express.static(__dirname + '/config'));
app.use(express.static(__dirname + '/config/dbviewer'));
const listener = app.listen(process.env.PORT, () => logger("Đã mở tại port: " + listener.address().port), 0);

if (process.env.REFRESHING == 'on') setTimeout(() => {
	console.log("Đang làm mới sau 10 phút!");
	cmd.run("pm2 restart 0");
}, 600000);

function facebook({ Op, models }) {
	require('npmlog').info = () => {};
	login({ appState: require(appStateFile) }, (error, api) => {
		if (error) return logger(error, 2);
		fs.writeFileSync(appStateFile, JSON.stringify(api.getAppState(), null, "\t"));
		api.listenMqtt(require("./app/listen")({ api, Op, models, __GLOBAL }));
	});
}

sequelize.authenticate().then(
	() => logger("Kết nối cơ sở dữ liệu thành công!", 0),
	() => logger("Kết nối cơ sở dữ liệu thất bại!", 2)
).then(() => {
	let models = require("./database/model")({ Sequelize, sequelize });
	facebook({ Op, models });
}).catch(e => logger(`${e.stack}`, 2));
// Made by CatalizCS and SpermLord