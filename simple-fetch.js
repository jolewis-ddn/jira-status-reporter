"use strict";

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/jira-stats.db')

const datefns = require('date-fns')

const { promisify } = require('util')
const sleep = promisify(setTimeout)

// `set DEBUG=* & node simple-fetch.js`

const debug = require('debug')('simple-fetch')
const JSR = require('./JiraStatusReporter')

const RED_STATUS = ['IN PROGRESS']
const RED_STATUS1 = ['ICEBOX', 'DEFINED', 'IN PROGRESS']
const RED_STATUS2 = ['IN REVIEW', 'DONE', 'EMERGENCY']
const RED_STATUS3 = ['BLOCKED', 'DEAD']
// const RED_STATUS = ['ICEBOX', 'DEFINED', 'IN PROGRESS', 'IN REVIEW', 'DONE', 'EMERGENCY', 'BLOCKED', 'DEAD']
// const RED_STATUS = RED_STATUS1
// const RED_STATUS = RED_STATUS2
// const RED_STATUS = RED_STATUS3

let jsr = new JSR();

// Date tests
const today = new Date()
const dateList = datefns.eachDayOfInterval({
    start: new Date(2020, 3, 1, 0, 0, 0),
    // end: new Date(2020, 4, 1, 0, 0, 0),
    end: today.setDate(today.getDate() - 1)
})

// const tasks = []
// function delayMyPromise(prom, del) {
//     return new Promise(function (res, rej) {
//         setTimeout(function() {
//             return res(prom);
//         }, del);
//     });
// }

RED_STATUS.forEach((status) => {
    // const status = "ICEBOX"
    // dateRange.forEach((d, ndx) => {
    dateList.forEach((d, ndx) => {
        sleep(1000).then(() => {
            let y = datefns.getYear(d)
            let m = datefns.getMonth(d)+1
            let day = datefns.getDate(d)

            let m2 = m
            let day2 = day + 1 // TODO: Fix next-day-calc

            db.run(`delete from 'jira-stats' WHERE status='${status}' AND year=${y} AND month=${m}`)

            const jql = `status was "${status}" DURING ("${y}/${m}/${day}", "${y}/${m2}/${day2}")`
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
