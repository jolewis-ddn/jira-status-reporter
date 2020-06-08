"use strict";

// `set DEBUG=* & node simple-fetch.js`

const debug = require('debug')('main')
const JSR = require('./JiraStatusReporter')

let jsr = new JSR();

Promise.all([jsr.countRedEpics(), 
             jsr.countDeadIssues(), 
             jsr.countIssuesDoneThisMonth('RED')]
)
.then((values) => {
    values.forEach((val, ndx) => {
        console.log(val, ndx);
    })
    console.table(values)
})

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
