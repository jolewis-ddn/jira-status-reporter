"use strict";
const debug = require('debug')('scratch')
const { Command } = require('commander')
const program = new Command()
program.version('0.0.1')

const JSR = require('./JiraStatusReporter')
const MermaidNodes = require('./MermaidNodes')

let jsr = new JSR()
let mynodes = new MermaidNodes()

function status(value, previous) { return previous.concat([value]) }
program.requiredOption('-e, --epic <value>', 'Epic Key (e.g. RED-1390')
program.parse(process.argv)

const epic = program.epic
let epicId = false
let epicSummary = false

jsr.getEpicAndChildren(epic)
    .then((result) => {
        result.issues.forEach((issue) => {
            if (issue.fields.customfield_10008 && issue.fields.customfield_10008 == epic) {
                // Story
                mynodes.addLink(0, epic, issue.id, `${issue.key} ${issue.fields.summary}`, issue.fields.status.name)
            } else if (issue.fields.parent) {
                // Sub-Task
                mynodes.addLink(
                    issue.fields.parent.id, 
                    `${issue.fields.parent.key} ${issue.fields.parent.fields.summary}`,
                    issue.id, 
                    `${issue.key} ${issue.fields.summary}`, 
                    issue.fields.status.name)
            } else if (issue.key == epic) {
                // Epic
                epicId = issue.id
                epicSummary = `${issue.key} ${issue.fields.summary}`
                debug("epicId now set to ", epicId)
                debug("epicSummary now set to ", epicSummary)
                mynodes.appendStatus(epicId, issue.fields.status.name)
            } else {
                // Unknown
                debug(`Unknown relationship: ${issue.key} // ${issue.fields.parent}`)
            }
        })
    })
    .finally(() => {
        mynodes.setRootIdAndName(epicId, epicSummary)
        console.log(mynodes.getContent());
    })
        

//         console.log("classDef ICEBOX fill:#ccc;\nclassDef DEAD fill:#333,stroke:#fff,color:#fff;\nclassDef EMERGENCY fill:#a00,stroke:#fff,color:#fff,stroke-width:0px;\nclassDef BLOCKED fill:#faa,stroke:#000,color:#000,stroke-width:3px;\nclassDef INPROGRESS fill:#cfc;\nclassDef DEFINED fill:#aaa;\nclassDef INREVIEW fill:#aca;\nclassDef DONE fill:#00f,stroke:#fff,color:#fff;")

//         console.error(statuses)

//     })
//     .catch((err) => {
//         console.error(err)
//     })

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
