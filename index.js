/*
    Yandex.Fleet wrapper
    Allow send commands to Yandex services
    This module for car rent services only! Not for taxi drivers or customers!
    
    For more information about operations and its parameters look at:
        https://fleet.taxi.yandex.ru/docs/api/reference/index.html

    Обертка над сервисами Яндекс.Такси
    Позволяет посылать команды в сервис
    Данный модуль предназначен только для таксопарков и сервисов аренды авто.
    Модуль не предназначен для водителей и клиентов такси.

    За дополнительной информацией по API обращайтесь к документации по адресу:
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
    /*Append on 1.0.0*/
    'v1/parks/driver-profiles/list',
    'v1/parks/orders/list',
    'v2/parks/driver-profiles/transactions/list',
    'v2/parks/driver-profiles/transactions',
    /*Append on 1.2.0*/
    'v1/parks/driver-work-rules',
    /*Append on 1.2.4*/
    'v1/parks/cars/list',
    'v2/parks/vehicles/car',
    'v1/parks/driver-profiles/car-bindings',
    /*Planned on 1.2.x*/
    'v2/parks/contractors/driver-profile',
    'v1/parks/orders/track',
    'v2/parks/transactions/list',
    'v2/parks/orders/transactions/list',
];

/*Main class*/
class Fleet {
    queueList = [];
    #language;
    #parkID;
    #token;
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
        setTimeout(() => {this.runQueue()}, 0);
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
    execute(operation, method, data, idKey, callback) {
        if (!callback instanceof Function) {
            throw messages[this.#language].callback_invalid;
        } else if (!this.isObject(data)) {
            callback(messages[this.#language].params_invalid, false);
        } else if (!commands.includes(operation)) {
            callback(messages[this.#language].operation_error, false);
        } else {
            /*Send data to server*/
            let query = {
                method : method,
                url : `${this.execURLPrefix}${operation}${this.execURLSuffix}`,
                headers : {
                    'X-Client-ID' : `taxi/park/${this.#parkID}`,
                    'X-API-Key' : this.#token,
                    'X-Idempotency-Token' : idKey || this.randHex(32)
                }
            };
            if (method === 'GET') {
                query.params = data
            } else {
                query.data = data
            }

            axios(query)
                .then((result) => {
                    /*If operation succeeded on API's side return data*/
                    callback(false, result.data);
                })
                .catch((error) => {
                    /*If operation failed? return error*/
                    callback(error, false);
                });
        }
    }

    /*Promisified execution for queue*/
    executePromise(operation, method, data, idKey) {
        return new Promise((resolve, reject) => {
            this.execute(operation, method, data, idKey, (error, data) => {
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
                let data = await this.executePromise(item.operation, item.method, item.data, item.idKey);
                item.callback(false, data);
            } catch (error) {
                item.callback(error, false);
            }	
            this.queueList.splice(0, 1);
        }
        setTimeout(() => {this.runQueue()}, 2000);
    }

    /*Append task to queue*/
    queue(operation, method, data, idKey, callback) {
        let item = {
            method : method,
            operation : operation,
            data : data,
            callback : callback,
            idKey : idKey
        }
        this.queueList.push(item);
    }

    /*Task for listing all drivers*/
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
            this.queue(commands[0], 'POST', data, null, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for listing all orders*/
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
            this.queue(commands[1], 'POST', data, null, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for listing all transactions*/
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
            this.queue(commands[2], 'POST', data, null, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for creating new transaction*/
    transaction(driver, amount, remarks, idKey) {
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
            this.queue(commands[3], 'POST', data, idKey, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for listing all workrules*/
    workRules() {
        let data = {
            park_id: this.#parkID
        }
        return new Promise((resolve, reject) => {
            this.queue(commands[4], 'GET', data, null, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for listing cars*/
    cars() {
        let data = {
            limit : 1000,
            offset : 0,
            query : {
                park : {
                    id : this.#parkID
                }
            }
        };
        return new Promise((resolve, reject) => {
            this.queue(commands[5], 'POST', data, null, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for getting car vehicle info*/
    carInfo(vehicle_id) {
        let data = {
            vehicle_id: vehicle_id
        }
        return new Promise((resolve, reject) => {
            this.queue(commands[6], 'GET', data, null, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for binding car to driver*/
    carBind(vehicle_id, driver_id) {
        let data = {
            park_id: this.#parkID,
            car_id: vehicle_id,
            driver_profile_id: driver_id
        }
        return new Promise((resolve, reject) => {
            this.queue(commands[7], 'PUT', data, null, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    /*Task for unbinding car to driver*/
    carUnbind(vehicle_id, driver_id) {
        let data = {
            park_id: this.#parkID,
            car_id: vehicle_id,
            driver_profile_id: driver_id
        }
        return new Promise((resolve, reject) => {
            this.queue(commands[7], 'DELETE', data, null, (err, res) => {
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