/** @format */

'use strict'
const debug = require('debug')('JSR')
const JiraApi = require('jira-client')

const { CACHE_TTL } = require('./utilities')

const NodeCache = require('node-cache')
const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 })

const crypto = require('crypto')

const config = require('config')
const dataPath = config.has('dataPath') ? config.get('dataPath') : 'data'

const datefns = require('date-fns')

const jsrFileMgr = require('./JiraStatusReporterFileManager')
const chartLinkMaker = require('./ChartLinkMaker')

const ACTION_CONTENTS = 99
const ACTION_COUNT = 1

const PROJECT_NAME = config.has('project') ? config.get('project') : 'UNSET'

const jira = new JiraApi({
  protocol: config.get('jira.protocol'),
  host: config.get('jira.host'),
  username: config.get('jira.username'),
  password: config.get('jira.password'),
  apiVersion: config.get('jira.apiVersion'),
  strictSSL: true,
})

const JQL_EPIC = 'type=Epic'
const UNASSIGNED_USER = config.has('unassignedUser')
  ? config.unassignedUser
  : 'UNASSIGNED'

const { promisify } = require('util')
const sleep = promisify(setTimeout)

const DEFAULT_GET_FIELDS = [
  'key',
  'assignee',
  'status',
  'summary',
  'creator',
  'reporter',
  'subtasks',
  'components',
  'labels',
  'priority',
  'created',
  'versions',
  'updated',
  'project',
  'issuetype',
  'fixVersions',
  'customfield_10070',
  'issuelinks',
]
const DEFAULT_COUNT_FIELDS = ['key']

class JiraStatusReporter {
  constructor() {
    debug('jsr constructed')
    this.startAt = 0
    this.jsrFm = new jsrFileMgr(dataPath)
    this.chartLinkMaker = new chartLinkMaker()
  }

  getContents() {
    return this.ACTION_CONTENTS
  }
  getCount() {
    return this.ACTION_COUNT
  }

  get(endpoint) {
    debug(`jsr.get(${endpoint}) called...`)
    return jira.genericGet(endpoint)
  }

  // Wrapper Functions
  getIssue(id) {
    return jira.findIssue(id)
  }

  /**
   * Show how much work is left, per person, for a release
   *
   * @param {array} [fixVersions=config.reports.releases] List of releases
   * @param {array} [users=config.reports.users] List of users
   * @param {string} [project=config.project] Which project
   * @param {array} [excludeTypes=config.reports.excludeTypes] Issue types to exclude
   * @param {array} [excludeStatuses=config.reports.excludeStatuses] Issue statuses to exclude
   * @returns Object containing data (header (array) and results (array of result rows)) and error
   * @memberof JiraStatusReporter
   */
  async getRemainingWorkReport(
    fixVersions = config.reports.releases,
    users = config.reports.users,
    project = config.project,
    excludeTypes = config.has('reports') && config.reports.has('excludeTypes')
      ? config.reports.excludeTypes
      : [],
    excludeStatuses = config.has('reports') &&
    config.reports.has('excludeStatuses')
      ? config.reports.excludeStatuses
      : []
  ) {
    const response = [] // Jira data collector
    const promises = [] // Per-user query
    let err = ''

    const hash = crypto.createHash('sha256')

    hash.update(
      fixVersions.join(',') +
        users.join(',') +
        project +
        excludeTypes.join(',') +
        excludeStatuses.join(',')
    )
    const cacheID = `remainingWorkReport-${hash.digest('hex')}`
    debug(`cacheID = ${cacheID}`)

    if (!cache.has(cacheID)) {
      debug(`...creating/updating cache`)
      users.forEach(async (user) => {
        const JQL_for_promise = `project="${project}"
        AND assignee${user == UNASSIGNED_USER ? ' is empty' : `="${user}"`}
        ${
          excludeStatuses.length
            ? ` AND status not in (${excludeStatuses.join(',')})`
            : ''
        }
        ${
          excludeTypes.length
            ? ` AND issuetype not in (${excludeTypes.join(',')})`
            : ''
        }
        ${
          fixVersions.length
            ? ` AND fixVersion in ("${fixVersions.join(',')}")`
            : ''
        }`
        //debug(`JQL_for_promise: ${JQL_for_promise}`)
        promises.push(jira.searchJira(JQL_for_promise))
      })

      try {
        const results = await Promise.all(promises)
        results.forEach(async (result) => {
          result.issues.forEach(async (issue) => {
            const percent = issue.fields.progress.percent
              ? issue.fields.progress.percent
              : 0
            if (this.issueBelongsToRemainingWorkReport(issue)) {
              response.push([
                issue.fields.assignee
                  ? issue.fields.assignee.displayName
                  : UNASSIGNED_USER,
                issue.key,
                issue.fields.summary.length > 40
                  ? issue.fields.summary.substring(0, 37) + '...'
                  : issue.fields.summary,
                issue.fields.issuetype.name,
                +(issue.fields.progress.progress / 28000).toFixed(2),
                +(issue.fields.progress.total / 28000).toFixed(2),
                percent,
                +(
                  (issue.fields.progress.total / 28000).toFixed(2) -
                  (issue.fields.progress.progress / 28000).toFixed(2)
                ).toFixed(2),
              ])
            }
          })
        })

        const cacheData = {
          data: {
            headers: config.reports.fields,
            results: response,
          },
          config: {
            project: project,
            users: users,
            fixVersions: fixVersions,
            excludeTypes: excludeTypes,
            excludeStatuses: excludeStatuses,
          },
          meta: {
            cacheDate: new Date(),
            cacheID: cacheID,
          },
          error: err,
        }
        cache.set(cacheID, 'TBD')
        cacheData.meta.cacheTTL = cache.getTtl(cacheID)
        cache.set(cacheID, cacheData)
      } catch (err) {
        console.error(`Promise.all() @ 155 failed:`, err)
        return err
      }
    } else {
      debug(`...returning data from cache`)
    } // if...!cache.has...

    return cache.get(cacheID)
  }

  issueBelongsToRemainingWorkReport(issue = false) {
    // debug(`issueBelongsToRemainingWorkReport(...) called...`)
    if (issue) {
      if (config.has('workInSubtasksOnly') && config.workInSubtasksOnly) {
        if (
          issue.fields.issuetype.name &&
          issue.fields.issuetype.name == 'Story'
        ) {
          // if (issue.fields.subtasks.length != 0) {
          //   // debug(
          //   //   `issueBelongsToRemainingWorkReport(...) returning ${
          //   //     issue.fields.subtasks.length == 0
          //   //   } for ${issue.key}`
          //   // )
          // }
          return issue.fields.subtasks.length == 0
        } else {
          return true
        }
      } else {
        return true
      }
    } else {
      debug(`...no issue data, so returning false`)
      return false
    }
  }

  async getIssueTypes(activeProjectOnly = true) {
    debug(`getIssueTypes(${activeProjectOnly}) called...`)
    // Return all types, or just the types for the active project?
    // TODO: Cache this value
    const allIssueTypesRaw = await jira.genericGet('issuetype')

    if (activeProjectOnly) {
      const allIssueTypesClean = {}
      for (let i = 0; i < allIssueTypesRaw.length; i++) {
        allIssueTypesClean[allIssueTypesRaw[i]['id']] = {
          name: allIssueTypesRaw[i]['name'],
          description: allIssueTypesRaw[i]['description'],
          iconUrl: allIssueTypesRaw[i]['iconUrl'],
          subtask: allIssueTypesRaw[i]['subtask'],
        }
      }
      // debug(`allIssueTypesClean: `, allIssueTypesClean)

      // TODO: Cache this value
      const statuses = await jira.genericGet(
        `project/${config.get('project')}/statuses`
      )
      const response = []
      for (let j = 0; j < statuses.length; j++) {
        response.push({
          id: statuses[j]['id'],
          iconUrl: allIssueTypesClean[statuses[j]['id']]['iconUrl'],
          name: statuses[j]['name'],
          description: allIssueTypesClean[statuses[j]['id']]['description'],
          subtask: statuses[j]['subtask'],
        })
      }
      return response
    } else {
      return allIssueTypesRaw
    }
  }

  getProject(project) {
    return jira.getProject(project)
  }

  // Functions to return issue counts or contents
  countIssuesByStatusOnDate(status, statusDate) {
    return this._issuesByStatusOnDate(status, statusDate, ACTION_COUNT)
  }

  getIssuesByStatusOnDate(status, statusDate) {
    return this._issuesByStatusOnDate(status, statusDate, ACTION_CONTENTS)
  }

  _issuesByStatusOnDate(status, statusDate, action) {
    let statusDateYear = datefns.getYear(statusDate)
    let statusDateMonth = datefns.getMonth(statusDate) + 1
    let statusDateDay = datefns.getDate(statusDate)

    let nextDate = datefns.addDays(statusDate, 1)
    let nextDateYear = datefns.getYear(nextDate)
    let nextDateMonth = datefns.getMonth(nextDate) + 1
    let nextDateDay = datefns.getDate(nextDate)

    let jql = `project="${PROJECT_NAME}" and status WAS "${status}" DURING ("${statusDateYear}/${statusDateMonth}/${statusDateDay}", "${nextDateYear}/${nextDateMonth}/${nextDateDay}")`
    debug(
      `_issuesByStatusOnDate(${status}, ${statusDate}, ${action})... jql: ${jql}`
    )
    return this._genericJiraSearch(jql, action)
  }

  countIssuesByStatusAndDateRange(status, startDate, endDate) {
    return this._issuesByStatusAndDateRange(
      status,
      startDate,
      endDate,
      ACTION_COUNT
    )
  }

  getIssuesByStatusAndDateRange(status, startDate, endDate) {
    return this._issuesByStatusAndDateRange(
      status,
      startDate,
      endDate,
      ACTION_CONTENTS
    )
  }

  _issuesByStatusAndDateRange(status, startDate, endDate, action) {
    let jql = `status WAS "${status}" DURING ("${startDate}", "${endDate}")`
    return this._genericJiraSearch(jql, action)
  }

  countIssuesCreatedOnDay(createDateYear, createDateMonth, createDateDay) {
    return this._issuesCreatedOnDay(
      createDateYear,
      createDateMonth,
      createDateDay,
      ACTION_COUNT
    )
  }

  getIssuesCreatedOnDay(createDateYear, createDateMonth, createDateDay) {
    return this._issuesCreatedOnDay(
      createDateYear,
      createDateMonth,
      createDateDay,
      ACTION_CONTENTS
    )
  }

  _issuesCreatedOnDay(createDateYear, createDateMonth, createDateDay, action) {
    let jql = `created > "${createDateYear}/${createDateMonth}/${createDateDay}" and created < "${createDateYear}/${createDateMonth}/${
      createDateDay + 1
    }"`
    return this._genericJiraSearch(jql, action)
  }

  countUpdatedYesterday() {
    return this._updatedYesterday(ACTION_COUNT)
  }

  getUpdatedYesterday() {
    return this._updatedYesterday(ACTION_CONTENTS)
  }

  _updatedYesterday(action) {
    return this._genericJiraSearch(
      'updated >= -1d and updated < startOfDay()',
      action
    )
  }

  countIssues(project, type) {
    return this._genericJiraSearch(
      this.jqlAppendProject(project, `type=${type}`),
      ACTION_COUNT
    )
  }

  countEpics(project) {
    return this._epics(project, ACTION_COUNT)
  }

  getEpics(project) {
    return this._epics(project, ACTION_CONTENTS)
  }

  countProjectEpics() {
    return this.countEpics(config.project, ACTION_COUNT)
  }

  getProjectEpics() {
    return this.getEpics(config.project, ACTION_CONTENTS)
  }

  _epics(project, action) {
    debug(`_epics(${project}, ${action}) called`)
    return this._genericJiraSearch(
      this.jqlAppendProject(project, JQL_EPIC),
      action
    )
  }

  countDeadIssues(project) {
    return this._deadIssues(project, ACTION_COUNT)
  }

  getDeadIssues(project) {
    return this._deadIssues(project, ACTION_CONTENTS)
  }

  _deadIssues(project, action) {
    let jql = 'status=Dead'
    if (project) {
      jql = this.jqlAppendProject(project)
    }
    return this._genericJiraSearch(jql, action)
  }

  countOpenIssuesByProject(project) {
    return this._openIssuesByProject(project, ACTION_COUNT)
  }

  getOpenIssuesByProject(project) {
    return this._openIssuesByProject(project, ACTION_CONTENTS)
  }

  _openIssuesByProject(project, action) {
    debug('Open Issues by Project (%s) called', project)
    return this._genericJiraSearch(
      `status not in (Dead, Closed) and project=${project}`,
      action
    )
  }

  countIssuesByProjectAndStatus(project, status) {
    return this._issuesByProjectAndStatus(project, status, ACTION_COUNT)
  }

  getIssuesByProjectAndStatus(project, status) {
    return this._issuesByProjectAndStatus(project, status, ACTION_CONTENTS)
  }

  _issuesByProjectAndStatus(project, status, action) {
    debug(
      'Issues by Project (%s) and Status (%s) called; action: %d',
      project,
      status,
      action
    )
    const jql = `status in (${status}) and project=${project}`

    return this._genericJiraSearch(
      `status in (${status}) and project=${project}`,
      action
    )
  }

  countIssuesChangedThisWeekByProjectAndStatus(project, field) {
    return this._issuesChangedThisWeekByProjectAndStatus(
      project,
      field,
      ACTION_COUNT
    )
  }

  getIssuesChangedThisWeekByProjectAndStatus(project, field) {
    debug(
      `getIssuesChangedThisWeekByProjectAndStatus(${project}, ${field}) called...`
    )
    return this._issuesChangedThisWeekByProjectAndStatus(
      project,
      field,
      ACTION_CONTENTS
    )
  }

  _issuesChangedThisWeekByProjectAndStatus(project, field, action) {
    debug(
      'Issues Changed this Week by Project (%s) and Field (%s) called; action: %d',
      project,
      field,
      action
    )
    return this._genericJiraSearch(
      `${field} changed after startOfWeek() and project=${project}`,
      action
    )
  }

  countIssuesChangedThisMonthByProjectAndStatus(project, field) {
    return this._issuesChangedThisMonthByProjectAndStatus(
      project,
      field,
      ACTION_COUNT
    )
  }

  getIssuesChangedThisMonthByProjectAndStatus(project, field) {
    return this._issuesChangedThisMonthByProjectAndStatus(
      project,
      field,
      ACTION_CONTENTS
    )
  }

  _issuesChangedThisMonthByProjectAndStatus(project, field, action) {
    debug(
      'Issues Changed this Month by Project (%s) and Field (%s) called; action: %d',
      project,
      field,
      action
    )
    return this._genericJiraSearch(
      `${field} changed after startOfMonth() and project=${project}`,
      action
    )
  }

  countIssuesDoneThisMonth(project) {
    return this._issuesDoneThisMonth(project, ACTION_COUNT)
  }

  getIssuesDoneThisMonth(project) {
    return this._issuesDoneThisMonth(project, ACTION_CONTENTS)
  }

  _issuesDoneThisMonth(project, action) {
    const jql = `status changed after startOfMonth() and status changed to "Done" and project=${project}`
    debug('jql: %s; action: %d', jql, action)
    return this._genericJiraSearch(jql, action)
  }

  countIssuesByStatusInDateRange(project, status, startDate, endDate) {
    return this._issuesByStatusInDateRange(
      project,
      status,
      startDate,
      endDate,
      ACTION_COUNT
    )
  }

  getIssuesByStatusInDateRange(project, status, startDate, endDate) {
    return this._issuesByStatusInDateRange(
      project,
      status,
      startDate,
      endDate,
      ACTION_CONTENTS
    )
  }

  _issuesByStatusInDateRange(project, status, startDate, endDate, action) {
    const y = datefns.getYear(startDate)
    const m = datefns.getMonth(startDate)
    const day = datefns.getDay(startDate)

    const y2 = datefns.getYear(endDate)
    const m2 = datefns.getMonth(endDate)
    const day2 = datefns.getDay(endDate)

    const jql = `project=${PROJECT_NAME} and status was "${status}" DURING ("${y}/${m}/${day}", "${y}/${m2}/${day2}")`
    debug('jql: %s; action: %d', jql, action)
    return this._genericJiraSearch(jql, action)
  }

  getEpicAndChildren(epicId) {
    this.setFields([
      'assignee',
      'subtasks',
      'issuelinks',
      'customfield_10008',
      'labels',
      'key',
      'status',
      'issuetype',
      'summary',
      'parent',
      'fixVersions',
      'timeestimate',
      'aggregatetimeestimate',
    ])

    // Default to Jira Server syntax
    let jql
    if (config.jira.host.endsWith('.atlassian.net')) {
      // Cloud server, so use parentEpic
      debug(`*** Using Jira Cloud syntax: parentEpic ***`)
      jql = `parentEpic=${epicId}`
    } else {
      // Jira Server, so use "Epic Link"
      debug(`*** Using Jira Server syntax: "Epic Link" ***`)
      jql = `id=${epicId} OR "Epic Link"=${epicId}`
    }
    debug(`getEpicAndChildren(${epicId}) called... jql: ${jql}`)
    return this._genericJiraSearch(jql, ACTION_CONTENTS)
  }

  async getLinks(issueId) {
    const issue = await this.getIssue(issueId)
    debug(`getLinks(${issueId} ==> issue/summary: `, issue.fields.summary)
    return {
      name: issue.fields.summary,
      id: issueId,
      status: issue.fields.status.name,
      type: issue.fields.issuetype.name,
      issuelinks: issue.fields.issuelinks,
    }
  }

  setFields(fields) {
    this.fields = fields
  }

  getFields(fields) {
    return this.fields
  }

  getFilter(filterId) {
    return jira.getFilter(filterId)
  }

  setStartAt(startAt) {
    this.startAt = startAt
  }
  getStartAt() {
    return this.startAt
  }
  clearStartAt() {
    this.startAt = null
  }

  async getProjects(countIssues) {
    if (countIssues) {
      // Get all the issue counts, too
      let projectData = {}
      let promises = []
      let seq = []
      let names = []
      const projects = await jira.listProjects()
      // debug(`got projects list: ${projects}`)
      const types = ['epic', 'story', 'task', 'sub-task', 'bug']

      for (let y = 0; y < projects.length; y++) {
        let p = projects[y]
        if (
          config.has('ignore') &&
          (config.get('ignore').includes(p.key) ||
            config.get('ignore').includes(p.name))
        ) {
          debug(`Skipping ${p.name} - set to 'ignore' in config`)
          // projectData[p.name] = { counts: [0,0,0,0,0] }
        } else {
          debug(`Processing ${p.name}...`)
          types.forEach((issuetype) => {
            // promises.push(new Promise(resolve => setTimeout(resolve, 500)).then(() => this.countIssues(`'${p.key}'`, issuetype)))
            promises.push(this.countIssues(`'${p.key}'`, issuetype))
            seq.push({ name: p.name, issuetype: issuetype })
            if (!names.includes(p.name)) {
              names.push(p.name)
              projectData[p.name] = { counts: [0, 0, 0, 0, 0] }
            }
          })
        }
      }

      const results = await Promise.all(promises)
      for (let x = 0; x < results.length; x++) {
        let result = results[x]
        let ndx = x
        // debug(`name: ${seq[ndx].name}; type: ${seq[ndx].issuetype}; index: ${types.indexOf(seq[ndx].issuetype)}; result: ${result}`)
        // debug(projectData[seq[ndx].name])
        projectData[seq[ndx].name].counts[types.indexOf(seq[ndx].issuetype)] =
          result
      }
      // debug(`finally returning `, projectData)
      return projectData
    } else {
      // Just the project names
      return jira.listProjects()
    }
  }

  async getHistory(id) {
    return jira.getIssueChangelog(id)
  }

  async getEpicsInRelease(release) {
    let epicList = await this._genericJiraSearch(
      `project="${config.project}" AND issuetype="Epic" AND fixVersion="${release}"`,
      99,
      ['assignee']
    )
    return epicList.issues.map((e) => e.key)
  }

  async getIssueSummary(id) {
    const data = await this._genericJiraSearch(`key=${id}`, ACTION_CONTENTS, [
      `summary`,
    ])
    if (data.issues[0].fields.summary) {
      return data.issues[0].fields.summary
    } else {
      console.error(`Missing Summary for ${id}`)
      return
    }
  }

  async _genericJiraSearch(jql, action, fields = [], showChanges = false) {
    return new Promise((resolve, reject) => {
      debug(
        `_genericJiraSearch(${jql}, ${action}, ${fields}, ${showChanges}) called...`
      )
      var queryConfig = {}

      if (showChanges) {
        queryConfig.expand = ['changelog']
      }

      switch (action) {
        case ACTION_COUNT:
          queryConfig.fields = this.DEFAULT_COUNT_FIELDS
          queryConfig.maxResults = 1
          jira
            .searchJira(jql, queryConfig)
            .then((response) => {
              // debug(`response: ${response.total}`)
              resolve(response.total)
            })
            .catch((err) => {
              debug('ERROR: jql: %s; ERR %O', jql, err.statusCode)
              reject(err)
            })
          // )
          break
        case ACTION_CONTENTS:
          if (fields) {
            queryConfig.fields = fields
            debug(`...using specified fields: ${fields} ${fields.length}`)
          } else if (this.fields) {
            queryConfig.fields = this.fields
          } else {
            queryConfig.fields = DEFAULT_GET_FIELDS
          }

          // First: Get max # of results
          queryConfig.maxResults = 1
          debug(
            `about to get # of results: jql = ${jql}; queryConfig: `,
            queryConfig
          )

          jira
            .searchJira(jql, queryConfig)
            .then((results) => {
              debug(`A) results.issues.length = ${results.issues.length}`)
              debug(`...total = ${results.total}`)
              let compiledResults = {}

              // Second: Calc # of queries needed
              queryConfig.maxResults = 99
              let TOTAL_RESULTS = results.total
              if (TOTAL_RESULTS > 0) {
                let runCount = Math.ceil(TOTAL_RESULTS / queryConfig.maxResults)
                debug(
                  `runCount: (Math.ceil(${queryConfig.maxResults}/${TOTAL_RESULTS})) = ${runCount}`
                )

                // Third: Queue up queries
                // Build array of queries/promises to run
                let jobList = []
                for (let ctr = 0; ctr < runCount; ctr++) {
                  queryConfig.startAt = ctr * queryConfig.maxResults
                  // debug(`jobList.push(jira.searchJira(${jql}`, queryConfig, `)`)
                  jobList.push(jira.searchJira(jql, queryConfig))
                }

                debug(`jobList built... length = ${jobList.length}`)

                // Fourth: Run queries
                Promise.all(jobList)
                  .then((rawResults) => {
                    // Fifth: Combine results
                    compiledResults.total = rawResults[0].total
                    compiledResults.expand = rawResults[0].expand
                    compiledResults.startAt = 0
                    compiledResults.maxResults = compiledResults.total
                    compiledResults.comment = 'Compiled by JiraStatusReporter'
                    compiledResults.query = jql

                    compiledResults.issues = []
                    for (let rrctr = 0; rrctr < rawResults.length; rrctr++) {
                      const element = rawResults[rrctr]
                      compiledResults.issues = compiledResults.issues.concat(
                        rawResults[rrctr].issues
                      )
                    }

                    // Complain if the expected and actual total counts don't match
                    console.assert(
                      compiledResults.issues.length == rawResults[0].total
                    )

                    resolve(compiledResults)
                  })
                  .catch((err) => {
                    reject(err)
                  })
              } else {
                resolve(results)
              }
            })
            .catch((err) => {
              debug('ERROR: jql: %s; ERR %O', jql, err.statusCode)
              reject(err)
            })
          break
        default:
          reject(`Unknown action specified: ${action}`)
      }
    })
  }

  async bareQuery(jql) {
    debug(`bareQuery(${jql}) called...`)
    return await jira.searchJira(jql, { maxResults: 200, fields: [] })
  }

  async bareQueryCount(jql) {
    debug(`bareQueryCount(${jql}) called...`)
    return await jira
      .searchJira(jql, { maxResults: 1, fields: ['key'] })
      .then((r) => {
        return r.total
      })
  }

  // Utility functions
  search(jql, queryParams) {
    debug(`search(${jql},`, queryParams, `) called`)
    return jira.searchJira(jql, queryParams)
  }

  jqlAppendProject(project, inJql) {
    return inJql + ` and project=${project}`
  }

  getFileManager() {
    return this.jsrFm
  }
  getChartLinkMaker() {
    return this.chartLinkMaker
  }

  getDemoChartImgTag() {
    this.chartLinkMaker().buildChartImgTag().then(res)
  }
}

module.exports = JiraStatusReporter
