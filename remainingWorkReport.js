/*
 * Report on how much work is left in a specific release
 * Queries Jira for specific users, excluding specified statuses
 * and issue types.
 * 
 * Output is suitable for import into Excel (tab-delimited)
 * 
 */
const config = require('config')
const JiraApi = require('jira-client')

var jira = new JiraApi({
  protocol: config.jira.protocol,
  host: config.jira.host,
  username: config.jira.username,
  password: config.jira.password,
  apiVersion: config.jira.apiVersion,
  strictSSL: true,
})

console.log(
  config.cli.fields.join('\t')
)

config.cli.users.forEach((user) => {
  jira
    .searchJira(
      `assignee="${user}" and status not in (${config.cli.excludeStatuses.join(',')}) and issuetype not in (${config.cli.excludeTypes.join(',')}) and fixVersion in ("${config.cli.releases.join(',')}")`
    )
    .then((results) => {
      results.issues.forEach((issue) => {
        const percent = issue.fields.progress.percent
          ? issue.fields.progress.percent
          : 0
        console.log(
          [
            user,
            issue.key,
            issue.fields.issuetype.name,
            (issue.fields.progress.progress / 28000).toFixed(2),
            (issue.fields.progress.total / 28000).toFixed(2),
            percent,
          ].join('\t')
        )
      })
    })
    .catch((err) => {
      console.error(err)
    })
})
