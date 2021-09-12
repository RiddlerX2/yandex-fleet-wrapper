/*
	IQSMS wrapper v.1.0.x
	Allow send SMS using IQSMS service
	
	For more information about operations and its parameters look at:
		https://iqsms.ru/api/api_rest/
*/

/*Define dependencies*/
const axios = require('axios');

/*Error mesages*/
const messages = {
	ru : {
		operation_error : 'Указанная операция не определена в документации',
		params_invalid : 'Параметры должны быть переданы в виде массива',
		callback_invalid : 'Требуется функция обратного вызова',
		value_invalid : 'Параметр должен быть указан',
		value_type_invalid : 'Некорректный тип данных ',
		auth_invalid : 'Некорректные данные для авторизации, необходимы имя пользователя и пароль'
	},
	en : {
		operation_error : 'The specified operation is not defined in the documentation',
		params_invalid : 'Parameters must be passed as an array',
		callback_invalid : 'Callback function required',
		value_invalid : 'Value must be specified',
		value_type_invalid : 'Value type is incorrect ',
		auth_invalid : 'Incorrect authorization userName and password must be provided'
	}
}

const commands = [
	'balance', 
	'send',
	'status'
];

/*Main class*/
class IQSMS {
	#language;
	#username;
	#password;
	#signature;
	/*Default REST point of IQSMS*/
	execURLPrefix = `https://api.iqsms.ru/messages/v2/`;
	execURLSuffix = `.json`;
	/*Initialise class with "new"*/
	constructor (userName, password, language, signature, execURLPrefix, execURLSuffix) {
		this.#language = language;

		if (!userName || !password) {
			throw messages[this.#language].auth_invalid;
		}

		this.#username = userName;
		this.#password = password;

		if (signature) {
			this.#signature = signature;
		}

		/*If URLs not defines use default values*/
		if (execURLPrefix) {
			this.execURLPrefix = execURLPrefix;
		};
		if (execURLSuffix) {
			this.execURLSuffix = execURLSuffix;
		};
	};
	
	/*Simple detectors of Objects and Arrays*/
	isObject = (a) => {
		return (!!a) && (a.constructor === Object);
	};
	
	isArray = (a) => {
    return (!!a) && (a.constructor === Array);
	};
	
	/*Unified execute action with callback*/
	execute(operation, data, callback) {
		let sdata = {};
		if (!callback instanceof Function) {
			throw messages[this.#language].callback_invalid;
		} else if (!this.isArray(data)) {
			callback(messages[this.#language].params_invalid, false);
		} else if (!commands.includes(operation)) {
			callback(messages[this.#language].operation_error, false);
		} else {
			/*Extend parameters by adding authorization token*/
			if (this.#username && this.#password) {
				sdata.login = this.#username;
				sdata.password = this.#password;
			}
			if (data.length) {
				sdata.messages = data;
			}
			/*Send data to server*/
			axios({
				method : 'POST', //as described in documentation (link above)
				url : `${this.execURLPrefix}${operation}${this.execURLSuffix}`,
				data : sdata
			}).then(
				(result) => {
					/*If operation succeeded on API's side return data*/
					if (result.data.status == 'ok') {
						callback(false, result.data);
					} else {
						/*Else return data with description as error*/
						callback(result.data, false);
					}
				}
			).catch(
				(error) => {
					callback(error, false);
				}
			)
		}
	}
	/*Promisified execution for those who used a single thread application and uses await*/
	executePromise(operation, data) {
		return new Promise((resolve, reject) => {
			this.execute(operation, data, (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(data);
				}
			});
		});
	}

	/*Functions for most popular actions*/
	send(phone, message) {
		let cphone = phone.replace(/[ ,\(,\),\-]/g, '');
		let messages = [{
			phone : cphone,
			clientId : Math.round(Math.random() * 1000000),
			text : message
		}];
		if (this.#signature) {
			messages[0].sender = this.#signature;
		}
		return this.executePromise('send', messages);
	}
	
	status(messages) {
		return this.executePromise('status', messages);
	}

	balance() {
		return this.executePromise('balance', []);
	}
}

/*Export class to outside*/
exports.IQSMS = IQSMS;