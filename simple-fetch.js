"use strict";

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/jira-stats.db')

const datefns = require('date-fns')

const { promisify } = require('util')
const sleep = promisify(setTimeout)

// `set DEBUG=* & node simple-fetch.js`

const debug = require('debug')('main')
const JSR = require('./JiraStatusReporter')

const RED_STATUS = ['ICEBOX']
// const RED_STATUS = ['ICEBOX', 'DEFINED', 'IN PROGRESS', 'IN REVIEW', 'DONE', 'EMERGENCY', 'BLOCKED', 'DEAD']

let jsr = new JSR();

// Date tests
const dateList = datefns.eachDayOfInterval({
    start: new Date(2020, 0, 1, 0, 0, 0),
    end: new Date()
})

// dateList.forEach((d) => {
//     console.log(datefns.getYear(d), datefns.getMonth(d)+1, datefns.getDate(d))
// })

// // Working
// Promise.all([jsr.countRedEpics(), 
//              jsr.countDeadIssues(), 
//              jsr.countIssuesDoneThisMonth('RED')]
// )
// .then((values) => {
//     values.forEach((val, ndx) => {
//         console.log(val, ndx);
//     })
//     console.table(values)
// })

// jsr.getUpdatedYesterday()

// jsr.countIssuesByStatusAndDateRange(status, "2020/06/11", "2020/06/12")
// .then((val) => { console.log(`${status} between 6/11 and 6/12: ${val}`)})

const tasks = []

function delayMyPromise(prom, del) {
    return new Promise(function (res, rej) {
        setTimeout(function() {
            return res(prom);
        }, del);
    });
}

RED_STATUS.forEach((status) => {
    db.run(`delete from 'jira-stats' WHERE status='${status}'`)
    // dateRange.forEach((d, ndx) => {
    dateList.forEach((d, ndx) => {
        sleep(1000).then(() => {
            let y = datefns.getYear(d)
            let m = datefns.getMonth(d)+1
            let day = datefns.getDate(d)
            jsr.countIssuesCreatedOnDay(y, m, day)
                .then((results) => {
                    console.log(`${status} on ${y}/${m}/${day}: ${results}`)
                    db.run("INSERT INTO `jira-stats` (status, year, month, day, count) VALUES (?, ?, ?, ?, ?)", status, y, m, day, results)
                })
                .catch((err) => {
                    console.warn(`Error: ${err.statusCode} for status ${status} on ${y}/${m}/${day}`)
                })
        })
    })
})

// // BROKEN
//
// RED_STATUS.forEach((status) => {
//     let y = 0
//     let m = 0
//     let day = 0
//     dateList.forEach((d, ndx) => {
//         y = datefns.getYear(d)
//         m = datefns.getMonth(d) + 1
//         day = datefns.getDate(d)
//         tasks.push(jsr.countIssuesByStatusOnDate(status, datefns.getYear(d), datefns.getMonth(d), datefns.getDate(d)))
//     })
//     Promise.all(tasks)
//         .then((results) => {
//             console.log(`${status} on ${y}/${m}/${day}: ${results}`)
//             db.run("INSERT INTO `jira-stats` (status, year, month, day, count) VALUES (?, ?, ?, ?, ?)", status, y, m, day, results)
//         })
//         .catch((err) => {
//             console.error("ERROR:", err.statusCode)
//         })
// })

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

console.log("Done")
