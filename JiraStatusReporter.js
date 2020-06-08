"use strict";
const debug = require('debug')('JSR')
const JiraApi = require('jira-client');
const config = require('./config.js');

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

class JiraStatusReporter {    
    constructor() {
        debug("jsr constructed")
    }

    // Wrapper Functions
    getIssue(id) {
        return(jira.findIssue(id))
    }
    
    getProject(project) {
        return(jira.getProject(project));
    }

    // Functions to return issue counts or contents
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
        return(this._issuesDoneThisMonth(project, ACTION_COUNT)) 
    }

    getIssuesDoneThisMonth(project) { 
        return(this._issuesDoneThisMonth(project, ACTION_CONTENTS)) 
    }

    _issuesDoneThisMonth(project, action) {
        const jql = `status changed after startOfMonth() and status changed to "Done" and project=${project}`
        debug('jql: %s; action: %d', jql, action);
        return this._genericJiraSearch(jql, action)
    }

    _genericJiraSearch(jql, action) {
        return new Promise((resolve, reject) => {
            switch (action) {
                case ACTION_COUNT:
                    debug("counting...")
                    jira.searchJira(jql, { maxResults: 1 })
                    .then((response) => {
                        debug(`response: ${response.total}`)
                        resolve(response.total)
                    })
                    .catch((err) => { 
                        debug("jql: %s; ERR %O", jql, err); 
                        reject(err) 
                    })
                    break;
                case ACTION_CONTENTS:
                        jira.searchJira(jql, { maxResults: 99 })
                        .then((results) => {
                            resolve(results);
                        })
                        .catch((err) => { 
                        debug("jql: %s; ERR %O", jql, err); 
                        reject(err) 
                    })
                    break;
                default:
                    reject(`Unknown action specified: ${action}`)    
            }
        })
    }

    // Utility functions
    jqlAppendProject(project, inJql) {
        return(inJql + ` and project=${project}`)
    }
}    

module.exports = JiraStatusReporter;
