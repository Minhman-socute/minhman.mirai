require('dotenv').config();
const fs = require("fs-extra");
const login = require("fca-unofficial");
const readline = require("readline");
const totp = require("totp-generator");
const cmd = require("node-cmd");

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const option = {
	logLevel: "silent",
	forceLogin: true,
	userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36"
};

//Hãy điền tài khoản và mật khẩu vào file .env sau khi đã đổi .env.example thành .env
const obj = {
	email: process.env.EMAIL,
	password: process.env.PASSWORD
};
login(obj, option, (err, api) => {
	if (err) {
		switch (err.error) {
			case "login-approval":
				if (process.env.OTPKEY) err.continue(totp(process.env.OTPKEY));
				else {
					console.log("Nhập mã xác minh 2 lớp:");
					rl.on("line", line => {
						err.continue(line);
						rl.close();
					});
				}
				break;
			default:
			console.error(err);
		}
		return;
	}
	var json = JSON.stringify(api.getAppState(), null, "\t");
	var addNew = fs.createWriteStream(__dirname + "/appstate.json", { flags: "w" });
	addNew.write(json);
	console.log("Đã ghi xong appstate!");
	(process.env.API_SERVER_EXTERNAL == 'https://api.glitch.com') ? cmd.run('refresh') : cmd .run('pm2 reload 0');
});
