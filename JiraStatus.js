const debug = require('debug')('JiraStatus')
const JSR = require('./JiraStatusReporter')
let jsr = new JSR()

const config = require('config')

const faIcons = {
    Epic: 'fa:fa-fort-awesome',
    Story: 'fa:fa-book-reader',
    Task: 'fa:fa-tasks',
    'Sub-task': 'fa:fa-subscript',
    Bug: 'fa:fa-bug'
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
    const types = ['epic', 'story', 'task', 'sub-task', 'bug']
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
    return new Promise((resolve, reject) => {
        Promise.all([
            jsr.bareQueryCount(`${project} created >= -1w`),
            jsr.bareQueryCount(`${project} created >= -4w`),
            jsr.bareQueryCount(`${project} issuetype=bug and created >= -1d`),
            jsr.bareQueryCount(`${project} issuetype=bug and created >= -2d and created <= -1d`),
            jsr.bareQueryCount(`${project} issuetype=bug and created >= -1w`),
            jsr.bareQueryCount(`${project} issuetype=bug and created >= -2w and created <= -1w`),
            jsr.bareQueryCount(`${project} issuetype=bug and created >= -3w and created <= -2w`),
            jsr.bareQueryCount(`${project} issuetype=bug and created >= -4w and created <= -3w`),
            jsr.bareQueryCount(`${project} issuetype=bug and created >= -4w`),
            jsr.bareQueryCount(`${project} issuetype=bug and resolved >= -1w`),
            jsr.bareQueryCount(`${project} issuetype=bug and resolved >= -2w and resolved <= -1w`),
            jsr.bareQueryCount(`${project} issuetype=bug and resolved >= -3w and resolved <= -2w`),
            jsr.bareQueryCount(`${project} issuetype=bug and resolved >= -4w and resolved <= -3w`),
            jsr.bareQueryCount(`${project} issuetype=bug and resolved >= -4w`),
            jsr.bareQueryCount(`${project.substring(0,projectName.length-5)}`),
            jsr.bareQueryCount(`${project} issuetype=bug`),
            jsr.bareQueryCount(`${project} issuetype=story`),
        ])
        .then((values) => {
            resolve({
                allCreatedLastWeek: values[0],
                allCreatedLastMonth: values[1],
                bugsCreatedLastDay: values[2],
                bugsCreated2DayAgo: values[3],
                bugsCreatedLastWeek: values[4],
                bugsCreated2WeekAgo: values[5],
                bugsCreated3WeekAgo: values[6],
                bugsCreated4WeekAgo: values[7],
                bugsCreatedLastMonth: values[8],
                bugsResolvedLastWeek: values[9],
                bugsResolved2WeekAgo: values[10],
                bugsResolved3WeekAgo: values[11],
                bugsResolved4WeekAgo: values[12],
                bugsResolvedLastMonth: values[13],
                all: values[14],
                bugs: values[15],
                stories: values[16]
            })
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
