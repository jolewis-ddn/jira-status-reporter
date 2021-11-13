/** @format */

const debug = require('debug')('JDP-reporter')
const fs = require('fs')
const path = require('path')

const JDP = require('./JiraDataParser')
let jdp = new JDP(
  JSON.parse(
    fs.readFileSync(
      [__dirname, 'tests', 'test-data', 'JDR-test-data.json'].join(path.sep)
    )
  )
)

let report = []
Object.keys(jdp.timelines).forEach((t) => {
  //   console.log(t, jdp.timelines[t].age.days, jdp.timelines[t].ageStatus)
  report.push({
    id: t,
    age: jdp.timelines[t].age.days,
    ageAssignee: jdp.timelines[t].ageAssignee,
    ageStatus: jdp.timelines[t].ageStatus,
    assigneeCount: jdp.timelines[t].assignee.count,
    statusChangeCount: jdp.timelines[t].statusChanges,
    updateCount: jdp.timelines[t].updates.count,
    // assignees: jdp.timelines[t].assignee.list.join(','),
  })
})
console.table(report)
// console.log(jdp.timelines)
