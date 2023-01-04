# yandex-fleet-wrapper
Wrapper for Yandex.Fleet API

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

## Installation:
```
npm i yandex-fleet-wrapper
```

## Supported and planned API points
- [x] in v. 1.0.1 v1/parks/driver-profiles/list
- [x] in v. 1.0.1 v1/parks/orders/list
- [x] in v. 1.0.1 v2/parks/driver-profiles/transactions/list
- [x] in v. 1.0.1 v2/parks/driver-profiles/transactions
- [x] in v. 1.2.1 v1/parks/driver-work-rules

- [ ] v2/parks/vehicles/car
- [ ] v1/parks/cars/list
- [ ] v1/parks/driver-profiles/car-bindings
- [ ] v2/parks/contractors/driver-profile
- [ ] v1/parks/orders/track
- [ ] v2/parks/transactions/list
- [ ] v2/parks/orders/transactions/list

## Usage:
#### Create object
```
const Fleet = require('yandex-fleet-wrapper').Fleet;

let fleet = new Fleet(
    'Your park ID', 
    'Your park auth token'
    [, 'Language code (ru, en)' 
    [, 'URL Prefix' 
    [, 'URL suffix' ]]]
);
```
If Language code not provided 'ru' is used by default

if URL Prefix and Suffix not provided default is used.

__Yandex services path can be changes without notice, this project can be updated with delay__

All sending commands are queueing and executes sequentially with delay of 2 seconds. This is because Yandex.API requires a minimum delay of 0.5sec between operations on same parkId.

More information about returned data you can find in official documentation 

#### Get drivers list
```
let data = await fleet.drivers();
```

#### Get orders list
```
let data = await fleet.orders(timeFrom, timeTo);
```
timeFrom and timeTo is Date object

timeFrom <= timeTo

#### Get transactions list
```
let data = await fleet.transactions(friverId, timeFrom, timeTo);
```
driverId is an Yandex ID that you can get using fleet.drivers() method

timeFrom and timeTo is Date object

timeFrom <= timeTo

#### Make driver transaction
```
let data = await fleet.transaction(driverId, moneyAmount, remarks, idKey);
```
driverId is an Yandex ID that you can get using fleet.drivers() method

moneyAmount should be a positive or negative decimal(12,2) value and can't be zero

remarks could describe your transaction and passed "AS IS" to Yandex transaction log

idKey (idempotency key) is an unique ID of the transaction provided by user

If one transaction with the same idKey is executed then next one is declined

#### Get list of work rules
```
let data = await fleet.workRules();
```
