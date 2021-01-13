/*
 * Report on how much work is left in a specific release
 * Queries Jira for specific users, excluding specified statuses
 * and issue types.
 * 
 * Output is suitable for import into Excel (tab-delimited)
 * 
 */
const JSR = require('./JiraStatusReporter')
const jsr = new JSR()

jsr.getRemainingWorkReport()
.then((results) => {
  console.log(results.data.headers.join('\t'))
  results.data.results.forEach((row) => {
    console.log(row.join('\t'))
  })
})
