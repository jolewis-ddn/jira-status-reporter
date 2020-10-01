const debug = require('debug')('JiraStatus')
const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const config = require('config')

const faIcons = {
    Epic: 'fa:fa-fort-awesome',
    Story: 'fa:fa-book-reader',
    Task: 'fa:fa-tasks',
    'Sub-task': 'fa:fa-subscript',
    Bug: 'fa:fa-bug',
    Requirement: 'fa:fa-clipboard-check'
}

const useFontawesome = config.has('fa')

async function getFields() {
    debug(`getFields() called`)
    return await jsr.get('field')
}

async function formatFieldsHtml(fields) {
    let response = []
    response.push(`<table style="width: auto;" class="table table-striped table-hover table-sm"><thead class="thead-dark"><tr><th scope="col">${[
        'ID',
        'Name',
        'Custom',
        'Navigable',
        'Searchable',
        'Clause Names'
    ].join('</th><th scope="col">')}</th></tr></thead><tbody>`)
    response.push(`<em>${fields.length} fields as of ${new Date()}`)
    fields.forEach((f) => {
        response.push(
            `<tr><th scope="row">${f.id}</th><td>${[
                f.name,
                f.custom,
                f.navigable,
                f.searchable,
                f.clauseNames.join('<br>')
            ].join('</td><td>')}</td></tr>`
        )
    })
    response.push('</tbody></table>')
    return (response.join(''))
}

async function formatProjectDataHtml(projectData) {
    const types = ['epic', 'story', 'task', 'sub-task', 'bug', 'requirement']
    let response = []
    response.push(`<table style="width: auto;" class="table table-striped table-hover table-sm"><thead class="thead-dark"><tr><th scope="col">Project Name</th><th>${types.join('</th><th scope="col">')}</th></tr></thead><tbody>`)
    response.push(`<em>${Object.keys(projectData).length} projects as of ${new Date()}`)
    Object.keys(projectData).forEach((key) => {
        // debug(`projectData[${key}]`, projectData[key], projectData.key)
        response.push(
            `<tr><th scope="row">${key}</th><td>${projectData[key].counts.join('</td><td>')}</td></tr>`
        )
    })
    response.push('</tbody></table>')
    return (response.join(''))
}

function getFontawesomeJsLink() {
    if (useFontawesome) {
        return `<script src="${config.get('fa')}" crossorigin="anonymous"></script>`
    } else {
        return ''
    }
}

function getFontawesomeIcon(issueType) {
    if (useFontawesome) {
        debug(`getFaIcon(${issueType}) returning ${faIcons[issueType]}`)
        return `${faIcons[issueType]} `
    } else {
        return ''
    }
}

function formatCssClassName(jiraName) {
    return jiraName.replace(/\s/g, '')
}

async function getConfig() {
    const cfg = config.util.toObject()
    cfg.jira.password = '***REMOVED***'
    return cfg
}

function formatConfigHtml(configDetails) {
    let response = []
    response.push(`
            <dl class="row">
            <dt class="col-sm-3">
            Jira Username
            </dt>
            <dd class="col-sm-9">
            ${config.get('jira.username')}
            </dd>
            <dt class="col-sm-3">
            Jira URL
            </dt>
            <dd class="col-sm-9">
            ${config.get('jira.protocol')}://${config.get('jira.host')}
            </dd>
            <dt class="col-sm-3">
            API
            </dt>
            <dd class="col-sm-9">
            ${config.get('jira.apiVersion')}
            </dd>
            <dt class="col-sm-3">
            Server: Port
            </dt>
            <dd class="col-sm-9">
            ${config.get('server.port')}
            </dd>
            <dt class="col-sm-3">
            Graphic Server
            </dt>
            <dd class="col-sm-9">
            ${config.get('graphicServer.protocol')}://${
        config.get('graphicServer.server')
        }:${config.get('graphicServer.port')}/${config.get('graphicServer.script')}
            </dd>
            <dt class="col-sm-3">
            Project
            </dt>
            <dd class="col-sm-9">
            ${config.has('project') ? config.get('project') : 'not set'}
            </dd>
            </dl>`)
    return(response.join(''))
}

async function report(projectName = false) {
    debug(`report(${projectName}) called...`)
    let project = ''
    if (projectName) {
        project = `project='${projectName}' AND `
    }

    const queries = [
        {   name: 'All issues created in last week', 
            shortname: 'allCreatedLasWeek',
            query: `${project} created >= -1w` 
        },
        {   name: 'All issues created in last 4 weeks', 
            shortname: 'allCreatedLastMonth',
            query: `${project} created >= -4w`
        },
        {   name: 'All bugs created yesterday', 
            shortname: 'bugsCreatedLastDay',
            query: `${project} issuetype=bug and created >= -1d`
        },
        {   name: 'All bugs created day before yesterday', 
            shortname: 'bugsCreated2DayAgo',
            query: `${project} issuetype=bug and created >= -2d and created <= -1d`
        },
        {   name: 'All bugs created 3 day ago', 
            shortname: 'bugsCreated3DayAgo',
            query: `${project} issuetype=bug and created >= -3d and created <= -2d`
        },
        {   name: 'All bugs created 4 day ago', 
            shortname: 'bugsCreated4DayAgo',
            query: `${project} issuetype=bug and created >= -4d and created <= -3d`
        },
        {   name: 'All bugs created 5 day ago', 
            shortname: 'bugsCreated5DayAgo',
            query: `${project} issuetype=bug and created >= -5d and created <= -4d`
        },
        {   name: 'All bugs created last week', 
            shortname: 'bugsCreatedLastWeek',
            query: `${project} issuetype=bug and created >= -1w`
        },
        {   name: 'All bugs created 2 weeks ago', 
            shortname: 'bugsCreated2WeekAgo',
            query: `${project} issuetype=bug and created >= -2w and created <= -1w`
        },
        {   name: 'All bugs created 3 weeks ago', 
            shortname: 'bugsCreated3WeekAgo',
            query: `${project} issuetype=bug and created >= -3w and created <= -2w`
        },
        {   name: 'All bugs created 4 weeks ago', 
            shortname: 'bugsCreated4WeekAgo',
            query: `${project} issuetype=bug and created >= -4w and created <= -3w`
        },
        {   name: 'All bugs created in last 4 weeks', 
            shortname: 'bugsCreatedLastMonth',
            query: `${project} issuetype=bug and created >= -4w`
        },
        {   name: 'All bugs resolved yesterday', 
            shortname: 'bugsResolvedLastDay',
            query: `${project} issuetype=bug and resolved >= -1d`
        },
        {   name: 'All bugs resolved day before yesterday', 
            shortname: 'bugsResolved2DayAgo',
            query: `${project} issuetype=bug and resolved >= -2d and resolved <= -1d`
        },
        {   name: 'All bugs resolved 3 days ago', 
            shortname: 'bugsResolved3DayAgo',
            query: `${project} issuetype=bug and resolved >= -3d and resolved <= -2d`
        },
        {   name: 'All bugs resolved 4 days ago', 
            shortname: 'bugsResolved4DayAgo',
            query: `${project} issuetype=bug and resolved >= -4d and resolved <= -3d`
        },
        {   name: 'All bugs resolved 5 days ago', 
            shortname: 'bugsResolved5DayAgo',
            query: `${project} issuetype=bug and resolved >= -5d and resolved <= -4d`
        },
        {   name: 'All bugs resolved last week', 
            shortname: 'bugsResolvedLastWeek',
            query: `${project} issuetype=bug and resolved >= -1w`
        },
        {   name: 'All bugs resolved 2 weeks ago', 
            shortname: 'bugsResolved2WeekAgo',
            query: `${project} issuetype=bug and resolved >= -2w and resolved <= -1w`
        },
        {   name: 'All bugs resolved 3 weeks ago', 
            shortname: 'bugsResolved3WeekAgo',
            query: `${project} issuetype=bug and resolved >= -3w and resolved <= -2w`
        },
        {   name: 'All bugs resolved 4 weeks ago', 
            shortname: 'bugsResolved4WeekAgo',
            query: `${project} issuetype=bug and resolved >= -4w and resolved <= -3w`
        },
        {   name: 'All bugs resolved in last 4 weeks', 
            shortname: 'bugsResolvedLastMonth',
            query: `${project} issuetype=bug and resolved >= -4w`
        },
        {   name: 'All issues', 
            shortname: 'all',
            query: `project='${projectName}'`
        },
        {   name: 'All bugs', 
            shortname: 'bugs',
            query: `${project} issuetype=bug`
        },
        {   name: 'All stories', 
            shortname: 'stories',
            query: `${project} issuetype=story`
        }
    ]
        
    let promises = []
    for (let qnum = 0; qnum < queries.length; qnum++) {
        q = queries[qnum]
        debug(`in queries.forEach with ${q}; pushing ${q.query}`)
        promises.push(jsr.bareQueryCount(q.query)) 
    }

    return new Promise((resolve, reject) => {
        Promise.all(
            promises
        )
        .then((values) => {
            let result = {}
            for (let ndx = 0; ndx < queries.length; ndx++) {
                q = queries[ndx]
                result[q.shortname] = { name: q.name, query: q.query, result: values[ndx] }
            }
            let meta = { project: projectName, reportedOn: new Date() }
            resolve({ meta: meta, errors: [], data: result })
        })
        .catch((err) => {
            reject(err)
        })
    })
}

async function reportOld() {
    return new Promise((resolve, reject) => {
        Promise.all([
            jsr.countRedEpics(),
            jsr.countDeadIssues(),
            jsr.countOpenIssuesByProject(config.get('project')),
            jsr.countIssuesDoneThisMonth(config.get('project')),
            jsr.getIssuesDoneThisMonth(config.get('project')),
            jsr.countIssuesChangedThisMonthByProjectAndStatus(config.get('project'), 'Status'),
            jsr.getIssuesChangedThisWeekByProjectAndStatus(config.get('project'), 'Status')
        ])
            .then((values) => {
                const doneData = values[4].issues
                const doneKeys = []
                doneData.forEach((data) => {
                    debug(`doneKeys - adding ${data.key}`)
                    doneKeys.push(data.key)
                })

                const statusChangesThisWeek = []
                values[6].issues.forEach((data) => {
                    debug(`values[6] pushing ${data.key}`)
                    let assigneeName = ''
                    if (data.fields.assignee) {
                        assigneeName = data.fields.assignee.displayName
                    }
                    statusChangesThisWeek.push({
                        key: data.key,
                        type: data.fields.issuetype.name,
                        owner: assigneeName,
                        updated: data.fields.updated,
                        status: data.fields.status.name,
                        summary: data.fields.summary
                    })
                })

                response = {
                    'Epic Count': values[0],
                    'Dead Issue Count': values[1],
                    'Open Issues (Count)': values[2],
                    'Issue Status updates this Month (Count)': values[5],
                    'Issue Status updates this Week (Count)': values[5],
                    'Issue Status updates this Week (List)': statusChangesThisWeek,
                    'Issues Done this Month (Count)': values[3],
                    'Issues Done this Month (List)': doneKeys.join(',')
                    // 'Issues Done this Month (Data)': values[4],
                }
                resolve(response)
            })
            .catch((err) => {
                reject(err)
            })
    })
}

function printList(data, key = false, numbered = false, format = "html", link = false, linkPrefix = false) {
    if (typeof data == typeof []) { // List of objects
        if (key) {
            let results = []
            results.push(numbered ? `<ol>` : `<ul>`)
            data.forEach(d => {
                let printedName = d[key]
                debug(printedName, numbered, format, link, linkPrefix)
                if (link) {
                    // Make the name a link
                    if (linkPrefix) {
                        printedName = `<a href='${link}/${linkPrefix}'>${d[key]}</a> [${name}]`
                    } else {
                        printedName = `<a href='${link}/${d[key]}'>${d.name}</a> [${d[key]}]`
                    }
                }
                results.push(`<li>${printedName}</li>`)
            })
            results.push(`</ul>`)
            return(results.join(''))
        } else {
            if (format == "html") {
                return(`${ numbered ? '<ol>' : '<ul>' }<li>${data.join('</li></li>')}</li></ul>`)
            } else {
                return(data.join(`\n`))
            }
        }
    } else {
        return('unknown data type')
    }
}

async function getProjects() {
    return(await jsr.getProjects(true))    
}

module.exports = {
    getConfig,
    getFields,
    formatConfigHtml,
    formatFieldsHtml,
    formatProjectDataHtml,
    useFontawesome,
    faIcons,
    getFontawesomeIcon,
    getFontawesomeJsLink,
    formatCssClassName,
    report,
    getProjects,
    printList
}
