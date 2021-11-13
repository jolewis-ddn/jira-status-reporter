/** @format */

const debug = require('debug')('functionUtils')

const SUCCESS_STR = 'Success'
const FAILURE_STR = 'Failure'

const success = (extra) => {
  return { result: SUCCESS_STR, ...extra }
}

const failure = (msg = 'Unspecified failure', ...details) => {
  if (details) {
    return { result: FAILURE_STR, message: msg, details: details }
  } else {
    return { result: FAILURE_STR, message: msg }
  }
}

const isSuccess = (funcResult) => {
  //   debug(`isSuccess called with ${funcResult}`)
  if (funcResult && funcResult.result && funcResult.result == SUCCESS_STR) {
    // debug(`...returning true`)
    return true
  } else {
    // debug(`...returning false`)
    return false
  }
}

exports.success = success
exports.failure = failure
exports.isSuccess = isSuccess
