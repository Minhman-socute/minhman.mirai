var fs, git, cmd, exec;
var isGlitch = false;
var isForce = false;

try {
	fs = require('fs-extra');
	git = require('simple-git');
	cmd = require('node-cmd');
	exec = require('child_process').exec;
}
catch (err) {
	if (err) return console.log('[!] Hãy gõ lệnh này vào trước khi chạy update: "npm i fs-extra simple-git node-cmd" [!]');
}

var args = process.argv.slice(2);
if (args.length > 1 || args[0] != '--force') return console.error('[!] Updater chỉ nhận 1 tham số duy nhất là "--force" [!]');
if (args[0] == '--force') isForce = true;

(async () => {
	if (!fs.existsSync('./.updateAvailable') && !isForce) return console.log('[!] Bạn đang sử dụng phiên bản mới nhất [!]');
	else if (isForce) console.log('[!] Đã bật bắt buộc cập nhật [!]');
	cmd.run('pm2 stop 0');
	if (process.env.API_SERVER_EXTERNAL == 'https://api.glitch.com') isGlitch = true;
	if (isGlitch) console.log('-> Bạn đang chạy bot trên Glitch. Updater sẽ tự tối giản các bước làm vì Glitch đã có sẵn chức năng tự động cài modules.');
	else console.log('-> Bạn đang không chạy bot trên Glitch. Updater sẽ cần phải cài modules cho bạn.');
	await backup();
	await clean();
	await clone();
	await install();
	await modules();
	await finish();
})();

async function backup() {
	console.log('-> Đang xóa bản sao lưu cũ');
	fs.removeSync('./tmp');
	console.log('-> Đang sao lưu dữ liệu');
	fs.mkdirSync('./tmp');
	if (fs.existsSync('./app/handle')) fs.copySync('./app/handle', './tmp/handle');
	if (fs.existsSync('./appstate.json')) fs.copySync('./appstate.json', './tmp/appstate.json');
	if (fs.existsSync('./config')) fs.copySync('./config', './tmp/config');
	if (fs.existsSync('./database')) fs.copySync('./database', './tmp/database');
	if (fs.existsSync('./index.js')) fs.copySync('./index.js', './tmp/index.js');
	if (fs.existsSync('./.env')) fs.copySync('./.env', './tmp/.env.old');
}

async function clean() {
	console.log('-> Đang xóa bản cũ');
	fs.readdirSync('.').forEach(item => {
		if (item != 'tmp') fs.removeSync(item);
	});
}

function clone() {
	console.log('-> Đang tải bản cập nhật mới');
	return new Promise(function(resolve, reject) {
		git().clone('https://github.com/roxtigger2003/mirai-beta', './tmp/newVersion', [], result => {
			if (result != null) reject('[!] Không thể tải xuống bản cập nhật [!]');
			resolve();
		})
	})
}

async function install() {
	console.log('-> Đang cài đặt bản cập nhật mới');
	fs.copySync('./tmp/newVersion', './');
	if (fs.existsSync('./tmp/appstate.json')) fs.copySync('./tmp/appstate.json', './appstate.json');
}

function modules() {
	return new Promise(function(resolve, reject) {
		if (!isGlitch) {
			console.log('-> Đang cài đặt modules');
			let child = exec('npm install');
			child.stdout.on('end', resolve);
			child.stderr.on('data', data => {
				if (data.toLowerCase().includes('error')) {
					console.error('[!] Đã có lỗi xảy ra. Vui lòng chụp lại lỗi và đăng vào mục Issue trên Github [!]');
					data = data.replace(/\r?\n|\r/g, '');
					console.error('Lỗi: ' + data);
					reject();
				}
			});
		}
		else {
			console.log('-> Bỏ qua bước cài đặt modules');
			resolve();
		}
	});
}

async function finish() {
	let checkDB = (await axios.get('https://raw.githubusercontent.com/roxtigger2003/mirai-beta/master/package.json')).data.newDB;
	if (checkDB) console.log('>> Database cần phải thay đổi, bạn sẽ không thể sử dụng được database cũ <<');
	else {
		console.log('>> Database không cần phải thay đổi, bạn có thể tiếp tục sử dụng database cũ <<');
		fs.copySync('./tmp/config/data.sqlite', './config/data.sqlite');
	}
	console.log('-> Đang hoàn tất');
	fs.removeSync('./tmp/newVersion');
	fs.copySync('./.env.example', './.env');
	console.log('>> Cập nhật hoàn tất <<');
	console.log('>> Tất cả những dữ liệu quan trọng đã được sao lưu trong thư mục "tmp" <<');
	if (!isGlitch) console.log('[!] Vì bạn đang không chạy bot trên Glitch, bạn sẽ cần phải tự khởi động bot [!]');
	else cmd.run('refresh');
}
