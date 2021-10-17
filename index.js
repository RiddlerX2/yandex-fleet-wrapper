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
	'v1/parks/cars/list', 
	'v1/parks/driver-profiles/list',
	'v1/parks/orders/list',
	'v1/parks/orders/track',
	'v2/parks/driver-profiles/transactions',
	'v2/parks/driver-profiles/transactions/list',
	'v2/parks/transactions/list',
	'v2/parks/orders/transactions/list'
];

/*Main class*/
class Fleet {
	queueList = [];
	#language;
	#parkID;
	#token;
	#timerID = null;
	/*Default REST point of Yandex.Fleet*/
	execURLPrefix = `https://fleet-api.taxi.yandex.net/`;
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
			min = Math.pow(16, Math.min(len, maxlen) - 1), 
			max = Math.pow(16, Math.min(len, maxlen)) - 1,
			n   = Math.floor(Math.random() * (max - min + 1)) + min,
			r   = n.toString(16);
		while (r.length < len) {
			r += this.randHex(len - maxlen);
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
			/*Send data to server*/
			/*TO DO: Multipaging*/
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
					/*If operation succeeded on API's side return data*/
					callback(false, result.data);
				}
			).catch(
				(error) => {
					callback(error, false);
				}
			)
		}
	}

	/*Promisified execution for queue*/
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

	/*Queue runner once per second // Yandex not allow more then 1 query per 0.5 seconds that's why using delayed queue*/
	async runQueue() {
		let item = this.queueList[0];
		if (item) {
			try {
				/*Wait until operation finished because of Yandex limitations*/
				let data = await this.executePromise(item.operation, item.data);
				item.callback(false, data);
			} catch (error) {
				item.callback(error, false);
			}	
			this.queueList.splice(0, 1);
		}
		if (this.queueList.length > 0) {
			this.#timerID = setTimeout(() => {this.runQueue()}, 2000);
		} else {
			this.#timerID = null
		}
	}

	/*Append task to queue*/
	queue(operation, data, callback) {
		let item = {
			operation : operation,
			data : data,
			callback : callback
		}
		this.queueList.push(item);
		if (!this.#timerID) {
			this.#timerID = setTimeout(() => {this.runQueue()}, 0);
		}
	}

	/*Simplified task creator for listing all drivers*/
	drivers() {
		let data = {
			limit : 1000,
			offset : 0,
			query : {
				park : {
					id : this.#parkID
				},
				fields : {
					car : [],
					park : []
				}
			},
			sort_order : [
				{
					direction : 'desc',
					field : 'driver_profile.created_date'
				}
			]
		};
		return new Promise((resolve, reject) => {
			this.queue('v1/parks/driver-profiles/list', data, (err, res) => {
				if (err) {
					reject(err);
				}
				resolve(res);
			});
		});
	}

	/*Simplified task creator for listing all orders*/
	orders(timeFrom, timeTo) {
		let data = {
			limit : 500,
			query : {
				park : {
					id : this.#parkID,
					order : {
						ended_at : {
							from : timeFrom,
							to : timeTo
						}
					}
				}
			}
		};

		return new Promise((resolve, reject) => {
			this.queue('v1/parks/orders/list', data, (err, res) => {
				if (err) {
					reject(err);
				}
				resolve(res);
			});
		});
	}

	/*Simplified task creator for listing all transactions*/
	transactions(driver, timeFrom, timeTo) {
		let data = {
			limit : 1000,
			query : {
				park : {
					id : this.#parkID,
					driver_profile : {
						id : driver
					},
					transaction : {
						event_at : {
							from : timeFrom,
							to : timeTo
						}
					}
				}
			}
		};

		for (let item of this.queueList) {
			if (item.data.query.park.driver_profile == data.query.park.driver_profile) {
				return new Promise((resolve, reject) => {
					reject('Duplicate queue entry ' + JSON.stringify(data));
				});
			}
		}

		return new Promise((resolve, reject) => {
			this.queue('v2/parks/driver-profiles/transactions/list', data, (err, res) => {
				if (err) {
					reject(err);
				}
				resolve(res);
			});
		});
	}

	/*Simplified task for creating new transaction*/
	transaction(driver, amount, remarks) {
		let data = {
			amount: `${amount}`,
			category_id: 'partner_service_manual',
			description: remarks,
			driver_profile_id: driver,
			park_id: this.#parkID
		};

		for (let item of this.queueList) {
			if (item.data.amount == data.amount && item.data.description == data.description && item.data.driver_profile_id == data.driver_profile_id) {
				return new Promise((resolve, reject) => {
					reject('Duplicate queue entry ' + JSON.stringify(data));
				});
			}
		}

		return new Promise((resolve, reject) => {
			this.queue('v2/parks/driver-profiles/transactions', data, (err, res) => {
				if (err) {
					reject(err);
				}
				resolve(res);
			});
		});
	}
}

/*Export class to outside*/
exports.Fleet = Fleet;