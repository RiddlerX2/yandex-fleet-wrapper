/*
	Yandex.Fleet wrapper v.1.0.x
	Allow send commands to Yandex services
	This module for car rent services only! Not for taxi drivers or customers!
	
	For more information about operations and its parameters look at:
		https://fleet.taxi.yandex.ru/docs/api/reference/index.html
*/

/*Define dependencies*/
const axios = require('axios');

/*Error mesages*/
const messages = {
	ru : {
		operation_error : 'Указанная операция не определена в документации',
		params_invalid : 'Параметры должны быть переданы в виде объекта',
		callback_invalid : 'Требуется функция обратного вызова',
		value_invalid : 'Параметр должен быть указан',
		value_type_invalid : 'Некорректный тип данных ',
		auth_invalid : 'Некорректные данные для авторизации, необходимы имя пользователя и пароль'
	},
	en : {
		operation_error : 'The specified operation is not defined in the documentation',
		params_invalid : 'Parameters must be passed as an object',
		callback_invalid : 'Callback function required',
		value_invalid : 'Value must be specified',
		value_type_invalid : 'Value type is incorrect ',
		auth_invalid : 'Incorrect authorization userName and password must be provided'
	}
}

const commands = [
	'cars/list', 
	'driver-profiles/list',
	'orders/list',
	'orders/track',
	'driver-profiles/transactions',
	'driver-profiles/transactions/list',
	'transactions/list',
	'orders/transactions/list'
];

/*Main class*/
class Fleet {
	queueList = [];
	#language;
	#parkID;
	#token;
	#timerID = null;
	/*Default REST point of Yandex.Fleet*/
	execURLPrefix = `https://fleet-api.taxi.yandex.net/v1/parks/`;
	execURLSuffix = ``;
	/*Initialise class with "new"*/
	constructor (parkID, token, language, execURLPrefix, execURLSuffix) {
		this.#language = language;

		if (!parkID || !token) {
			throw messages[this.#language].auth_invalid;
		}

		this.#parkID = parkID;
		this.#token = token;

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

	randHex = (len) => {
		let maxlen = 8,
			min = Math.pow(16, Math.min(len, maxlen) - 1) 
			max = Math.pow(16, Math.min(len, maxlen)) - 1,
			n   = Math.floor(Math.random() * (max - min + 1)) + min,
			r   = n.toString(16);
		while (r.length < len) {
			r += randHex(len - maxlen);
		}
		return r;
	};	
	
	/*Unified execute action with callback*/
	execute(operation, data, callback) {
		if (!callback instanceof Function) {
			throw messages[this.#language].callback_invalid;
		} else if (!this.isObject(data)) {
			callback(messages[this.#language].params_invalid, false);
		} else if (!commands.includes(operation)) {
			callback(messages[this.#language].operation_error, false);
		} else {
			// Prepare here!!!

			/*Send data to server*/
			axios({
				method : 'POST', //as described in documentation (link above)
				url : `${this.execURLPrefix}${operation}${this.execURLSuffix}`,
				headers : {
					'X-Client-ID' : `taxi/park/${this.#parkID}`,
					'X-API-Key' : this.#token,
					'X-Idempotency-Token' : this.randHex(32)
				},
				data : data
			}).then(
				(result) => {
					console.log(result);
					/*If operation succeeded on API's side return data*/
					//if (result.data.status == 'ok') {
					//	callback(false, result.data);
					//} else {
						/*Else return data with description as error*/
					//	callback(result.data, false);
					//}
				}
			).catch(
				(error) => {
					callback(error, false);
				}
			)
		}
	}

	executePromise(operation, data) {
		return new Promise((resolve, reject) => {
			this.execute(operation, params, (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(data);
				}
			});
		});
	}

	async runQueue() {
		let item = this.queueList[0];
		if (item) {
			this.queueList.splice(0, 1);
			try {
				let data = await this.executePromise(item.operation, item.data);
				item.callback(false, data);
			} catch (error) {
				item.callback(data, false);
			}	
		}
		if (this.queueList.length > 0) {
			this.#queueID = setTimeout(() => {this.runQueue()}, 1000);
		} else {
			this.#timerID = null
		}
	}

	queue(operation, data, callback) {
		let item = {
			operation : operation,
			data : data,
			callback : callback
		}
		this.queueList.push(item);
		if (!this.#timerID) {
			this.#queueID = setTimeout(() => {this.runQueue()}, 0);
		}
	}
}

/*Export class to outside*/
exports.Fleet = Fleet;