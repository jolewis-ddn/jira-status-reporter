"use strict";
const debug = require('debug')('JSR')
const JiraApi = require('jira-client');
const config = require('./config.js');
const datefns = require('date-fns')

const jsrFileMgr = require('./JiraStatusReporterFileManager')
const chartLinkMaker = require('./ChartLinkMaker')

const ACTION_CONTENTS = 99;
const ACTION_COUNT = 1;

const jira = new JiraApi({
    protocol: config.jira.protocol,
    host: config.jira.host,
    username: config.jira.username,
    password: config.jira.password,
    apiVersion: config.jira.apiVersion,
    strictSSL: true
});

const JQL_EPIC = 'type=Epic';

const { promisify } = require('util')
const sleep = promisify(setTimeout)

const DEFAULT_GET_FIELDS = ["key", "assignee", "status", "summary", "creator", "reporter", "subtasks", "components", "labels", "priority", "created", "versions", "updated", "project", "issuetype", "fixVersions"]
const DEFAULT_COUNT_FIELDS = ["key"]

class JiraStatusReporter {
    constructor() {
        debug("jsr constructed")
        this.startAt = 0
        this.jsrFm = new jsrFileMgr('data')
        this.chartLinkMaker = new chartLinkMaker()
    }

    getContents() { return(this.ACTION_CONTENTS) }
    getCount() { return(this.ACTION_COUNT) }
    
    // Wrapper Functions
    getIssue(id) {
        return (jira.findIssue(id))
    }

    getProject(project) {
        return (jira.getProject(project));
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

        let jql = `project = RED and status WAS "${status}" DURING ("${statusDateYear}/${statusDateMonth}/${statusDateDay}", "${nextDateYear}/${nextDateMonth}/${nextDateDay}")`
        debug(`_issuesByStatusOnDate(${status}, ${statusDate}, ${action})... jql: ${jql}`)
        return this._genericJiraSearch(jql, action)
    }

    countIssuesByStatusAndDateRange(status, startDate, endDate) {
        return this._issuesByStatusAndDateRange(status, startDate, endDate, ACTION_COUNT)
    }

    getIssuesByStatusAndDateRange(status, startDate, endDate) {
        return this._issuesByStatusAndDateRange(status, startDate, endDate, ACTION_CONTENTS)
    }

    _issuesByStatusAndDateRange(status, startDate, endDate, action) {
        let jql = `status WAS "${status}" DURING ("${startDate}", "${endDate}")`
        return this._genericJiraSearch(jql, action)
    }

    countIssuesCreatedOnDay(createDateYear, createDateMonth, createDateDay) {
        return this._issuesCreatedOnDay(createDateYear, createDateMonth, createDateDay, ACTION_COUNT)
    }

    getIssuesCreatedOnDay(createDateYear, createDateMonth, createDateDay) {
        return this._issuesCreatedOnDay(createDateYear, createDateMonth, createDateDay, ACTION_CONTENTS)
    }

    _issuesCreatedOnDay(createDateYear, createDateMonth, createDateDay, action) {
        let jql = `created > "${createDateYear}/${createDateMonth}/${createDateDay}" and created < "${createDateYear}/${createDateMonth}/${createDateDay + 1}"`
        return this._genericJiraSearch(jql, action)
    }

    countUpdatedYesterday() {
        return this._updatedYesterday(ACTION_COUNT)
    }

    getUpdatedYesterday() {
        return this._updatedYesterday(ACTION_CONTENTS)
    }

    _updatedYesterday(action) {
        return this._genericJiraSearch("updated >= -1d and updated < startOfDay()", action)
    }
    countRedEpics() {
        return this._redEpics(ACTION_COUNT)
    }
    getRedEpics() {
        return this._redEpics(ACTION_CONTENTS)
    }

    _redEpics(action) {
        return this._genericJiraSearch(this.jqlAppendProject("RED", JQL_EPIC), action)
    }

    countDeadIssues(project) {
        return this._deadIssues(project, ACTION_COUNT)
    }

    getDeadIssues(project) {
        return this._deadIssues(project, ACTION_CONTENTS)
    }

    _deadIssues(project, action) {
        let jql = "status=Dead"
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
        debug('Open Issues by Project (%s) called', project);
        return this._genericJiraSearch(`status not in (Dead, Closed) and project=${project}`, action)
    }

    countIssuesByProjectAndStatus(project, status) {
        return this._issuesByProjectAndStatus(project, status, ACTION_COUNT)
    }

    getIssuesByProjectAndStatus(project, status) {
        return this._issuesByProjectAndStatus(project, status, ACTION_CONTENTS)
    }

    _issuesByProjectAndStatus(project, status, action) {
        debug('Issues by Project (%s) and Status (%s) called; action: %d', project, status, action);
        const jql = `status in (${status}) and project=${project}`

        return this._genericJiraSearch(`status in (${status}) and project=${project}`, action)
    }

    countIssuesChangedThisWeekByProjectAndStatus(project, field) {
        return this._issuesChangedThisWeekByProjectAndStatus(project, field, ACTION_COUNT)
    }

    getIssuesChangedThisWeekByProjectAndStatus(project, field) {
        return this._issuesChangedThisWeekByProjectAndStatus(project, field, ACTION_CONTENTS)
    }

    _issuesChangedThisWeekByProjectAndStatus(project, field, action) {
        debug('Issues Changed this Week by Project (%s) and Field (%s) called; action: %d', project, field, action);
        return this._genericJiraSearch(`${field} changed after startOfWeek() and project=${project}`, action)
    }

    countIssuesChangedThisMonthByProjectAndStatus(project, field) {
        return this._issuesChangedThisMonthByProjectAndStatus(project, field, ACTION_COUNT)
    }

    getIssuesChangedThisMonthByProjectAndStatus(project, field) {
        return this._issuesChangedThisMonthByProjectAndStatus(project, field, ACTION_CONTENTS)
    }

    _issuesChangedThisMonthByProjectAndStatus(project, field, action) {
        debug('Issues Changed this Month by Project (%s) and Field (%s) called; action: %d', project, field, action);
        return this._genericJiraSearch(`${field} changed after startOfMonth() and project=${project}`, action)
    }

    countIssuesDoneThisMonth(project) {
        return (this._issuesDoneThisMonth(project, ACTION_COUNT))
    }

    getIssuesDoneThisMonth(project) {
        return (this._issuesDoneThisMonth(project, ACTION_CONTENTS))
    }

    _issuesDoneThisMonth(project, action) {
        const jql = `status changed after startOfMonth() and status changed to "Done" and project=${project}`
        debug('jql: %s; action: %d', jql, action);
        return this._genericJiraSearch(jql, action)
    }

    countIssuesByStatusInDateRange(project, status, startDate, endDate) {
        return (this._issuesByStatusInDateRange(project, status, startDate, endDate, ACTION_COUNT))
    }

    getIssuesByStatusInDateRange(project, status, startDate, endDate) {
        return (this._issuesByStatusInDateRange(project, status, startDate, endDate, ACTION_CONTENTS))
    }

    _issuesByStatusInDateRange(project, status, startDate, endDate, action) {
        const y = datefns.getYear(startDate)
        const m = datefns.getMonth(startDate)
        const day = datefns.getDay(startDate)

        const y2 = datefns.getYear(endDate)
        const m2 = datefns.getMonth(endDate)
        const day2 = datefns.getDay(endDate)

        const jql = `project=RED and status was "${status}" DURING ("${y}/${m}/${day}", "${y}/${m2}/${day2}")`
        debug('jql: %s; action: %d', jql, action);
        return (this._genericJiraSearch(jql, action))
    }

    getEpicAndChildren(epicId) {
        this.setFields(["assignee", "subtasks", "issuelinks","customfield_10008", "labels", "key", "status", "issuetype", "summary", "parent", "fixversion"])
        const jql = `parentEpic=${epicId}`
        debug(`getEpicAndChildren(${epicId}) called... jql: ${jql}`)
        return (this._genericJiraSearch(jql, ACTION_CONTENTS))
    }

    setFields(fields) {
        this.fields = fields
    }

    getFields(fields) {
        return (this.fields)
    }

    getFilter(filterId) {
        return (jira.getFilter(filterId))
    }

    setStartAt(startAt) { this.startAt = startAt }
    getStartAt() { return (this.startAt) }
    clearStartAt() { this.startAt = null }

    createBogusLink() {
        // Test write-access to Jira
        // Source: https://github.com/steves/node-jira
        // create a web link to a GitHub issue
        var linkData = {
            "object": {
                "url" : "https://github.com/steves/node-jira/issues/1",
                "title": "Add getVersions and createVersion functions",
                "icon" : {
                    "url16x16": "https://github.com/favicon.ico"
                }
            }
        };

        jira.createRemoteLink("IME-2902", linkData, function (err, link) {
            if (err) {
                console.log("ERROR ", err)
            } else {
                console.log("Worked! " + link)
            }
        });
    }

    _genericJiraSearch(jql, action) {
        return new Promise((resolve, reject) => {
            debug(`_genericJiraSearch(${jql}) called...`)
            var queryConfig = {}
            var compiledResults = {}

            switch (action) {
                case ACTION_COUNT:
                    queryConfig.fields = this.DEFAULT_COUNT_FIELDS
                    queryConfig.maxResults = 1
                    jira.searchJira(jql, queryConfig)
                        .then((response) => {
                            debug(`response: ${response.total}`)
                            resolve(response.total)
                        })
                        .catch((err) => {
                            debug("jql: %s; ERR %O", jql, err.statusCode);
                            reject(err)
                        })
                    // )
                    break;
                case ACTION_CONTENTS:
                    if (this.fields) {
                        queryConfig.fields = this.fields
                    } else {
                        queryConfig.fields = DEFAULT_GET_FIELDS
                    }
                    
                    // First: Get max # of results
                    queryConfig.maxResults = 1
                    jira.searchJira(jql, queryConfig)
                    .then((results) => {
                        debug(`A) results.issues.length = ${results.issues.length}`)
                        debug(`...total = ${results.total}`)
                        let compiledResults = {}

                        // Second: Calc # of queries needed
                        queryConfig.maxResults = 99
                        let TOTAL_RESULTS = results.total
                        if (TOTAL_RESULTS > 0) {
                        let runCount = Math.ceil(TOTAL_RESULTS/queryConfig.maxResults)
                        debug(`runCount: (Math.ceil(${queryConfig.maxResults}/${TOTAL_RESULTS})) = ${runCount}`)

                        // Third: Queue up queries
                        // Build array of queries/promises to run
                        let jobList = []
                        for (let ctr = 0; ctr < runCount; ctr++) {
                            queryConfig.startAt = ctr * queryConfig.maxResults
                            debug(`jobList.push(jira.searchJira(${jql}`, queryConfig, `)`)
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
                                compiledResults.comment = "Compiled by JiraStatusReporter"
                                compiledResults.issues = []
                                for (let rrctr = 0; rrctr < rawResults.length; rrctr++) {
                                    const element = rawResults[rrctr];
                                    compiledResults.issues = compiledResults.issues.concat(rawResults[rrctr].issues)
                                }

                                // Complain if the expected and actual total counts don't match
                                console.assert(compiledResults.issues.length == rawResults[0].total)

                                resolve(compiledResults)
                            })
                            .catch((err) => {
                                reject(err)
                            })
                        } else {
                            resolve(results)
                        }
                    })
                    break;
                default:
                    reject(`Unknown action specified: ${action}`)
            }
        })
    }

    // Utility functions
    search(jql, queryParams) {
        debug(`search(${jql},`, queryParams, `) called`)
        return (jira.searchJira(jql, queryParams));
    }

    jqlAppendProject(project, inJql) {
        return (inJql + ` and project=${project}`)
    }

    getFileManager() { return(this.jsrFm) }
    getChartLinkMaker() { return(this.chartLinkMaker) }

    getDemoChartImgTag() { 
        this.chartLinkMaker().buildChartImgTag()
            .then((res))
    }
}

module.exports = JiraStatusReporter;
