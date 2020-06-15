"use strict";

const { Command } = require('commander')
const program = new Command()
program.version('0.0.1')

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/jira-stats.db')

const datefns = require('date-fns')

const { promisify } = require('util')
const sleep = promisify(setTimeout)

const debug = require('debug')('simple-fetch')
const JSR = require('./JiraStatusReporter')

// Parse command line parameters
function status(value, previous) { return previous.concat([value]) }
program.requiredOption('-s, --status <value>', 'RED Status(es)', status, [])
program.requiredOption('-m, --month <value>', 'Month to process')
program.parse(process.argv)

// Set up statuses (to be removed by command line params)
const RED_STATUS = program.status
debug(`RED_STATUS: ${RED_STATUS}`)
const MON = +program.month - 1
const MON_NEXT = +MON + 1

// Full list of RED Statuses
// ['ICEBOX', 'DEFINED', 'IN PROGRESS', 'IN REVIEW', 'DONE', 'EMERGENCY', 'BLOCKED', 'DEAD']

let jsr = new JSR();

// Date tests
const START_DATE = new Date(2020, MON, 1, 0, 0, 0)
// const END_DATE = datefns.endOfMonth(START_DATE)
const END_DATE = datefns.lastDayOfMonth(START_DATE)

const today = new Date()
const dateList = datefns.eachDayOfInterval({
    start: START_DATE,
    end: END_DATE,
})

RED_STATUS.forEach((status) => {
    dateList.forEach((d, ndx) => {
        sleep(1000).then(() => {
            let y = datefns.getYear(d)
            let m = datefns.getMonth(d)+1
            let day = datefns.getDate(d)

            let nextDay = datefns.addDays(d, 1)
            let m2 = datefns.getMonth(nextDay)+1
            let day2 = datefns.getDate(nextDay)

            db.run(`delete from 'jira-stats' WHERE status='${status}' AND year=${y} AND month=${m}`)

            const jql = `project=RED and status was "${status}" DURING ("${y}/${m}/${day}", "${y}/${m2}/${day2}")`
            debug(`Starting... jql: ${jql}`)

            sleep(1000).then(() => {
                jsr.search(jql)
                    .then((results) => {
                        debug(`${status} on ${y}/${m}/${day}`, results.total)
                        db.run("INSERT INTO `jira-stats` (status, year, month, day, count) VALUES (?, ?, ?, ?, ?)", status, y, m, day, results.total)
                    })
                    .catch((err) => {
                        // TODO: Fix this recursive HACK!
                        sleep(2000).then(() => {
                            jsr.search(jql)
                                .then((results) => {
                                    debug(`Try #2: ${status} on ${y}/${m}/${day}`, results.total)
                                    db.run("INSERT INTO `jira-stats` (status, year, month, day, count) VALUES (?, ?, ?, ?, ?)", status, y, m, day, results.total)
                                })
                                .catch((err) => {
                                    sleep(5000).then(() => {
                                        jsr.search(jql)
                                            .then((results) => {
                                                debug(`Try #3: ${status} on ${y}/${m}/${day}`, results.total)
                                                db.run("INSERT INTO `jira-stats` (status, year, month, day, count) VALUES (?, ?, ?, ?, ?)", status, y, m, day, results.total)
                                            })
                                            .catch((err) => {
                                                console.error(`Error after try #3: ${err.statusCode} for status ${status} on ${y}/${m}/${day} (JQL: ${jql}`)
                                            })
                                    })
                                })
                        })
                    })
            })
        })
    })
})

// jsr.countIssuesCreatedOnDay(2020, 6, d)
//     .then((val) => { console.log(`${ndx} Created on 6/${d}: ${val}`)})
// })
// })

// jsr.getIssue('RED-1604')
//     .then((msg) => {
//         console.log(JSON.stringify(msg))
//     })

// jsr.getRedEpics().then((msg) => { console.log(JSON.stringify(msg)) })

// jsr.countRedEpics().then((hits) => { console.log(`RED Epic count: ${hits}`); })
// jsr.getIssue('RED-1559').then((result) => { console.log(result) });
// jsr.countDeadIssues().then((hits) => { console.log(`Dead Issue count: ${hits}`); });

// jsr.countIssuesDoneThisMonth("RED")
//     .then((count) => {
//         debug("countIssuesDone issues count: %O", count)
//     })

// jsr.getIssuesDoneThisMonth("RED")
//     .then((content) => {
//         debug("getIssuesDone issues count: %O", content.issues)
//     })
// Working
// jsr.countIssuesByProjectAndStatus("RED", "Dead")
// .then((count) => {
//     console.log("RED/Dead count: ", count) 
// });

// jsr.countIssuesByProjectAndStatus("RED", "Done")
// .then((count) => {
//     console.log("RED/Done count: ", count) 
// });

// jsr.countOpenIssuesByProject("RED")
// .then((count) => {
//     console.log("RED/Open count: ", count) 
// });

// jsr.countIssuesChangedThisMonthByProjectAndStatus("RED", "status")
// .then((count) => {
//     console.log("RED Status changes this month: ", count) 
// });

// jsr.countIssuesDoneThisMonth("RED")
// .then((count) => {
//     console.log("RED Issues Done this month: ", count) 
// });
