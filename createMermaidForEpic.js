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
program.requiredOption('-e, --epic <value>', 'Epic Key'
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
