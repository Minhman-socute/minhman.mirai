module.exports = function({ error }) {
	if(!error.error) return error.toString();
	switch (error.error) {
		case "login-approval":
			return "Tài khoản facebook của bạn có sử dụng xác minh 2 lớp, để có thể đăng nhập, hãy sử dụng lệnh 'node login'!"
		case "Wrong username/password.":
			return "Sai tài khoản hoặc mật khẩu!"
		default:
			return "Đã có lỗi xảy ra khi đăng nhập vào tài khoản của bạn, vui lòng kiểm tra tài khoản có bị checkpoint hay không!"
	}
}