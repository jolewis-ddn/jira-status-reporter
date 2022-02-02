/** @format */

'use strict'

const { Command } = require('commander')
const program = new Command()
program.version('0.0.1')
const config = require('config')

const datefns = require('date-fns')

const debug = require('debug')('getIssuesByStatusOnDate')
const JSR = require('./JiraStatusReporter')

// Parse command line parameters
function status(value, previous) {
  return previous.concat([value])
}
program.option(
  '-s, --status <value>',
  `${config.project} Status(es)`,
  status,
  []
)
program.option(
  '-y, --year <value>',
  'Year to process. Defaults to year of yesterday.'
)
program.option(
  '-m, --month <value>',
  'Month to process. Defaults to month of yesterday.'
)
program.option(
  '-d, --day <value>',
  'Day to process. Defaults to day of yesterday.'
)
program.parse(process.argv)

// Set up statuses (to be removed by command line params)
// if (program.status.length == 0) {
// console.error('Status required.')
// process.exit(10)
// }

const STATUS = program.status || ['IN PROGRESS']
debug(`STATUS: ${STATUS}`)

const TODAY = new Date()
const TOMORROW = datefns.addDays(TODAY, 1)
const YESTERDAY = datefns.subDays(TODAY, 1)

let START_DATE = null
let END_DATE = null

let YEAR = null
let YEAR_NEXT = null
let MON = null
let MON_NEXT = null
let DAY = null
let DAY_NEXT = null

if (!program.year & !program.month & !program.day) {
  START_DATE = YESTERDAY
} else if (program.year & program.month & program.day) {
  START_DATE = new Date(program.year, +program.month - 1, program.day, 0, 0, 0)
} else {
  if (program.year) {
    YEAR = +program.year
  } else {
    YEAR = datefns.getYear(YESTERDAY)
  }

  if (program.month) {
    MON = +program.month - 1
  } else {
    MON = datefns.getMonth(YESTERDAY)
  }

  if (program.day) {
    DAY = +program.day
  } else {
    DAY = datefns.getDay(YESTERDAY)
  }

  START_DATE = new Date(YEAR, MON, DAY, 0, 0, 0)
}
END_DATE = datefns.addDays(START_DATE, 1)

debug(`Processing Dates: START: ${START_DATE}; END: ${END_DATE}`)

let jsr = new JSR()

STATUS.forEach((status) => {
  debug(`Fetching records for status ${status} on ${START_DATE}...`)
  jsr.setFields([
    'aggregateprogress',
    'progress',
    'reporter',
    'aggregatetimeestimate',
    'summary',
    'creator',
    'subtasks',
    'description',
    'timeoriginalestimate',
    'components',
    'status',
    'updated',
    'assignee',
    'issuelinks',
    'versions',
    'aggregatetimeoriginalestimate',
    'labels',
    'priority',
    'created',
    'fixVersions',
    'project',
    'issuetype',
  ])
  jsr
    .getIssuesByStatusOnDate(status, START_DATE)
    .then((results) => {
      debug(`${status} on ${START_DATE}`, results.total)
      console.log(JSON.stringify(results))
    })
    .catch((err) => {
      console.error(`err 1: ${err.statusCode} ${err.message}`)
    })
})
